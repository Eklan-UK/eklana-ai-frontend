// GET    /api/v1/precision-clinic/students/[studentId]/weeks — per-student virtual week breakdown
// POST   /api/v1/precision-clinic/students/[studentId]/weeks — add the next week ("+ Week")
// DELETE /api/v1/precision-clinic/students/[studentId]/weeks — delete empty weeks and compact
import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { withErrorHandler } from "@/lib/api/error-handler";
import { connectToDatabase } from "@/lib/api/db";
import { apiResponse, NotFoundError, ValidationError } from "@/lib/api/response";
import { isValidUserId, toUserIdQuery } from "@/lib/api/user-id";
import { logger } from "@/lib/api/logger";
import {
  assertStaffCanReadLearner,
  resolveLearnerIdToUserIdString,
} from "@/lib/api/staff-learner-access";
import User from "@/models/user";
import DrillAssignment from "@/models/drill-assignment";
import {
  resolvePrecisionClinicWeekCount,
  incrementPrecisionClinicWeekCount,
  deletePrecisionClinicStudentWeeks,
  weekNumberFromAssignment,
  getWeekDateRange,
} from "@/lib/precision-clinic/resolve-precision-clinic-weeks";

async function assertStudentAccess(
  context: { userId: string; userRole: string },
  studentId: string,
): Promise<string> {
  const canonicalLearnerId = await resolveLearnerIdToUserIdString(studentId);
  const access = await assertStaffCanReadLearner(context, canonicalLearnerId);
  if (access === "forbidden") {
    throw new NotFoundError("Student");
  }
  return canonicalLearnerId;
}

async function getHandler(
  _req: NextRequest,
  context: { userId: string; userRole: string },
  params: { studentId: string },
) {
  const { studentId } = params;

  if (!isValidUserId(studentId)) {
    throw new ValidationError("Invalid student ID");
  }

  await connectToDatabase();

  const learnerId = await assertStudentAccess(context, studentId);
  const learnerIdQuery = toUserIdQuery(learnerId);

  const user = await User.findById(learnerId).lean();
  if (!user) {
    throw new NotFoundError("Student");
  }

  const { anchor, weekCount: currentWeek } =
    await resolvePrecisionClinicWeekCount({
      learnerId,
      user,
    });

  const assignments = await DrillAssignment.find({
    learnerId: learnerIdQuery,
    source: "precision_clinic",
  })
    .populate(
      "drillId",
      "title type difficulty learning_journey_topic learning_journey_part is_active is_bookmarked",
    )
    .lean()
    .exec();

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
  for (let weekNumber = 1; weekNumber <= currentWeek; weekNumber++) {
    const { weekStartDate, weekEndDate } = getWeekDateRange(weekNumber, anchor);
    const items = weekMap.get(weekNumber) ?? [];
    weeks.push({
      weekNumber,
      weekStartDate: weekStartDate.toISOString(),
      weekEndDate: weekEndDate.toISOString(),
      drills: items,
    });
  }

  logger.info("Fetched precision clinic student weekly breakdown", {
    studentId: learnerId,
    weekCount: weeks.length,
    currentWeek,
  });

  return apiResponse.success({
    anchorDate: anchor.toISOString(),
    currentWeek,
    weeks,
  });
}

async function postHandler(
  _req: NextRequest,
  context: { userId: string; userRole: string },
  params: { studentId: string },
) {
  const { studentId } = params;

  if (!isValidUserId(studentId)) {
    throw new ValidationError("Invalid student ID");
  }

  await connectToDatabase();

  const learnerId = await assertStudentAccess(context, studentId);

  const user = await User.findById(learnerId).select("_id").lean();
  if (!user) {
    throw new NotFoundError("Student");
  }

  const created = await incrementPrecisionClinicWeekCount(learnerId);

  logger.info("Created next precision clinic week for student", {
    studentId: learnerId,
    weekNumber: created.weekNumber,
    currentWeek: created.weekCount,
  });

  return apiResponse.success(
    {
      weekNumber: created.weekNumber,
      weekStartDate: created.weekStartDate.toISOString(),
      weekEndDate: created.weekEndDate.toISOString(),
      currentWeek: created.weekCount,
      anchorDate: created.anchor.toISOString(),
    },
    201,
  );
}

async function deleteHandler(
  req: NextRequest,
  context: { userId: string; userRole: string },
  params: { studentId: string },
) {
  const { studentId } = params;

  if (!isValidUserId(studentId)) {
    throw new ValidationError("Invalid student ID");
  }

  const body = await req.json().catch(() => null);
  const weekNumbers = body?.weekNumbers;

  if (!Array.isArray(weekNumbers) || weekNumbers.length === 0) {
    throw new ValidationError("weekNumbers must be a non-empty array");
  }

  await connectToDatabase();

  const learnerId = await assertStudentAccess(context, studentId);

  const data = await deletePrecisionClinicStudentWeeks({
    learnerId,
    weekNumbers,
  });

  logger.info("Deleted precision clinic student weeks", {
    studentId: learnerId,
    deletedWeekNumbers: data.deletedWeekNumbers,
    weekCount: data.weekCount,
    remappedAssignmentCount: data.remappedAssignmentCount,
  });

  return apiResponse.success(data);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const resolvedParams = await params;
  return withRole(
    ["admin", "tutor"],
    withErrorHandler((r, c) => getHandler(r, c, resolvedParams)),
  )(req);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const resolvedParams = await params;
  return withRole(
    ["admin", "tutor"],
    withErrorHandler((r, c) => postHandler(r, c, resolvedParams)),
  )(req);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const resolvedParams = await params;
  return withRole(
    ["admin", "tutor"],
    withErrorHandler((r, c) => deleteHandler(r, c, resolvedParams)),
  )(req);
}
