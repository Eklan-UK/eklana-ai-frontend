import DrillAttempt from '@/models/drill-attempt';
import {
  getZonedWeekdayAndMinutes,
  zonedDateKey,
} from '@/domain/tutor-availability/availability-window';

/** True when the instant falls in the 18:00–18:59 window in the given IANA timezone. */
export function isLocalHour18(date: Date, timeZone: string): boolean {
  const { minutes } = getZonedWeekdayAndMinutes(date, timeZone);
  const h = Math.floor(minutes / 60);
  return h === 18;
}

/**
 * True when the learner has at least one qualifying drill attempt (score >= 70)
 * whose completedAt falls on today's local calendar day in `timeZone`.
 */
export async function hasQualifyingDrillTodayLocal(
  learnerId: string,
  timeZone: string,
  now = new Date(),
): Promise<boolean> {
  const localToday = zonedDateKey(now, timeZone);
  const since = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const attempts = await DrillAttempt.find({
    learnerId,
    score: { $gte: 70 },
    completedAt: { $gte: since },
  })
    .select('completedAt')
    .lean();

  return attempts.some(
    (a) =>
      a.completedAt &&
      zonedDateKey(new Date(a.completedAt), timeZone) === localToday,
  );
}
