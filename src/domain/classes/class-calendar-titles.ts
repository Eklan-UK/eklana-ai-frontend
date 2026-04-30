import { getUserDisplayName } from '@/utils/user';

/** Google Calendar event summary max length (month view + DB). */
const CALENDAR_CLASS_TITLE_MAX_LEN = 120;

type LearnerLike = {
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
};

/**
 * Google Calendar event summary: `Class N of M (learner name(s))`.
 * Used for new sessions and rescheduled sessions.
 */
export function buildClassSessionCalendarTitle(
  sequenceNumber: number,
  totalPlanned: number,
  learnersOrdered: LearnerLike[],
): string {
  const m = Math.max(1, Math.trunc(totalPlanned));
  const n = Math.max(1, Math.min(Math.trunc(sequenceNumber) || 1, m));
  const prefix = `Class ${n} of ${m}`;

  if (learnersOrdered.length === 0) {
    return prefix;
  }

  const names = learnersOrdered.map((u) => getUserDisplayName(u));
  for (let k = names.length; k >= 1; k--) {
    const head = names.slice(0, k).join(', ');
    const rest = names.length - k;
    const inner = rest > 0 ? `${head} + ${rest} more` : head;
    const candidate = `${prefix} (${inner})`;
    if (candidate.length <= CALENDAR_CLASS_TITLE_MAX_LEN) return candidate;
  }
  const first = names[0] ?? 'Student';
  const budget = Math.max(12, CALENDAR_CLASS_TITLE_MAX_LEN - prefix.length - 5);
  return `${prefix} (${first.slice(0, budget)}…)`;
}
