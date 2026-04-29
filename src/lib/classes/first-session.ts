/**
 * Compute the first upcoming session window from weekday labels and local times.
 * Used by the schedule wizard before POST /api/v1/admin/classes.
 */
export function computeFirstSessionRange(
  weekdayLabels: string[],
  startTime: string,
  endTime: string,
): { start: Date; end: Date } {
  const parseHm = (s: string) => {
    const parts = s.trim().split(":");
    return { h: Number(parts[0]) || 0, m: Number(parts[1]) || 0 };
  };
  const sh = parseHm(startTime);
  const eh = parseHm(endTime);
  const norm = (label: string) => label.trim().slice(0, 3).toLowerCase();
  const dayShort = (d: Date) =>
    d
      .toLocaleDateString("en-US", { weekday: "short" })
      .slice(0, 3)
      .toLowerCase();
  const matches = (d: Date) =>
    weekdayLabels.some((w) => norm(w) === dayShort(d));

  const now = new Date();
  for (let add = 0; add < 28; add++) {
    const base = new Date(now);
    base.setDate(now.getDate() + add);
    if (!matches(base)) continue;
    const start = new Date(base);
    start.setHours(sh.h, sh.m, 0, 0);
    const end = new Date(base);
    end.setHours(eh.h, eh.m, 0, 0);
    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }
    if (start > now) {
      return { start, end };
    }
  }

  const start = new Date(now);
  start.setDate(start.getDate() + 1);
  start.setHours(sh.h, sh.m, 0, 0);
  const end = new Date(start);
  end.setHours(eh.h, eh.m, 0, 0);
  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }
  return { start, end };
}

const parseTimeHm = (s: string) => {
  const parts = s.trim().split(":");
  return { h: Number(parts[0]) || 0, m: Number(parts[1]) || 0 };
};

/**
 * Session window on a chosen local calendar day (one-time scheduling), not
 * the next matching weekday. If end is on or before start on the same day, end
 * is moved to the next calendar day (same as {@link computeFirstSessionRange}).
 */
export function computeSessionRangeOnLocalDate(
  localCalendarDay: Date,
  startTime: string,
  endTime: string,
): { start: Date; end: Date } {
  const sh = parseTimeHm(startTime);
  const eh = parseTimeHm(endTime);
  const base = new Date(localCalendarDay);
  base.setHours(0, 0, 0, 0);
  const start = new Date(base);
  start.setHours(sh.h, sh.m, 0, 0);
  const end = new Date(base);
  end.setHours(eh.h, eh.m, 0, 0);
  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }
  return { start, end };
}

/** Short weekday like "Mon" to align with admin `scheduleDayLabels`. */
export function weekdayShortLabelFromDate(d: Date): string {
  return d
    .toLocaleDateString("en-US", { weekday: "short" })
    .slice(0, 3);
}

/**
 * `YYYY-MM-DD` from a date input to a local-civil `Date` (avoids UTC shift on submit).
 */
export function parseIsoDateStringToLocalDate(iso: string): Date | null {
  if (!iso?.trim()) return null;
  const [yStr, mStr, dStr] = iso.split("-");
  if (!yStr || !mStr || !dStr) return null;
  const y = Number.parseInt(yStr, 10);
  const m = Number.parseInt(mStr, 10);
  const d = Number.parseInt(dStr, 10);
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(m) ||
    !Number.isFinite(d) ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31
  ) {
    return null;
  }
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }
  return dt;
}

const dayLabelNorm = (label: string) => label.trim().slice(0, 3).toLowerCase();
const dayShort = (d: Date) =>
  d
    .toLocaleDateString("en-US", { weekday: "short" })
    .slice(0, 3)
    .toLowerCase();
const dayMatchesLabel = (d: Date, weekdayLabels: string[]) =>
  weekdayLabels.some((w) => dayLabelNorm(w) === dayShort(d));

/**
 * "Ends on" field from the admin schedule modal (DD   MM   YYYY, space-separated).
 */
export function parseEndsOnDisplayToLocalDate(text: string): Date | null {
  const parts = text
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean);
  if (parts.length < 3) {
    return null;
  }
  const d = Number.parseInt(parts[0]!, 10);
  const m = Number.parseInt(parts[1]!, 10);
  const y = Number.parseInt(parts[2]!, 10);
  if (
    !Number.isFinite(d) ||
    !Number.isFinite(m) ||
    !Number.isFinite(y) ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31
  ) {
    return null;
  }
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }
  return dt;
}

/**
 * How many class occurrences from the first session (inclusive) through the end day (inclusive
 * end-of-day), using the same weekday matching as {@link computeFirstSessionRange}.
 */
export function countSessionsThroughEndDate(
  weekdayLabels: string[],
  firstSessionStart: Date,
  endDateInclusiveLocal: Date,
): number {
  if (weekdayLabels.length === 0) {
    return 0;
  }
  const h = firstSessionStart.getHours();
  const min = firstSessionStart.getMinutes();
  const firstMs = firstSessionStart.getTime();
  const endLimit = new Date(endDateInclusiveLocal);
  endLimit.setHours(23, 59, 59, 999);

  const startDay = new Date(firstSessionStart);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(endDateInclusiveLocal);
  endDay.setHours(0, 0, 0, 0);

  let count = 0;
  for (
    let d = new Date(startDay);
    d.getTime() <= endDay.getTime();
    d.setDate(d.getDate() + 1)
  ) {
    if (!dayMatchesLabel(d, weekdayLabels)) {
      continue;
    }
    const occ = new Date(d);
    occ.setHours(h, min, 0, 0);
    if (occ.getTime() < firstMs) {
      continue;
    }
    if (occ.getTime() > endLimit.getTime()) {
      continue;
    }
    count += 1;
  }
  return count;
}
