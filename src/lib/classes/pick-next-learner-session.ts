import type { TeachingClass } from "@/app/(admin)/admin/classes/types";

/** Prefer today’s sessions, then upcoming; earliest `nextSessionStartUtc` first when present. */
export function pickNextLearnerSession(
  classes: TeachingClass[],
): TeachingClass | null {
  if (classes.length === 0) return null;
  const byStart = (a: TeachingClass, b: TeachingClass) => {
    const ta = a.nextSessionStartUtc
      ? new Date(a.nextSessionStartUtc).getTime()
      : Number.MAX_SAFE_INTEGER;
    const tb = b.nextSessionStartUtc
      ? new Date(b.nextSessionStartUtc).getTime()
      : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  };
  const today = classes.filter((c) => c.bucket === "today").sort(byStart);
  if (today.length > 0) return today[0]!;
  const upcoming = classes.filter((c) => c.bucket === "upcoming").sort(byStart);
  return upcoming[0] ?? null;
}

/** Relative label for the next session start, or null if unknown. */
export function formatStartsInLabel(iso?: string): string | null {
  if (!iso) return null;
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return null;
  const diffMs = start - Date.now();
  if (diffMs <= 0) return "Starting soon";
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `Starts in ${days} day${days === 1 ? "" : "s"}`;
  if (hrs > 0) return `Starts in ${hrs} hr${hrs === 1 ? "" : "s"}`;
  if (mins > 0) return `Starts in ${mins} min`;
  return "Starting soon";
}
