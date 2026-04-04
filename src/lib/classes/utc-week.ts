/**
 * Phase 5 — Same-week reschedule (MVP).
 *
 * Week boundaries: **Monday 00:00 UTC** through **Sunday 23:59:59.999 UTC** for the UTC calendar
 * week that contains the anchor instant. Documented product upgrade: use `ClassSeries.timezone`
 * with `date-fns-tz` for wall-clock weeks.
 */

export function utcMondayStartOfWeekContaining(d: Date): Date {
  const day = d.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
  monday.setUTCDate(monday.getUTCDate() - diffToMonday);
  return monday;
}

/** Sunday 23:59:59.999 UTC of the week that contains `d`. */
export function utcSundayEndOfWeekContaining(d: Date): Date {
  const mon = utcMondayStartOfWeekContaining(d);
  const sun = new Date(mon.getTime() + 7 * 24 * 60 * 60 * 1000);
  sun.setUTCMilliseconds(sun.getUTCMilliseconds() - 1);
  return sun;
}

export function utcWeekRangeContaining(d: Date): { weekStartUtc: Date; weekEndUtc: Date } {
  return {
    weekStartUtc: utcMondayStartOfWeekContaining(d),
    weekEndUtc: utcSundayEndOfWeekContaining(d),
  };
}

export function isUtcInstantInSameWeekAs(a: Date, b: Date): boolean {
  const wa = utcMondayStartOfWeekContaining(a).getTime();
  const wb = utcMondayStartOfWeekContaining(b).getTime();
  return wa === wb;
}

export function isUtcRangeWithinWeek(
  start: Date,
  end: Date,
  weekStart: Date,
  weekEnd: Date,
): boolean {
  return start.getTime() >= weekStart.getTime() && end.getTime() <= weekEnd.getTime();
}
