import { Types } from "mongoose";
import User from "@/models/user";
import DrillAssignment from "@/models/drill-assignment";
import { toUserIdQuery } from "@/lib/api/user-id";
import {
  WEEK_MS,
  getAssignedAtForWeek,
  getWeekDateRange,
} from "@/lib/ai-drill-builder/week-utils";

export { WEEK_MS, getAssignedAtForWeek, getWeekDateRange };

export function getLearnerAnchor(user: {
  subscriptionActivatedAt?: Date | string | null;
  createdAt?: Date | string | null;
}): Date {
  const raw = user.subscriptionActivatedAt ?? user.createdAt ?? new Date();
  return new Date(raw);
}

export function getTimeBasedWeek(anchor: Date, now = Date.now()): number {
  return Math.max(1, Math.ceil((now - anchor.getTime()) / WEEK_MS));
}

export function weekNumberFromAssignedAt(
  assignedAt: Date,
  anchor: Date,
): number {
  return Math.max(
    1,
    Math.ceil((assignedAt.getTime() - anchor.getTime()) / WEEK_MS),
  );
}

/**
 * Prefer explicit builder week placement; fall back to assignedAt-derived week
 * for legacy assignments that predate `builderWeekNumber`.
 */
function coercePositiveInt(value: unknown): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 1
  ) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 1) return n;
  }
  return null;
}

export function weekNumberFromAssignment(
  assignment: {
    builderWeekNumber?: number | null;
    assignedAt?: Date | string | null;
  },
  anchor: Date,
): number {
  const explicit = coercePositiveInt(assignment.builderWeekNumber);
  if (explicit != null) {
    return explicit;
  }
  const assignedAt = assignment.assignedAt
    ? new Date(assignment.assignedAt)
    : null;
  if (!assignedAt || Number.isNaN(assignedAt.getTime())) {
    return 1;
  }
  return weekNumberFromAssignedAt(assignedAt, anchor);
}

export async function getAssignmentMaxWeek(
  learnerId: Types.ObjectId | string,
  anchor: Date,
): Promise<number> {
  const assignments = await DrillAssignment.find({
    learnerId: toUserIdQuery(learnerId),
    source: "precision_clinic",
  })
    .select("assignedAt builderWeekNumber")
    .lean()
    .exec();

  let maxWeek = 0;
  for (const assignment of assignments) {
    maxWeek = Math.max(maxWeek, weekNumberFromAssignment(assignment, anchor));
  }
  return maxWeek;
}

/**
 * Resolve the Precision Clinic week count for a learner.
 * Lazily seeds `precisionClinicWeekCount` from max(timeBased, assignmentMax, 1)
 * so existing visible weeks are preserved, then stops auto time-expansion.
 * Mirrors `resolveDrillBuilderWeekCount`, scoped to `source: 'precision_clinic'`.
 */
export async function resolvePrecisionClinicWeekCount(params: {
  learnerId: Types.ObjectId | string;
  /** When provided, skips a re-fetch of the user document. */
  user?: {
    _id?: Types.ObjectId | string;
    precisionClinicWeekCount?: number | null;
    subscriptionActivatedAt?: Date | string | null;
    createdAt?: Date | string | null;
  } | null;
}): Promise<{
  anchor: Date;
  weekCount: number;
  seeded: boolean;
}> {
  const user =
    params.user ??
    (await User.findById(params.learnerId)
      .select("subscriptionActivatedAt createdAt precisionClinicWeekCount")
      .lean()
      .exec());

  if (!user) {
    throw new Error("Student not found");
  }

  const anchor = getLearnerAnchor(user);
  const timeBasedWeek = getTimeBasedWeek(anchor);
  const assignmentMaxWeek = await getAssignmentMaxWeek(
    params.learnerId,
    anchor,
  );

  const stored =
    typeof user.precisionClinicWeekCount === "number" &&
    Number.isFinite(user.precisionClinicWeekCount)
      ? Math.max(1, Math.floor(user.precisionClinicWeekCount))
      : null;

  if (stored == null) {
    const weekCount = Math.max(timeBasedWeek, assignmentMaxWeek, 1);
    await User.updateOne(
      { _id: params.learnerId },
      { $set: { precisionClinicWeekCount: weekCount } },
    ).exec();
    return { anchor, weekCount, seeded: true };
  }

  // Safety: never hide weeks that already have assignments.
  if (assignmentMaxWeek > stored) {
    await User.updateOne(
      { _id: params.learnerId },
      { $set: { precisionClinicWeekCount: assignmentMaxWeek } },
    ).exec();
    return { anchor, weekCount: assignmentMaxWeek, seeded: false };
  }

  return { anchor, weekCount: stored, seeded: false };
}

export async function incrementPrecisionClinicWeekCount(
  learnerId: Types.ObjectId | string,
): Promise<{
  anchor: Date;
  weekCount: number;
  weekNumber: number;
  weekStartDate: Date;
  weekEndDate: Date;
}> {
  // Ensure lazy seed runs before increment so we don't jump from unset → 1
  // and drop previously visible time-based weeks.
  const resolved = await resolvePrecisionClinicWeekCount({ learnerId });
  const weekCount = resolved.weekCount + 1;

  await User.updateOne(
    { _id: learnerId },
    { $set: { precisionClinicWeekCount: weekCount } },
  ).exec();

  const { weekStartDate, weekEndDate } = getWeekDateRange(
    weekCount,
    resolved.anchor,
  );

  return {
    anchor: resolved.anchor,
    weekCount,
    weekNumber: weekCount,
    weekStartDate,
    weekEndDate,
  };
}
