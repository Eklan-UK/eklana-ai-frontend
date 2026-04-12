const MIN_WORDS_FOR_LONG_CHUNK = 8;
const MIN_WORDS_FOR_SENTENCE = 3;

/**
 * Take one speakable prefix: sentence end (min 3 words) or first 8 words.
 * Splits only on whitespace (no mid-word cuts).
 */
export function tryTakeSpeakableChunk(buffer: string): { spoken: string; rest: string } | null {
	const s = buffer.trimStart();
	if (!s) return null;

	const sentenceMatch = s.match(/^([\s\S]{1,400}?[.!?])(\s+|$)/);
	if (sentenceMatch) {
		const candidate = sentenceMatch[1].trim();
		const wc = candidate.split(/\s+/).filter(Boolean).length;
		if (wc >= MIN_WORDS_FOR_SENTENCE) {
			return { spoken: candidate, rest: s.slice(sentenceMatch[0].length) };
		}
	}

	const words = s.split(/\s+/).filter(Boolean);
	if (words.length >= MIN_WORDS_FOR_LONG_CHUNK) {
		const spoken = words.slice(0, MIN_WORDS_FOR_LONG_CHUNK).join(' ');
		const rest = s.slice(spoken.length).replace(/^\s+/, '');
		return { spoken, rest };
	}

	return null;
}
