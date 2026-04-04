import type {
  AvailabilityException,
  WeeklyAvailabilityRule,
} from '@/models/tutor-availability';

const WD: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Calendar YYYY-MM-DD for the instant in the given IANA timezone. */
export function zonedDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getZonedWeekdayAndMinutes(
  date: Date,
  timeZone: string,
): { weekday: number; minutes: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = dtf.formatToParts(date);
  const wd = parts.find((p) => p.type === 'weekday')?.value;
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const weekday = wd && WD[wd] !== undefined ? WD[wd] : 0;
  return { weekday, minutes: hour * 60 + minute };
}

function isDateBlocked(dateKey: string, exceptions: AvailabilityException[]): boolean {
  const ex = exceptions.filter((e) => e.date === dateKey);
  if (ex.some((e) => e.kind === 'open')) return false;
  return ex.some((e) => e.kind === 'block');
}

/** Session must fall on one local calendar day in `timeZone` (MVP; avoids midnight splits). */
function sameZonedCalendarDay(a: Date, b: Date, timeZone: string): boolean {
  return zonedDateKey(a, timeZone) === zonedDateKey(b, timeZone);
}

/**
 * True if [startUtc, endUtc] lies entirely within at least one weekly rule,
 * after applying day-level block/open exceptions for the local day.
 */
export function utcIntervalFitsWeeklyAvailability(
  startUtc: Date,
  endUtc: Date,
  rules: WeeklyAvailabilityRule[],
  exceptions: AvailabilityException[],
  timeZone: string,
): boolean {
  if (rules.length === 0) return false;

  if (!sameZonedCalendarDay(startUtc, endUtc, timeZone)) {
    return false;
  }

  const dateKey = zonedDateKey(startUtc, timeZone);
  if (isDateBlocked(dateKey, exceptions)) {
    return false;
  }

  const { weekday, minutes: startMin } = getZonedWeekdayAndMinutes(startUtc, timeZone);
  const { minutes: endMin } = getZonedWeekdayAndMinutes(endUtc, timeZone);

  if (endMin <= startMin) {
    return false;
  }

  return rules.some(
    (r) =>
      r.weekday === weekday &&
      startMin >= r.startMin &&
      endMin <= r.endMin &&
      r.startMin < r.endMin,
  );
}

export function filterSlotsByAvailability(
  slots: { startUtc: string; endUtc: string }[],
  rules: WeeklyAvailabilityRule[],
  exceptions: AvailabilityException[],
  timeZone: string,
): { startUtc: string; endUtc: string }[] {
  return slots.filter((s) => {
    const a = new Date(s.startUtc);
    const b = new Date(s.endUtc);
    return utcIntervalFitsWeeklyAvailability(a, b, rules, exceptions, timeZone);
  });
}
