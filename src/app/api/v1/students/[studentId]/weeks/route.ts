import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import { logger } from "@/lib/api/logger";
import { Types } from "mongoose";
import User from "@/models/user";
import DrillAssignment from "@/models/drill-assignment";
import {
  resolveDrillBuilderWeekCount,
  incrementDrillBuilderWeekCount,
  weekNumberFromAssignedAt,
} from "@/lib/ai-drill-builder/resolve-drill-builder-weeks";
import { WEEK_MS } from "@/lib/ai-drill-builder/week-utils";

async function getHandler(
  _req: NextRequest,
  _context: { userId: any; userRole: string },
  params: { studentId: string },
): Promise<NextResponse> {
  try {
    const { studentId } = params;

    if (!Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { code: "ValidationError", message: "Invalid student ID" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const learnerObjectId = new Types.ObjectId(studentId);

    const user = await User.findById(learnerObjectId).lean();
    if (!user) {
      return NextResponse.json(
        { code: "NotFoundError", message: "Student not found" },
        { status: 404 },
      );
    }

    const { anchor, weekCount: currentWeek } =
      await resolveDrillBuilderWeekCount({
        learnerId: learnerObjectId,
        user,
      });

    const assignments = await DrillAssignment.find({ learnerId: learnerObjectId })
      .populate(
        "drillId",
        "title type difficulty learning_journey_topic learning_journey_part is_active is_bookmarked",
      )
      .lean();

    const weekMap = new Map<number, object[]>();

    for (const assignment of assignments) {
      const assignedAt: Date = (assignment as any).assignedAt;
      const weekNumber = weekNumberFromAssignedAt(assignedAt, anchor);

      const drill = (assignment as any).drillId as any;

      const entry = {
        type: "drill_assignment" as const,
        assignmentId: (assignment as any)._id,
        drillId: drill?._id ?? null,
        title: drill?.title ?? null,
        drillType: drill?.type ?? null,
        difficulty: drill?.difficulty ?? null,
        topic: drill?.learning_journey_topic ?? null,
        part: drill?.learning_journey_part ?? null,
        status: (assignment as any).status,
        // A drill saved with `is_active: false` still needs a tutor/admin to
        // select users and update/assign it before learners can act on it.
        isActive: drill?.is_active ?? true,
        isBookmarked: Boolean(drill?.is_bookmarked),
        assignedAt: (assignment as any).assignedAt,
        dueDate: (assignment as any).dueDate ?? null,
        completedAt: (assignment as any).completedAt ?? null,
      };

      const existing = weekMap.get(weekNumber);
      if (existing) {
        existing.push(entry);
      } else {
        weekMap.set(weekNumber, [entry]);
      }
    }

    const weeks = [];
    for (let weekNumber = 1; weekNumber <= currentWeek; weekNumber++) {
      const weekStartDate = new Date(
        anchor.getTime() + (weekNumber - 1) * WEEK_MS,
      );
      const weekEndDate = new Date(
        anchor.getTime() + weekNumber * WEEK_MS - 1,
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
  } catch (error: any) {
    logger.error("Error fetching student weeks", { error: error.message });
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Failed to fetch student weeks",
        error: error.message,
      },
      { status: 500 },
    );
  }
}

async function postHandler(
  _req: NextRequest,
  _context: { userId: any; userRole: string },
  params: { studentId: string },
): Promise<NextResponse> {
  try {
    const { studentId } = params;

    if (!Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { code: "ValidationError", message: "Invalid student ID" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const learnerObjectId = new Types.ObjectId(studentId);

    const user = await User.findById(learnerObjectId).select("_id").lean();
    if (!user) {
      return NextResponse.json(
        { code: "NotFoundError", message: "Student not found" },
        { status: 404 },
      );
    }

    const created = await incrementDrillBuilderWeekCount(learnerObjectId);

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
  } catch (error: any) {
    logger.error("Error creating student week", { error: error.message });
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Failed to create student week",
        error: error.message,
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
