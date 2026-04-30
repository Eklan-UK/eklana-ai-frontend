import type { TeachingClass } from "@/app/(admin)/admin/classes/types";

/** Parse "3:00 PM – 4:00 PM" / "22:08 – 22:10" style local times on a fixed calendar day. */
export function parseTimeRangeDurationMs(timeRange: string): number | null {
  if (!timeRange || timeRange === "—") return null;
  const m = timeRange.split(/\s*[\u2013\u2014\-]\s*/);
  if (m.length < 2) return null;
  const d1 = new Date(`1/1/2000 ${m[0]!.trim()}`);
  const d2 = new Date(`1/1/2000 ${m[1]!.trim()}`);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
  let ms = d2.getTime() - d1.getTime();
  if (ms <= 0) ms += 24 * 60 * 60 * 1000;
  return ms > 0 ? ms : null;
}

const TF: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};

/**
 * The list API still fills `scheduleDays` / `timeRange` from the *series* pattern. After a
 * reschedule, the true next session day/time is in `nextSessionStartUtc`; use it for the card
 * so the schedule block matches "Next session" and the rescheduled time.
 */
export function getClassCardScheduleBlock(
  session: TeachingClass,
): { dayLabel: string; timeLabel: string } {
  if (session.nextSessionIsReschedule && session.nextSessionStartUtc) {
    const start = new Date(session.nextSessionStartUtc);
    if (Number.isNaN(start.getTime())) {
      return { dayLabel: session.scheduleDays, timeLabel: session.timeRange };
    }
    const dur = parseTimeRangeDurationMs(session.timeRange) ?? 60 * 60 * 1000;
    const end = new Date(start.getTime() + dur);
    const dayLabel = start.toLocaleDateString(undefined, { weekday: "long" });
    const timeLabel = `${start.toLocaleTimeString(undefined, TF)} – ${end.toLocaleTimeString(undefined, TF)}`;
    return { dayLabel, timeLabel };
  }
  return { dayLabel: session.scheduleDays, timeLabel: session.timeRange };
}
