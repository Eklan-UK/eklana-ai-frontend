import { Types } from "mongoose";
import User from "@/models/user";
import DrillAssignment from "@/models/drill-assignment";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { toUserIdCandidates, toUserIdQuery } from "@/lib/api/user-id";
import {
  WEEK_MS,
  getAssignedAtForWeek,
  getWeekDateRange,
  parseLocalCalendarDate,
} from "@/lib/ai-drill-builder/week-utils";

export type DrillBuilderWeekDateRow = {
  weekNumber: number;
  weekStartDate: Date;
  weekEndDate: Date;
};

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

export function remapDrillBuilderWeekDates(
  dates: Array<{
    weekNumber?: number;
    weekStartDate?: Date | string;
    weekEndDate?: Date | string;
  }> | null | undefined,
  remap: Map<number, number>,
): DrillBuilderWeekDateRow[] {
  if (!dates?.length) return [];
  const remapped: DrillBuilderWeekDateRow[] = [];
  for (const row of dates) {
    const oldWeek = coercePositiveInt(row.weekNumber);
    if (oldWeek == null) continue;
    const newWeek = remap.get(oldWeek);
    if (newWeek == null) continue;
    const weekStartDate = row.weekStartDate
      ? new Date(row.weekStartDate)
      : null;
    const weekEndDate = row.weekEndDate ? new Date(row.weekEndDate) : null;
    if (
      !weekStartDate ||
      !weekEndDate ||
      Number.isNaN(weekStartDate.getTime()) ||
      Number.isNaN(weekEndDate.getTime())
    ) {
      continue;
    }
    remapped.push({
      weekNumber: newWeek,
      weekStartDate,
      weekEndDate,
    });
  }
  remapped.sort((a, b) => a.weekNumber - b.weekNumber);
  return remapped;
}

export function resolveWeekDisplayDates(
  weekNumber: number,
  anchor: Date,
  overrides?: Array<{
    weekNumber?: number;
    weekStartDate?: Date | string;
    weekEndDate?: Date | string;
  }> | null,
): { weekStartDate: Date; weekEndDate: Date } {
  const override = overrides?.find(
    (row) => coercePositiveInt(row.weekNumber) === weekNumber,
  );
  if (override?.weekStartDate && override?.weekEndDate) {
    const weekStartDate = new Date(override.weekStartDate);
    const weekEndDate = new Date(override.weekEndDate);
    if (
      !Number.isNaN(weekStartDate.getTime()) &&
      !Number.isNaN(weekEndDate.getTime())
    ) {
      return { weekStartDate, weekEndDate };
    }
  }
  return getWeekDateRange(weekNumber, anchor);
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
    source: { $ne: "precision_clinic" },
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
    drillBuilderWeekDates?: Array<{
      weekNumber: number;
      weekStartDate: Date;
      weekEndDate: Date;
    }> | null;
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
      .select(
        "subscriptionActivatedAt createdAt drillBuilderWeekCount drillBuilderWeekDates",
      )
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

/**
 * Move a learner's drill assignments into an existing builder week slot by
 * updating `builderWeekNumber` only. Does not touch assignedAt, dueDate,
 * status, completedAt, or drill documents — arrangement-only for the AI Drill
 * Builder, leaving Weekly Challenge / timing features unchanged.
 */
export async function moveStudentWeekDrills(params: {
  learnerId: string;
  assignmentIds: string[];
  targetWeekNumber: number;
}): Promise<{ movedCount: number; targetWeekNumber: number }> {
  const { learnerId, assignmentIds, targetWeekNumber } = params;

  if (!Array.isArray(assignmentIds) || assignmentIds.length === 0) {
    throw new ValidationError("assignmentIds must be a non-empty array");
  }

  if (
    typeof targetWeekNumber !== "number" ||
    !Number.isFinite(targetWeekNumber) ||
    !Number.isInteger(targetWeekNumber) ||
    targetWeekNumber < 1
  ) {
    throw new ValidationError("targetWeekNumber must be a positive integer");
  }

  const invalidAssignmentIds = assignmentIds.filter(
    (id) => typeof id !== "string" || !Types.ObjectId.isValid(id),
  );
  if (invalidAssignmentIds.length > 0) {
    throw new ValidationError("One or more assignmentIds are invalid");
  }

  const user = await User.findById(learnerId)
    .select(
      "subscriptionActivatedAt createdAt drillBuilderWeekCount drillBuilderWeekDates",
    )
    .lean()
    .exec();

  if (!user) {
    throw new NotFoundError("Student");
  }

  const { weekCount } = await resolveDrillBuilderWeekCount({
    learnerId,
    user,
  });

  if (targetWeekNumber > weekCount) {
    throw new ValidationError(
      `targetWeekNumber must be between 1 and ${weekCount}`,
    );
  }

  const assignmentObjectIds = assignmentIds.map(
    (id) => new Types.ObjectId(id),
  );

  // Use the native collection so a stale Mongoose schema (common under Next.js
  // HMR before model re-registration) cannot silently strip builderWeekNumber
  // under strict mode while still reporting matchedCount > 0.
  const filter = {
    learnerId: { $in: toUserIdCandidates(learnerId) },
    _id: { $in: assignmentObjectIds },
  };

  const result = await DrillAssignment.collection.updateMany(filter, {
    $set: { builderWeekNumber: targetWeekNumber },
  });

  if (result.matchedCount === 0) {
    throw new ValidationError(
      "No matching assignments found for this student",
    );
  }

  const verify = await DrillAssignment.collection
    .find(filter)
    .project({ builderWeekNumber: 1 })
    .toArray();

  const failed = verify.filter(
    (doc) => coercePositiveInt(doc.builderWeekNumber) !== targetWeekNumber,
  );
  if (failed.length > 0) {
    throw new Error(
      `Failed to persist builderWeekNumber=${targetWeekNumber} for ${failed.length} assignment(s)`,
    );
  }

  return {
    movedCount: result.matchedCount,
    targetWeekNumber,
  };
}

/**
 * Delete empty builder week slots and compact remaining weeks to 1..N.
 * Weeks with drills are rejected. Does not modify assignedAt.
 */
export async function deleteStudentWeeks(params: {
  learnerId: string;
  weekNumbers: number[];
}): Promise<{
  deletedWeekNumbers: number[];
  weekCount: number;
  remappedAssignmentCount: number;
}> {
  const { learnerId, weekNumbers } = params;

  if (!Array.isArray(weekNumbers) || weekNumbers.length === 0) {
    throw new ValidationError("weekNumbers must be a non-empty array");
  }

  const uniqueWeeks = [
    ...new Set(
      weekNumbers.map((w) => {
        if (typeof w !== "number" || !Number.isFinite(w) || !Number.isInteger(w) || w < 1) {
          throw new ValidationError(
            "weekNumbers must be an array of positive integers",
          );
        }
        return w;
      }),
    ),
  ].sort((a, b) => a - b);

  const user = await User.findById(learnerId)
    .select(
      "subscriptionActivatedAt createdAt drillBuilderWeekCount drillBuilderWeekDates",
    )
    .lean()
    .exec();

  if (!user) {
    throw new NotFoundError("Student");
  }

  const { anchor, weekCount } = await resolveDrillBuilderWeekCount({
    learnerId,
    user,
  });

  for (const weekNumber of uniqueWeeks) {
    if (weekNumber > weekCount) {
      throw new ValidationError(
        `Week ${weekNumber} does not exist (student has ${weekCount} week${weekCount === 1 ? "" : "s"})`,
      );
    }
  }

  if (uniqueWeeks.length >= weekCount) {
    throw new ValidationError("Cannot delete all weeks; at least one week must remain");
  }

  const assignments = await DrillAssignment.find({
    learnerId: toUserIdQuery(learnerId),
    source: { $ne: "precision_clinic" },
  })
    .select("_id assignedAt builderWeekNumber")
    .lean()
    .exec();

  const countsByWeek = new Map<number, number>();
  for (const assignment of assignments) {
    const week = weekNumberFromAssignment(assignment, anchor);
    countsByWeek.set(week, (countsByWeek.get(week) ?? 0) + 1);
  }

  const nonEmpty = uniqueWeeks.filter((w) => (countsByWeek.get(w) ?? 0) > 0);
  if (nonEmpty.length > 0) {
    throw new ValidationError(
      `Cannot delete week${nonEmpty.length === 1 ? "" : "s"} ${nonEmpty.join(", ")}: move or remove drills first`,
    );
  }

  const deletedSet = new Set(uniqueWeeks);
  const remainingWeeks: number[] = [];
  for (let w = 1; w <= weekCount; w++) {
    if (!deletedSet.has(w)) remainingWeeks.push(w);
  }

  // oldWeek -> newWeek after compacting to 1..remaining.length
  const remap = new Map<number, number>();
  remainingWeeks.forEach((oldWeek, index) => {
    remap.set(oldWeek, index + 1);
  });

  let remappedAssignmentCount = 0;
  const bulkOps: Array<{
    updateOne: {
      filter: { _id: Types.ObjectId };
      update: { $set: { builderWeekNumber: number } };
    };
  }> = [];

  for (const assignment of assignments) {
    const oldWeek = weekNumberFromAssignment(assignment, anchor);
    const newWeek = remap.get(oldWeek);
    if (newWeek == null) continue;
    // Persist explicit week after compact so bucketing no longer depends on
    // assignedAt (and legacy rows get a stable builderWeekNumber).
    if (coercePositiveInt(assignment.builderWeekNumber) !== newWeek) {
      bulkOps.push({
        updateOne: {
          filter: { _id: assignment._id as Types.ObjectId },
          update: { $set: { builderWeekNumber: newWeek } },
        },
      });
    }
  }

  if (bulkOps.length > 0) {
    // Native bulkWrite avoids silent strict-mode strips from a stale schema.
    const bulkResult = await DrillAssignment.collection.bulkWrite(bulkOps, {
      ordered: false,
    });
    remappedAssignmentCount = bulkResult.modifiedCount;
  }

  const newWeekCount = remainingWeeks.length;
  const userUpdate: {
    drillBuilderWeekCount: number;
    drillBuilderWeekDates?: DrillBuilderWeekDateRow[];
  } = { drillBuilderWeekCount: newWeekCount };

  const existingDates = (
    user as {
      drillBuilderWeekDates?: Array<{
        weekNumber?: number;
        weekStartDate?: Date | string;
        weekEndDate?: Date | string;
      }>;
    }
  ).drillBuilderWeekDates;
  if (Array.isArray(existingDates) && existingDates.length > 0) {
    userUpdate.drillBuilderWeekDates = remapDrillBuilderWeekDates(
      existingDates,
      remap,
    );
  }

  await User.updateOne({ _id: learnerId }, { $set: userUpdate }).exec();

  return {
    deletedWeekNumbers: uniqueWeeks,
    weekCount: newWeekCount,
    remappedAssignmentCount,
  };
}

export function upsertDrillBuilderWeekDateRow(
  existing: Array<{
    weekNumber?: number;
    weekStartDate?: Date | string;
    weekEndDate?: Date | string;
  }> | null | undefined,
  row: DrillBuilderWeekDateRow,
): DrillBuilderWeekDateRow[] {
  const next: DrillBuilderWeekDateRow[] = [];
  for (const current of existing ?? []) {
    const weekNumber = coercePositiveInt(current.weekNumber);
    if (weekNumber == null || weekNumber === row.weekNumber) continue;
    const weekStartDate = current.weekStartDate
      ? new Date(current.weekStartDate)
      : null;
    const weekEndDate = current.weekEndDate
      ? new Date(current.weekEndDate)
      : null;
    if (
      !weekStartDate ||
      !weekEndDate ||
      Number.isNaN(weekStartDate.getTime()) ||
      Number.isNaN(weekEndDate.getTime())
    ) {
      continue;
    }
    next.push({ weekNumber, weekStartDate, weekEndDate });
  }
  next.push(row);
  next.sort((a, b) => a.weekNumber - b.weekNumber);
  return next;
}

/**
 * Store display-only start/end dates for one Drill Builder week.
 * Does not write assignment dueDate / assignedAt / builderWeekNumber.
 */
export async function updateStudentWeekDates(params: {
  learnerId: string;
  weekNumber: number;
  weekStartDate: string;
  weekEndDate: string;
}): Promise<DrillBuilderWeekDateRow> {
  const { learnerId, weekNumber, weekStartDate: startRaw, weekEndDate: endRaw } =
    params;

  if (
    typeof weekNumber !== "number" ||
    !Number.isFinite(weekNumber) ||
    !Number.isInteger(weekNumber) ||
    weekNumber < 1
  ) {
    throw new ValidationError("weekNumber must be a positive integer");
  }

  const weekStartDate = parseLocalCalendarDate(startRaw, "start");
  const weekEndDate = parseLocalCalendarDate(endRaw, "end");
  if (!weekStartDate || !weekEndDate) {
    throw new ValidationError(
      "weekStartDate and weekEndDate must be valid YYYY-MM-DD dates",
    );
  }

  if (weekEndDate.getTime() < weekStartDate.getTime()) {
    throw new ValidationError("weekEndDate must be on or after weekStartDate");
  }

  const user = await User.findById(learnerId)
    .select(
      "subscriptionActivatedAt createdAt drillBuilderWeekCount drillBuilderWeekDates",
    )
    .lean()
    .exec();

  if (!user) {
    throw new NotFoundError("Student");
  }

  const { weekCount } = await resolveDrillBuilderWeekCount({
    learnerId,
    user,
  });

  if (weekNumber > weekCount) {
    throw new ValidationError(
      `Week ${weekNumber} does not exist (student has ${weekCount} week${weekCount === 1 ? "" : "s"})`,
    );
  }

  const nextDates = upsertDrillBuilderWeekDateRow(
    (
      user as {
        drillBuilderWeekDates?: Array<{
          weekNumber?: number;
          weekStartDate?: Date | string;
          weekEndDate?: Date | string;
        }>;
      }
    ).drillBuilderWeekDates,
    { weekNumber, weekStartDate, weekEndDate },
  );

  await User.updateOne(
    { _id: learnerId },
    { $set: { drillBuilderWeekDates: nextDates } },
  ).exec();

  return { weekNumber, weekStartDate, weekEndDate };
}
