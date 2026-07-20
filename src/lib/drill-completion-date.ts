/**
 * Completion date helpers for drills.
 * Dates are stored as end-of-calendar-day (23:59:59.999 local) so
 * YYYY-MM-DD tutor input matches display and overdue checks across timezones.
 */

/** Normalize admin/tutor date input (YYYY-MM-DD or ISO) to end of that calendar day. */
export function parseDrillCompletionDateInput(value: string | Date): Date {
  const raw = typeof value === "string" ? value.trim() : value;
  const d =
    typeof raw === "string"
      ? new Date(raw.includes("T") ? raw : `${raw}T12:00:00`)
      : new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid completion date");
  }
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Normalize a stored deadline to end of its local calendar day for comparisons. */
export function drillCompletionDateEnd(value: string | Date): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return d;
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Local civil date as YYYY-MM-DD (never UTC via toISOString). */
export function formatDrillCompletionDateForInput(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid completion date");
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** True when now is after the end of the completion calendar day. */
export function isDrillCompletionOverdue(
  completionDate: Date | string | null | undefined,
): boolean {
  if (completionDate == null) return false;
  const end = drillCompletionDateEnd(completionDate);
  if (Number.isNaN(end.getTime())) return false;
  return Date.now() > end.getTime();
}
