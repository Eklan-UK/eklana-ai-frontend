import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import { logger } from "@/lib/api/logger";
import { isValidUserId, toUserIdQuery } from "@/lib/api/user-id";
import { isValidationError } from "@/lib/api/response";
import User from "@/models/user";
import DrillAssignment from "@/models/drill-assignment";
import {
  resolveDrillBuilderWeekCount,
  incrementDrillBuilderWeekCount,
  deleteStudentWeeks,
  updateStudentWeekDates,
  weekNumberFromAssignment,
  resolveWeekDisplayDates,
} from "@/lib/ai-drill-builder/resolve-drill-builder-weeks";

async function getHandler(
  _req: NextRequest,
  _context: { userId: string; userRole: string },
  params: { studentId: string },
): Promise<NextResponse> {
  try {
    const { studentId } = params;

    if (!isValidUserId(studentId)) {
      return NextResponse.json(
        { code: "ValidationError", message: "Invalid student ID" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const learnerIdQuery = toUserIdQuery(studentId);

    const user = await User.findById(studentId).lean();
    if (!user) {
      return NextResponse.json(
        { code: "NotFoundError", message: "Student not found" },
        { status: 404 },
      );
    }

    const { anchor, weekCount: currentWeek } =
      await resolveDrillBuilderWeekCount({
        learnerId: studentId,
        user,
      });

    const assignments = await DrillAssignment.find({
      learnerId: learnerIdQuery,
      source: { $ne: "precision_clinic" },
    })
      .populate(
        "drillId",
        "title type difficulty learning_journey_topic learning_journey_part is_active is_bookmarked",
      )
      .lean();

    const weekMap = new Map<number, object[]>();

    for (const assignment of assignments) {
      const weekNumber = weekNumberFromAssignment(assignment, anchor);

      const drill = (assignment as { drillId?: Record<string, unknown> })
        .drillId as
        | {
            _id?: unknown;
            title?: string | null;
            type?: string | null;
            difficulty?: string | null;
            learning_journey_topic?: string | null;
            learning_journey_part?: string | null;
            is_active?: boolean;
            is_bookmarked?: boolean;
          }
        | null
        | undefined;

      const entry = {
        type: "drill_assignment" as const,
        assignmentId: (assignment as { _id: unknown })._id,
        drillId: drill?._id ?? null,
        title: drill?.title ?? null,
        drillType: drill?.type ?? null,
        difficulty: drill?.difficulty ?? null,
        topic: drill?.learning_journey_topic ?? null,
        part: drill?.learning_journey_part ?? null,
        status: (assignment as { status?: string }).status,
        // A drill saved with `is_active: false` still needs a tutor/admin to
        // select users and update/assign it before learners can act on it.
        isActive: drill?.is_active ?? true,
        isBookmarked: Boolean(drill?.is_bookmarked),
        assignedAt: (assignment as { assignedAt?: Date }).assignedAt,
        builderWeekNumber:
          (assignment as { builderWeekNumber?: number | null })
            .builderWeekNumber ?? weekNumber,
        dueDate: (assignment as { dueDate?: Date | null }).dueDate ?? null,
        completedAt:
          (assignment as { completedAt?: Date | null }).completedAt ?? null,
      };

      const existing = weekMap.get(weekNumber);
      if (existing) {
        existing.push(entry);
      } else {
        weekMap.set(weekNumber, [entry]);
      }
    }

    const weeks = [];
    const dateOverrides = (
      user as {
        drillBuilderWeekDates?: Array<{
          weekNumber?: number;
          weekStartDate?: Date | string;
          weekEndDate?: Date | string;
        }>;
      }
    ).drillBuilderWeekDates;
    for (let weekNumber = 1; weekNumber <= currentWeek; weekNumber++) {
      const { weekStartDate, weekEndDate } = resolveWeekDisplayDates(
        weekNumber,
        anchor,
        dateOverrides,
      );
      const items = weekMap.get(weekNumber) ?? [];
      weeks.push({
        weekNumber,
        weekStartDate: weekStartDate.toISOString(),
        weekEndDate: weekEndDate.toISOString(),
        drills: items,
        items,
      });
    }

    logger.info("Fetched student weekly drill breakdown", {
      studentId,
      weekCount: weeks.length,
      currentWeek,
    });

    return NextResponse.json(
      {
        code: "Success",
        data: {
          anchorDate: anchor.toISOString(),
          currentWeek,
          weeks,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error fetching student weeks", { error: message });
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Failed to fetch student weeks",
        error: message,
      },
      { status: 500 },
    );
  }
}

async function postHandler(
  _req: NextRequest,
  _context: { userId: string; userRole: string },
  params: { studentId: string },
): Promise<NextResponse> {
  try {
    const { studentId } = params;

    if (!isValidUserId(studentId)) {
      return NextResponse.json(
        { code: "ValidationError", message: "Invalid student ID" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const user = await User.findById(studentId).select("_id").lean();
    if (!user) {
      return NextResponse.json(
        { code: "NotFoundError", message: "Student not found" },
        { status: 404 },
      );
    }

    const created = await incrementDrillBuilderWeekCount(studentId);

    logger.info("Created next drill-builder week for student", {
      studentId,
      weekNumber: created.weekNumber,
      currentWeek: created.weekCount,
    });

    return NextResponse.json(
      {
        code: "Success",
        data: {
          weekNumber: created.weekNumber,
          weekStartDate: created.weekStartDate.toISOString(),
          weekEndDate: created.weekEndDate.toISOString(),
          currentWeek: created.weekCount,
          anchorDate: created.anchor.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error creating student week", { error: message });
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Failed to create student week",
        error: message,
      },
      { status: 500 },
    );
  }
}

async function deleteHandler(
  req: NextRequest,
  _context: { userId: string; userRole: string },
  params: { studentId: string },
): Promise<NextResponse> {
  try {
    const { studentId } = params;

    if (!isValidUserId(studentId)) {
      return NextResponse.json(
        { code: "ValidationError", message: "Invalid student ID" },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => null);
    const weekNumbers = body?.weekNumbers;

    if (!Array.isArray(weekNumbers) || weekNumbers.length === 0) {
      return NextResponse.json(
        {
          code: "ValidationError",
          message: "weekNumbers must be a non-empty array",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const data = await deleteStudentWeeks({
      learnerId: studentId,
      weekNumbers,
    });

    logger.info("Deleted student drill-builder weeks", {
      studentId,
      deletedWeekNumbers: data.deletedWeekNumbers,
      weekCount: data.weekCount,
      remappedAssignmentCount: data.remappedAssignmentCount,
    });

    return NextResponse.json({ code: "Success", data }, { status: 200 });
  } catch (error: unknown) {
    if (isValidationError(error)) {
      return NextResponse.json(
        { code: "ValidationError", message: error.message },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.name === "NotFoundError") {
      return NextResponse.json(
        { code: "NotFoundError", message: error.message },
        { status: 404 },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error deleting student weeks", { error: message });
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Failed to delete weeks",
        error: message,
      },
      { status: 500 },
    );
  }
}

async function patchHandler(
  req: NextRequest,
  _context: { userId: string; userRole: string },
  params: { studentId: string },
): Promise<NextResponse> {
  try {
    const { studentId } = params;

    if (!isValidUserId(studentId)) {
      return NextResponse.json(
        { code: "ValidationError", message: "Invalid student ID" },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => null);
    const weekNumber = body?.weekNumber;
    const weekStartDate = body?.weekStartDate;
    const weekEndDate = body?.weekEndDate;

    if (
      typeof weekNumber !== "number" ||
      typeof weekStartDate !== "string" ||
      typeof weekEndDate !== "string"
    ) {
      return NextResponse.json(
        {
          code: "ValidationError",
          message:
            "weekNumber, weekStartDate, and weekEndDate are required",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const data = await updateStudentWeekDates({
      learnerId: studentId,
      weekNumber,
      weekStartDate,
      weekEndDate,
    });

    logger.info("Updated student drill-builder week dates", {
      studentId,
      weekNumber: data.weekNumber,
    });

    return NextResponse.json(
      {
        code: "Success",
        data: {
          weekNumber: data.weekNumber,
          weekStartDate: data.weekStartDate.toISOString(),
          weekEndDate: data.weekEndDate.toISOString(),
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    if (isValidationError(error)) {
      return NextResponse.json(
        { code: "ValidationError", message: error.message },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.name === "NotFoundError") {
      return NextResponse.json(
        { code: "NotFoundError", message: error.message },
        { status: 404 },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error updating student week dates", { error: message });
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Failed to update week dates",
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const resolvedParams = await params;
  return withRole(["admin", "tutor"], (req, context) =>
    getHandler(req, context, resolvedParams),
  )(req);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const resolvedParams = await params;
  return withRole(["admin", "tutor"], (req, context) =>
    postHandler(req, context, resolvedParams),
  )(req);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const resolvedParams = await params;
  return withRole(["admin", "tutor"], (req, context) =>
    patchHandler(req, context, resolvedParams),
  )(req);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const resolvedParams = await params;
  return withRole(["admin", "tutor"], (req, context) =>
    deleteHandler(req, context, resolvedParams),
  )(req);
}
