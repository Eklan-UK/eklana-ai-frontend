import { Types } from "mongoose";
import User from "@/models/user";
import DrillAssignment from "@/models/drill-assignment";
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

export async function getAssignmentMaxWeek(
  learnerId: Types.ObjectId | string,
  anchor: Date,
): Promise<number> {
  const assignments = await DrillAssignment.find({ learnerId })
    .select("assignedAt")
    .lean()
    .exec();

  let maxWeek = 0;
  for (const assignment of assignments) {
    const assignedAt = (assignment as { assignedAt?: Date }).assignedAt;
    if (!assignedAt) continue;
    maxWeek = Math.max(maxWeek, weekNumberFromAssignedAt(assignedAt, anchor));
  }
  return maxWeek;
}

/**
 * Resolve the Drill Builder week count for a learner.
 * Lazily seeds `drillBuilderWeekCount` from max(timeBased, assignmentMax, 1)
 * so existing visible weeks are preserved, then stops auto time-expansion.
 */
export async function resolveDrillBuilderWeekCount(params: {
  learnerId: Types.ObjectId | string;
  /** When provided, skips a re-fetch of the user document. */
  user?: {
    _id?: Types.ObjectId | string;
    drillBuilderWeekCount?: number | null;
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
      .select("subscriptionActivatedAt createdAt drillBuilderWeekCount")
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
    typeof user.drillBuilderWeekCount === "number" &&
    Number.isFinite(user.drillBuilderWeekCount)
      ? Math.max(1, Math.floor(user.drillBuilderWeekCount))
      : null;

  if (stored == null) {
    const weekCount = Math.max(timeBasedWeek, assignmentMaxWeek, 1);
    await User.updateOne(
      { _id: params.learnerId },
      { $set: { drillBuilderWeekCount: weekCount } },
    ).exec();
    return { anchor, weekCount, seeded: true };
  }

  // Safety: never hide weeks that already have assignments.
  if (assignmentMaxWeek > stored) {
    await User.updateOne(
      { _id: params.learnerId },
      { $set: { drillBuilderWeekCount: assignmentMaxWeek } },
    ).exec();
    return { anchor, weekCount: assignmentMaxWeek, seeded: false };
  }

  return { anchor, weekCount: stored, seeded: false };
}

export async function incrementDrillBuilderWeekCount(
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
  const resolved = await resolveDrillBuilderWeekCount({ learnerId });
  const weekCount = resolved.weekCount + 1;

  await User.updateOne(
    { _id: learnerId },
    { $set: { drillBuilderWeekCount: weekCount } },
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
