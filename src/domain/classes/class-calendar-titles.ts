import { getUserDisplayName } from '@/utils/user';

/** Aligned with `FALLBACK_CLASS_TITLE_MAX_LEN` in class.repository. */
const RESCHEDULE_TITLE_MAX_LEN = 120;

type LearnerLike = {
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
};

/**
 * Google Calendar event summary for a rescheduled session: `Reschedule (names)`.
 * Mirrors `buildFallbackClassSeriesTitle` ("Class 1 (names)") but with Reschedule prefix.
 */
export function buildRescheduleCalendarTitle(learnersOrdered: LearnerLike[]): string {
  const prefix = 'Reschedule';
  if (learnersOrdered.length === 0) {
    return prefix;
  }
  const names = learnersOrdered.map((u) => getUserDisplayName(u));
  for (let k = names.length; k >= 1; k--) {
    const head = names.slice(0, k).join(', ');
    const rest = names.length - k;
    const inner = rest > 0 ? `${head} + ${rest} more` : head;
    const candidate = `${prefix} (${inner})`;
    if (candidate.length <= RESCHEDULE_TITLE_MAX_LEN) return candidate;
  }
  const first = names[0] ?? 'Student';
  const budget = Math.max(12, RESCHEDULE_TITLE_MAX_LEN - prefix.length - 5);
  return `${prefix} (${first.slice(0, budget)}…)`;
}
