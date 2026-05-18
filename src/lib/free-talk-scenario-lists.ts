/**
 * Free Talk scenario list fields (`include`, `usefulPhrases`) are stored in Mongo
 * as string[]. Admins may paste multiline text; APIs may receive a string or array.
 * This module normalizes every shape to a trimmed string[] (newline-split for strings).
 */

function splitMultilineList(text: string): string[] {
	return text
		.split(/\r\n|\n|\r/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

/**
 * Coerce DB / JSON input to string[].
 * - `string`: split on newlines; trim lines; drop empties (single-line paste → one item).
 * - `string[]`: trim each entry; split any element that still contains newlines.
 * - Legacy single string stored in DB instead of array: handled via string branch if read as string.
 */
export function normalizeFreeTalkScenarioStringList(value: unknown): string[] {
	if (value == null) return [];

	if (typeof value === 'string') {
		return splitMultilineList(value);
	}

	if (Array.isArray(value)) {
		const out: string[] = [];
		for (const item of value) {
			if (item == null) continue;
			if (typeof item !== 'string') {
				const s = String(item).trim();
				if (s) out.push(s);
				continue;
			}
			const trimmed = item.trim();
			if (!trimmed) continue;
			if (trimmed.includes('\n') || trimmed.includes('\r')) {
				out.push(...splitMultilineList(trimmed));
			} else {
				out.push(trimmed);
			}
		}
		return out;
	}

	return [];
}

/** Display string[] in a textarea (one item per line). */
export function freeTalkStringListToMultiline(lines: string[]): string {
	return lines.join('\n');
}
