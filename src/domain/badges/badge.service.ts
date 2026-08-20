import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import DrillAttempt from '@/models/drill-attempt';
import DrillAssignment from '@/models/drill-assignment';
import DailyFocusCompletion from '@/models/daily-focus-completion';
import Bookmark from '@/models/bookmark';
import Drill from '@/models/drill';
import FreeTalkAttempt from '@/models/free-talk-attempt';
import User from '@/models/user';
import UserStreak from '@/models/user-streak';
import { toUserIdCandidates, toUserIdQuery } from '@/lib/api/user-id';
import {
  BADGE_DEFINITIONS,
  BADGE_BY_ID,
  normalizeBadgeId,
} from './badge.definitions';
import type {
  BadgeId,
  BadgeProgress,
  BadgeStateResponse,
  BadgeView,
  StoredBadge,
} from './badge.types';

const PASSING_SCORE = 70;
const MIN_PRACTICE_SECONDS = 300; // 5 minutes
const DEJA_VU_TARGET = 10;
const MEDICATION_MASTER_TARGET = 50;
const SEVEN_DAY_TARGET = 7;
const MONTHLY_CHALLENGE_TARGET = 14;

export const HANDOVER_HERO_SCENARIO_TYPES = [
  'handover',
  'handover_receive',
] as const;

function getDateString(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function parseDateString(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function addUtcDays(dateString: string, days: number): string {
  const d = parseDateString(dateString);
  d.setUTCDate(d.getUTCDate() + days);
  return getDateString(d);
}

function getIsoWeekBounds(reference = new Date()): { start: Date; end: Date } {
  const d = new Date(reference);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() + diffToMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

function longestConsecutiveQualifyingDays(
  secondsByDate: Map<string, number>,
  minSeconds: number,
  target: number
): { met: boolean; currentRun: number } {
  if (secondsByDate.size === 0) {
    return { met: false, currentRun: 0 };
  }

  const qualifyingDates = [...secondsByDate.entries()]
    .filter(([, sec]) => sec >= minSeconds)
    .map(([date]) => date)
    .sort();

  if (qualifyingDates.length === 0) {
    return { met: false, currentRun: 0 };
  }

  let longest = 1;
  let current = 1;

  for (let i = 1; i < qualifyingDates.length; i++) {
    const prev = qualifyingDates[i - 1];
    const curr = qualifyingDates[i];
    if (addUtcDays(prev, 1) === curr) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  // Current run ending today or yesterday
  const today = getDateString(new Date());
  const yesterday = addUtcDays(today, -1);
  let currentRun = 0;
  let cursor = qualifyingDates.includes(today)
    ? today
    : qualifyingDates.includes(yesterday)
      ? yesterday
      : null;

  if (cursor) {
    currentRun = 1;
    while (true) {
      const prev = addUtcDays(cursor, -1);
      if (
        qualifyingDates.includes(prev) &&
        (secondsByDate.get(prev) ?? 0) >= minSeconds
      ) {
        currentRun += 1;
        cursor = prev;
      } else {
        break;
      }
    }
  }

  return { met: longest >= target, currentRun: Math.min(currentRun, target) };
}

function longestConsecutiveInSameMonth(
  secondsByDate: Map<string, number>,
  minSeconds: number,
  target: number
): { met: boolean; currentRun: number } {
  const qualifyingDates = [...secondsByDate.entries()]
    .filter(([, sec]) => sec >= minSeconds)
    .map(([date]) => date)
    .sort();

  if (qualifyingDates.length === 0) {
    return { met: false, currentRun: 0 };
  }

  let longest = 1;
  let current = 1;

  for (let i = 1; i < qualifyingDates.length; i++) {
    const prev = qualifyingDates[i - 1];
    const curr = qualifyingDates[i];
    const sameMonth =
      prev.slice(0, 7) === curr.slice(0, 7) && addUtcDays(prev, 1) === curr;
    if (sameMonth) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return {
    met: longest >= target,
    currentRun: Math.min(longest, target),
  };
}

/** UserStreak filter for reads (Mixed userId may be string or ObjectId). */
function userStreakReadFilter(userId: string) {
  return { userId: { $in: toUserIdCandidates(userId) } };
}

/** UserStreak filter for writes/upserts (canonical storage form). */
function userStreakWriteFilter(userId: string) {
  return { userId: toUserIdQuery(userId) };
}

type EvalResult = { earned: boolean; progress: BadgeProgress | null };

function masterCollectorFromBookmarkCount(bookmarkCount: number): EvalResult {
  const earned = bookmarkCount >= 1;
  return {
    earned,
    progress: earned ? null : { current: 0, target: 1 },
  };
}

function doneAndDustedFromWeekAssignments(statuses: string[]): EvalResult {
  if (statuses.length === 0) {
    return { earned: false, progress: { current: 0, target: 1 } };
  }
  const completed = statuses.filter((status) => status === 'completed').length;
  const total = statuses.length;
  return {
    earned: completed === total,
    progress:
      completed === total ? null : { current: completed, target: total },
  };
}

function skillKeeperFromFirstCompletionCount(n: number): EvalResult {
  const earned = n >= 1;
  return {
    earned,
    progress: earned ? null : { current: 0, target: 1 },
  };
}

function handoverHeroFromPassingCount(n: number): EvalResult {
  const earned = n >= 1;
  return {
    earned,
    progress: earned ? null : { current: 0, target: 1 },
  };
}

function medicationMasterFromUniqueWordCount(n: number): EvalResult {
  return {
    earned: n >= MEDICATION_MASTER_TARGET,
    progress:
      n >= MEDICATION_MASTER_TARGET
        ? null
        : { current: n, target: MEDICATION_MASTER_TARGET },
  };
}

function firstStepsFromPassingCounts(drill: number, focus: number): EvalResult {
  const earned = drill >= 1 || focus >= 1;
  return {
    earned,
    progress: earned ? null : { current: 0, target: 1 },
  };
}

async function buildPracticeSecondsByDate(
  userId: string
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const learnerFilter = { $in: toUserIdCandidates(userId) };

  const [attempts, focusCompletions] = await Promise.all([
    DrillAttempt.find({
      learnerId: learnerFilter,
      completedAt: { $exists: true, $ne: null },
      score: { $gte: PASSING_SCORE },
    })
      .select('completedAt timeSpent')
      .lean()
      .exec(),
    DailyFocusCompletion.find({
      userId: { $in: toUserIdCandidates(userId) },
      score: { $gte: PASSING_SCORE },
    })
      .select('dateString timeSpent')
      .lean()
      .exec(),
  ]);

  for (const a of attempts) {
    if (!a.completedAt) continue;
    const key = getDateString(new Date(a.completedAt));
    map.set(key, (map.get(key) ?? 0) + (a.timeSpent ?? 0));
  }

  for (const c of focusCompletions) {
    map.set(c.dateString, (map.get(c.dateString) ?? 0) + (c.timeSpent ?? 0));
  }

  return map;
}

async function evaluateFirstSteps(userId: string): Promise<EvalResult> {
  const [drillCount, focusCount] = await Promise.all([
    DrillAttempt.countDocuments({
      learnerId: { $in: toUserIdCandidates(userId) },
      score: { $gte: PASSING_SCORE },
      completedAt: { $exists: true, $ne: null },
    }).exec(),
    DailyFocusCompletion.countDocuments({
      userId: { $in: toUserIdCandidates(userId) },
      isFirstCompletion: true,
      score: { $gte: PASSING_SCORE },
    }).exec(),
  ]);
  return firstStepsFromPassingCounts(drillCount, focusCount);
}

async function evaluateSevenDayStretch(userId: string): Promise<EvalResult> {
  const secondsByDate = await buildPracticeSecondsByDate(userId);
  const { met, currentRun } = longestConsecutiveQualifyingDays(
    secondsByDate,
    MIN_PRACTICE_SECONDS,
    SEVEN_DAY_TARGET
  );
  return {
    earned: met,
    progress: met ? null : { current: currentRun, target: SEVEN_DAY_TARGET },
  };
}

async function evaluateDoneAndDusted(userId: string): Promise<EvalResult> {
  const { start, end } = getIsoWeekBounds();

  const weekAssignments = await DrillAssignment.find({
    learnerId: { $in: toUserIdCandidates(userId) },
    dueDate: { $gte: start, $lte: end },
  })
    .select('status')
    .lean()
    .exec();

  return doneAndDustedFromWeekAssignments(
    weekAssignments.map((a) => a.status)
  );
}

async function evaluateDejaVu(userId: string): Promise<EvalResult> {
  const userIdFilter = { $in: toUserIdCandidates(userId) };

  const [bookmarkRows, advancedRows] = await Promise.all([
    Bookmark.find({ userId: userIdFilter, type: 'drill' })
      .select('drillId')
      .lean()
      .exec(),
    Drill.find({ difficulty: 'advanced' })
      .select('_id')
      .lean()
      .exec(),
  ]);

  const difficultIds = new Set<string>([
    ...bookmarkRows.map((b) => String(b.drillId)),
    ...advancedRows.map((d) => String(d._id)),
  ]);

  if (difficultIds.size === 0) {
    return { earned: false, progress: { current: 0, target: DEJA_VU_TARGET } };
  }

  const attempts = await DrillAttempt.find({
    learnerId: { $in: toUserIdCandidates(userId) },
    drillId: { $in: [...difficultIds].map((id) => new Types.ObjectId(id)) },
    score: { $gte: PASSING_SCORE },
    completedAt: { $exists: true, $ne: null },
  })
    .select('drillId')
    .lean()
    .exec();

  const counts = new Map<string, number>();
  for (const a of attempts) {
    const id = String(a.drillId);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const maxCount = counts.size > 0 ? Math.max(...counts.values()) : 0;
  return {
    earned: maxCount >= DEJA_VU_TARGET,
    progress:
      maxCount >= DEJA_VU_TARGET
        ? null
        : { current: maxCount, target: DEJA_VU_TARGET },
  };
}

async function evaluateMonthlyChallenge(userId: string): Promise<EvalResult> {
  const secondsByDate = await buildPracticeSecondsByDate(userId);
  const { met, currentRun } = longestConsecutiveInSameMonth(
    secondsByDate,
    MIN_PRACTICE_SECONDS,
    MONTHLY_CHALLENGE_TARGET
  );
  return {
    earned: met,
    progress: met
      ? null
      : { current: currentRun, target: MONTHLY_CHALLENGE_TARGET },
  };
}

async function evaluateMasterCollector(userId: string): Promise<EvalResult> {
  const bookmarks = await Bookmark.find({
    userId: { $in: toUserIdCandidates(userId) },
    type: 'drill',
  })
    .select('drillId')
    .lean()
    .exec();

  return masterCollectorFromBookmarkCount(bookmarks.length);
}

async function evaluateMedicationMaster(userId: string): Promise<EvalResult> {
  const attempts = await DrillAttempt.find({
    learnerId: { $in: toUserIdCandidates(userId) },
    score: { $gte: PASSING_SCORE },
    $or: [
      { 'vocabularyResults.wordScores': { $exists: true, $ne: [] } },
      { 'definitionResults.wordScores': { $exists: true, $ne: [] } },
    ],
  })
    .select('vocabularyResults definitionResults')
    .lean()
    .exec();

  const masteredWords = new Set<string>();

  for (const attempt of attempts) {
    const vocab = attempt.vocabularyResults?.wordScores ?? [];
    const defs = attempt.definitionResults?.wordScores ?? [];
    for (const w of [...vocab, ...defs]) {
      if (w.score >= PASSING_SCORE && w.word) {
        masteredWords.add(w.word.toLowerCase().trim());
      }
    }
  }

  return medicationMasterFromUniqueWordCount(masteredWords.size);
}

async function evaluateHandoverHero(userId: string): Promise<EvalResult> {
  const count = await FreeTalkAttempt.countDocuments({
    learnerId: { $in: toUserIdCandidates(userId) },
    scenarioType: { $in: HANDOVER_HERO_SCENARIO_TYPES },
    'gradeResult.overallScore': { $gte: PASSING_SCORE },
  }).exec();

  return handoverHeroFromPassingCount(count);
}

async function evaluateNightingaleAward(userId: string): Promise<EvalResult> {
  // Award if currently on Challenge, or completed a Challenge window (end date in the past
  // with start set) — keeps the badge after expiry without a separate history field.
  const user = await User.findById(toUserIdQuery(userId))
    .select('zeroPauseProducts zeroPauseDate zeroPauseEndDate')
    .lean()
    .exec();
  const products = user?.zeroPauseProducts ?? [];
  const hasChallenge = products.includes('challenge');
  const completedWindow =
    Boolean(user?.zeroPauseDate) &&
    Boolean(user?.zeroPauseEndDate) &&
    new Date() > new Date(user!.zeroPauseEndDate as Date);
  const earned = hasChallenge || completedWindow;
  return {
    earned,
    progress: earned ? null : { current: 0, target: 1 },
  };
}

async function evaluateSkillKeeper(userId: string): Promise<EvalResult> {
  const count = await DailyFocusCompletion.countDocuments({
    userId: { $in: toUserIdCandidates(userId) },
    isFirstCompletion: true,
    score: { $gte: PASSING_SCORE },
  }).exec();

  return skillKeeperFromFirstCompletionCount(count);
}

const EVALUATORS: Record<BadgeId, (userId: string) => Promise<EvalResult>> = {
  'first-steps': evaluateFirstSteps,
  'seven-day-stretch': evaluateSevenDayStretch,
  'done-and-dusted': evaluateDoneAndDusted,
  'deja-vu': evaluateDejaVu,
  'monthly-challenge': evaluateMonthlyChallenge,
  'master-collector': evaluateMasterCollector,
  'medication-master': evaluateMedicationMaster,
  'handover-hero': evaluateHandoverHero,
  'nightingale-award': evaluateNightingaleAward,
  'skill-keeper': evaluateSkillKeeper,
};

function normalizeStoredBadges(badges: StoredBadge[]): StoredBadge[] {
  const byId = new Map<string, StoredBadge>();

  for (const badge of badges) {
    const canonicalId = normalizeBadgeId(badge.badgeId);
    const def = BADGE_BY_ID.get(canonicalId as BadgeId);
    if (!def) continue;

    const existing = byId.get(canonicalId);
    const unlockedAt = new Date(badge.unlockedAt);
    if (!existing || unlockedAt > new Date(existing.unlockedAt)) {
      byId.set(canonicalId, {
        badgeId: canonicalId,
        badgeName: def.badgeName,
        unlockedAt,
      });
    }
  }

  return [...byId.values()];
}

function toBadgeView(
  def: (typeof BADGE_DEFINITIONS)[number],
  stored: StoredBadge | undefined,
  progress: BadgeProgress | null
): BadgeView {
  return {
    ...def,
    unlocked: Boolean(stored),
    unlockedAt: stored ? new Date(stored.unlockedAt).toISOString() : null,
    progress: stored ? null : progress,
  };
}

function pickFeaturedBadge(badges: BadgeView[]): BadgeView {
  const unlocked = badges
    .filter((b) => b.unlocked && b.unlockedAt)
    .sort(
      (a, b) =>
        new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime()
    );

  if (unlocked.length > 0) return unlocked[0];

  const locked = badges.filter((b) => !b.unlocked).sort((a, b) => a.sortOrder - b.sortOrder);
  return locked[0] ?? badges[0];
}

export class BadgeService {
  static async evaluateAndUnlock(userId: string): Promise<BadgeId[]> {
    await connectToDatabase();

    const userStreak = await UserStreak.findOne(userStreakReadFilter(userId))
      .lean()
      .exec();
    const stored = normalizeStoredBadges((userStreak?.badges as StoredBadge[]) ?? []);
    const unlockedIds = new Set(stored.map((b) => b.badgeId));

    const newlyUnlocked: BadgeId[] = [];
    const writeFilter = userStreakWriteFilter(userId);
    let streakDocId = userStreak?._id ?? null;

    for (const def of BADGE_DEFINITIONS) {
      if (unlockedIds.has(def.badgeId)) continue;

      try {
        const { earned } = await EVALUATORS[def.badgeId](userId);
        if (!earned) continue;

        const newBadge: StoredBadge = {
          badgeId: def.badgeId,
          badgeName: def.badgeName,
          unlockedAt: new Date(),
        };

        // Prefer updating the existing Mixed-format row when present; otherwise
        // upsert with the canonical toUserIdQuery form.
        if (streakDocId) {
          await UserStreak.updateOne(
            { _id: streakDocId },
            { $push: { badges: newBadge } }
          ).exec();
        } else {
          const upserted = await UserStreak.findOneAndUpdate(
            writeFilter,
            { $push: { badges: newBadge } },
            { upsert: true, new: true }
          ).exec();
          streakDocId = upserted?._id ?? null;
        }

        unlockedIds.add(def.badgeId);
        newlyUnlocked.push(def.badgeId);

        logger.info('Badge unlocked', { userId, badgeId: def.badgeId });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Badge evaluation failed', {
          userId,
          badgeId: def.badgeId,
          error: message,
        });
      }
    }

    return newlyUnlocked;
  }

  static async getBadgeState(userId: string): Promise<BadgeStateResponse> {
    await connectToDatabase();

    const userStreak = await UserStreak.findOne(userStreakReadFilter(userId))
      .lean()
      .exec();
    const storedMap = new Map(
      normalizeStoredBadges((userStreak?.badges as StoredBadge[]) ?? []).map((b) => [
        b.badgeId,
        b,
      ])
    );

    const badges: BadgeView[] = [];

    for (const def of BADGE_DEFINITIONS) {
      const stored = storedMap.get(def.badgeId);
      let progress: BadgeProgress | null = null;

      if (!stored) {
        try {
          const result = await EVALUATORS[def.badgeId](userId);
          progress = result.progress;
        } catch {
          progress = null;
        }
      }

      badges.push(toBadgeView(def, stored, progress));
    }

    return {
      badges,
      featuredBadge: pickFeaturedBadge(badges),
    };
  }

  /** Map stored badges to streak API shape (backward compat). */
  static formatBadgesForStreak(stored: StoredBadge[] | undefined) {
    return normalizeStoredBadges(stored ?? []).map((b) => ({
      badgeId: b.badgeId,
      badgeName: b.badgeName,
      unlockedAt: b.unlockedAt,
      icon: BADGE_BY_ID.get(b.badgeId as BadgeId)?.icon ?? '🏅',
    }));
  }
}

// Export helpers for unit tests
export const __test__ = {
  getDateString,
  addUtcDays,
  longestConsecutiveQualifyingDays,
  pickFeaturedBadge,
  toBadgeView,
  masterCollectorFromBookmarkCount,
  doneAndDustedFromWeekAssignments,
  skillKeeperFromFirstCompletionCount,
  handoverHeroFromPassingCount,
  HANDOVER_HERO_SCENARIO_TYPES,
  medicationMasterFromUniqueWordCount,
  firstStepsFromPassingCounts,
  userStreakReadFilter,
  userStreakWriteFilter,
  MIN_PRACTICE_SECONDS,
  SEVEN_DAY_TARGET,
};
