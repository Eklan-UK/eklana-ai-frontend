// GET  /api/v1/precision-clinic/students/[studentId]/weeks — per-student virtual week breakdown
// POST /api/v1/precision-clinic/students/[studentId]/weeks — add the next week ("+ Week")
import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { withErrorHandler } from "@/lib/api/error-handler";
import { connectToDatabase } from "@/lib/api/db";
import { apiResponse, NotFoundError, ValidationError } from "@/lib/api/response";
import { isValidUserId, toUserIdQuery } from "@/lib/api/user-id";
import { logger } from "@/lib/api/logger";
import User from "@/models/user";
import DrillAssignment from "@/models/drill-assignment";
import {
  resolvePrecisionClinicWeekCount,
  incrementPrecisionClinicWeekCount,
  weekNumberFromAssignment,
  getWeekDateRange,
} from "@/lib/precision-clinic/resolve-precision-clinic-weeks";

async function getHandler(
  _req: NextRequest,
  _context: { userId: string; userRole: string },
  params: { studentId: string },
) {
  const { studentId } = params;

  if (!isValidUserId(studentId)) {
    throw new ValidationError("Invalid student ID");
  }

  await connectToDatabase();

  const learnerIdQuery = toUserIdQuery(studentId);

  const user = await User.findById(studentId).lean();
  if (!user) {
    throw new NotFoundError("Student");
  }

  const { anchor, weekCount: currentWeek } =
    await resolvePrecisionClinicWeekCount({
      learnerId: studentId,
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
    studentId,
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
  _context: { userId: string; userRole: string },
  params: { studentId: string },
) {
  const { studentId } = params;

  if (!isValidUserId(studentId)) {
    throw new ValidationError("Invalid student ID");
  }

  await connectToDatabase();

  const user = await User.findById(studentId).select("_id").lean();
  if (!user) {
    throw new NotFoundError("Student");
  }

  const created = await incrementPrecisionClinicWeekCount(studentId);

  logger.info("Created next precision clinic week for student", {
    studentId,
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const resolvedParams = await params;
  return withRole(
    ["admin"],
    withErrorHandler((r, c) => getHandler(r, c, resolvedParams)),
  )(req);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const resolvedParams = await params;
  return withRole(
    ["admin"],
    withErrorHandler((r, c) => postHandler(r, c, resolvedParams)),
  )(req);
}
