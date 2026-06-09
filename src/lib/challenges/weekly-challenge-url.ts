/** Encode weekStartDate ISO string for use in URL path segments. */
export function encodeWeekStartDate(weekStartDate: string): string {
	return encodeURIComponent(weekStartDate);
}

/** Decode weekStartDate from URL path segment back to ISO string. */
export function decodeWeekStartDate(encoded: string): string {
	return decodeURIComponent(encoded);
}
