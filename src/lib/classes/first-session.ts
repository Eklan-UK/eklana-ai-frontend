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
