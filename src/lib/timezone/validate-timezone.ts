/** Returns true when `tz` is a valid IANA timezone identifier. */
export function validateTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
