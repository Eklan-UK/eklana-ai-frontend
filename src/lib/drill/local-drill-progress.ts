/**
 * Device-local, item-level drill resume (isomorphic contract with mobile).
 * Source of truth for mid-chunk resume; server checkpoints remain every-5 milestones.
 *
 * Storage key: eklan-drill-progress:v1:{userId}:{scopeKey}
 * scopeKey: a:{assignmentId} | wc:{challengeId}:{itemIndex} | d:{drillId}
 */

export type LocalDrillProgressScope =
  | { source: 'assignment'; assignmentId: string }
  | {
      source: 'weekly_challenge';
      challengeId: string;
      challengeItemIndex: number;
      weekStartDate?: string;
    }
  | { source: 'unscoped'; drillId: string };

export type LocalDrillProgressV1 = {
  v: 1;
  drillId: string;
  drillType: string;
  scope: LocalDrillProgressScope;
  resumeFromIndex: number;
  completedItemCount: number;
  /** Per-type shapes reused from server checkpoints; see docs/DRILL_CHECKPOINTS.md */
  partialResults: Record<string, unknown>;
  startedAt: string;
  lastUpdatedAt: string;
};

export type WeeklyChallengeLocalMeta = {
  challengeId: string;
  itemIndex: number;
  weekStartDate?: string;
};

const STORAGE_PREFIX = 'eklan-drill-progress:v1';

export function buildLocalProgressScopeKey(scope: LocalDrillProgressScope): string {
  if (scope.source === 'assignment') {
    return `a:${scope.assignmentId}`;
  }
  if (scope.source === 'weekly_challenge') {
    return `wc:${scope.challengeId}:${scope.challengeItemIndex}`;
  }
  return `d:${scope.drillId}`;
}

export function buildLocalProgressStorageKey(
  userId: string,
  scope: LocalDrillProgressScope,
): string {
  return `${STORAGE_PREFIX}:${userId}:${buildLocalProgressScopeKey(scope)}`;
}

export function resolveLocalProgressScope(opts: {
  drillId: string;
  assignmentId?: string | null;
  weeklyChallengeMeta?: WeeklyChallengeLocalMeta | null;
}): LocalDrillProgressScope {
  // Prefer WC when meta is present (matches mobile resolveLocalDrillProgressScope).
  if (opts.weeklyChallengeMeta) {
    return {
      source: 'weekly_challenge',
      challengeId: opts.weeklyChallengeMeta.challengeId,
      challengeItemIndex: opts.weeklyChallengeMeta.itemIndex,
      ...(opts.weeklyChallengeMeta.weekStartDate
        ? { weekStartDate: opts.weeklyChallengeMeta.weekStartDate }
        : {}),
    };
  }
  if (opts.assignmentId) {
    return { source: 'assignment', assignmentId: opts.assignmentId };
  }
  return { source: 'unscoped', drillId: opts.drillId };
}

export function isLocalDrillProgressV1(value: unknown): value is LocalDrillProgressV1 {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (row.v !== 1) return false;
  if (typeof row.drillId !== 'string' || typeof row.drillType !== 'string') return false;
  if (typeof row.resumeFromIndex !== 'number' || typeof row.completedItemCount !== 'number') {
    return false;
  }
  if (!row.partialResults || typeof row.partialResults !== 'object') return false;
  if (typeof row.startedAt !== 'string' || typeof row.lastUpdatedAt !== 'string') return false;
  if (!row.scope || typeof row.scope !== 'object') return false;
  const scope = row.scope as Record<string, unknown>;
  if (scope.source === 'assignment') return typeof scope.assignmentId === 'string';
  if (scope.source === 'weekly_challenge') {
    return (
      typeof scope.challengeId === 'string' && typeof scope.challengeItemIndex === 'number'
    );
  }
  if (scope.source === 'unscoped') return typeof scope.drillId === 'string';
  return false;
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getLocalDrillProgress(
  userId: string,
  scope: LocalDrillProgressScope,
): LocalDrillProgressV1 | null {
  if (!userId || !canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(buildLocalProgressStorageKey(userId, scope));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isLocalDrillProgressV1(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setLocalDrillProgress(
  userId: string,
  progress: LocalDrillProgressV1,
): void {
  if (!userId || !canUseStorage()) return;
  try {
    window.localStorage.setItem(
      buildLocalProgressStorageKey(userId, progress.scope),
      JSON.stringify(progress),
    );
  } catch {
    // Quota / private mode — non-critical
  }
}

export function clearLocalDrillProgress(
  userId: string,
  scope: LocalDrillProgressScope,
): void {
  if (!userId || !canUseStorage()) return;
  try {
    window.localStorage.removeItem(buildLocalProgressStorageKey(userId, scope));
  } catch {
    // Non-critical
  }
}

export type LocalDrillProgressWriteInput = {
  drillId: string;
  drillType: string;
  scope: LocalDrillProgressScope;
  resumeFromIndex: number;
  completedItemCount: number;
  partialResults: Record<string, unknown>;
  startedAt?: string;
  /** Preserve startedAt across writes when omitted on input */
  previousStartedAt?: string;
};

export function buildLocalDrillProgressV1(
  input: LocalDrillProgressWriteInput,
): LocalDrillProgressV1 {
  const now = new Date().toISOString();
  return {
    v: 1,
    drillId: input.drillId,
    drillType: input.drillType,
    scope: input.scope,
    resumeFromIndex: input.resumeFromIndex,
    completedItemCount: input.completedItemCount,
    partialResults: input.partialResults,
    startedAt: input.startedAt || input.previousStartedAt || now,
    lastUpdatedAt: now,
  };
}
