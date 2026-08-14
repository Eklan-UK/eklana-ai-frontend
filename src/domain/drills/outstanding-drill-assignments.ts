/**
 * Shared definition of “outstanding” assigned drills for digest + daily nudge.
 *
 * Outstanding = assignment rows that still need student work (uncompleted or
 * in progress). Aligns with My Plans /account/drills via the same status set
 * students treat as active, minus Precision Clinic (that surface has its own
 * listing and is excluded from AssignmentRepository.findByLearnerId).
 */

export const OUTSTANDING_ASSIGNMENT_STATUSES = [
  'pending',
  'in-progress',
  'overdue',
] as const;

export type OutstandingAssignmentStatus =
  (typeof OUTSTANDING_ASSIGNMENT_STATUSES)[number];

/** Statuses that must never count toward outstanding digests/nudges. */
export const NON_OUTSTANDING_ASSIGNMENT_STATUSES = [
  'completed',
  'skipped',
] as const;

/**
 * Mongo `$match` for outstanding learner assignments.
 * Excludes `source: 'precision_clinic'` so email/nudge counts match My Plans.
 */
export function outstandingAssignmentMongoMatch(
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    status: { $in: [...OUTSTANDING_ASSIGNMENT_STATUSES] },
    // Same exclusion as my-drills / My Plans (AssignmentRepository.findByLearnerId).
    source: { $ne: 'precision_clinic' },
    ...extra,
  };
}

export function isOutstandingAssignmentStatus(
  status: string | null | undefined,
): boolean {
  return (
    status != null &&
    (OUTSTANDING_ASSIGNMENT_STATUSES as readonly string[]).includes(status)
  );
}

/**
 * Build digest title list from the same ordered assignment drillIds that
 * produced `drillCount`, so listed titles + “and N more” stay consistent
 * with the headline assignment-row count.
 */
export function orderTitlesForOutstandingDigest(
  orderedDrillIds: string[],
  titleByDrillId: Map<string, string>,
  limit = 20,
): string[] {
  const titles: string[] = [];
  for (const id of orderedDrillIds) {
    const title = titleByDrillId.get(id);
    if (!title) continue;
    titles.push(title);
    if (titles.length >= limit) break;
  }
  return titles;
}

/** Remaining assignments not shown in the email’s short title list. */
export function outstandingDigestRemainingCount(
  drillCount: number,
  listedTitleCount: number,
): number {
  return Math.max(0, drillCount - listedTitleCount);
}
