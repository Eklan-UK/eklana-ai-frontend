import type { TeachingClass } from "@/app/(admin)/admin/classes/types";

type ClassesTab = "today" | "upcoming" | "completed";

/**
 * Sort key from `nextSessionStartUtc` (ISO 8601 in UTC): a single instant, so ordering is chronological
 * by real-world date and time.
 */
function timeKey(iso: string | undefined, missingAtEnd: boolean): number {
  if (!iso) {
    return missingAtEnd ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  }
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) {
    return missingAtEnd ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  }
  return t;
}

/** 
 * Real-world time sort for the admin/tutor class tabs.
 * Uses `nextSessionStartUtc` (ISO UTC) as the sort key: date and time.
 * - Today + Upcoming: ascending (soonest first).
 * - Completed: descending (most recent first; when all sessions are past, this follows the list row's last "next" start).
 * Rows without a valid `nextSessionStartUtc` go last in every tab.
 */
export function sortTeachingClassesByTab(
  tab: ClassesTab,
  items: TeachingClass[],
): TeachingClass[] {
  const copy = [...items];
  if (tab === "completed") {
    copy.sort((a, b) => {
      const ka = timeKey(a.nextSessionStartUtc, false);
      const kb = timeKey(b.nextSessionStartUtc, false);
      const d = kb - ka;
      if (d !== 0) return d;
      return a.id.localeCompare(b.id);
    });
  } else {
    copy.sort((a, b) => {
      const ka = timeKey(a.nextSessionStartUtc, true);
      const kb = timeKey(b.nextSessionStartUtc, true);
      const d = ka - kb;
      if (d !== 0) return d;
      return a.id.localeCompare(b.id);
    });
  }
  return copy;
}
