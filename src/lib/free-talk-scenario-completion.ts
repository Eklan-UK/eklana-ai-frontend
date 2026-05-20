/**
 * Completion date helpers for Eklan Free Talk scenarios.
 * Dates are stored as end-of-calendar-day (23:59:59.999 local) for parity with drills.
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Normalize admin date input (YYYY-MM-DD or ISO) to end of that calendar day. */
export function parseFreeTalkCompletionDateInput(value: string | Date): Date {
  const raw = typeof value === 'string' ? value.trim() : value;
  const d =
    typeof raw === 'string'
      ? new Date(raw.includes('T') ? raw : `${raw}T12:00:00`)
      : new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid completion date');
  }
  d.setHours(23, 59, 59, 999);
  return d;
}

export function freeTalkCompletionDateEnd(value: string | Date): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return d;
  d.setHours(23, 59, 59, 999);
  return d;
}

export function isFreeTalkScenarioExpired(completionDate: Date | string | null | undefined): boolean {
  if (completionDate == null) return false;
  return Date.now() > freeTalkCompletionDateEnd(completionDate).getTime();
}

/** True when incomplete and within 24 hours of the completion deadline. */
export function isFreeTalkScenarioDueSoon(
  completionDate: Date | string | null | undefined,
  completed: boolean,
): boolean {
  if (completed || completionDate == null) return false;
  const end = freeTalkCompletionDateEnd(completionDate);
  const now = Date.now();
  const endMs = end.getTime();
  return now <= endMs && endMs - now <= ONE_DAY_MS;
}

export function formatFreeTalkDueLabel(completionDate: Date | string): string {
  return freeTalkCompletionDateEnd(completionDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
