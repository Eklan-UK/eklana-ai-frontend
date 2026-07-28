import type {
	LetterProblemArea,
	PhonemeProblemArea,
	StrugglingWord,
} from './pronunciation-analytics.service';

const DEFAULT_PASS_THRESHOLD = 70;
const MAX_PHONEMES = 10;
const MAX_LETTERS = 10;
const MAX_WORDS_PER_SOUND = 5;

interface PhoneScore {
	phone?: string;
	quality_score?: number;
}

interface WordScore {
	word?: string;
	quality_score?: number;
	phone_score_list?: PhoneScore[];
}

interface TextScore {
	word_score_list?: WordScore[];
}

interface ReviewSnapshotRow {
	text?: string;
	textScore?: TextScore;
	text_score?: TextScore;
}

interface ReviewSnapshotGroup {
	rows?: ReviewSnapshotRow[];
}

export interface PerformanceReviewSnapshot {
	passThreshold?: number;
	groups?: ReviewSnapshotGroup[];
}

export interface ExtractedPhonemeData {
	incorrectPhonemes: string[];
	incorrectLetters: string[];
	wordScores: Array<{
		word: string;
		score: number;
		phonemes: Array<{ phoneme: string; score: number }>;
	}>;
	textScore: number;
}

function getTextScoreFromRow(row: ReviewSnapshotRow): TextScore | null {
	const score = row.textScore ?? row.text_score;
	return score && typeof score === 'object' ? score : null;
}

/** Walk performanceReviewSnapshot and collect phoneme/letter errors below threshold. */
export function extractPhonemesFromReviewSnapshot(
	snapshot: PerformanceReviewSnapshot | Record<string, unknown> | null | undefined,
	passThreshold = DEFAULT_PASS_THRESHOLD
): ExtractedPhonemeData {
	const incorrectPhonemes: string[] = [];
	const incorrectLetters: string[] = [];
	const wordScores: ExtractedPhonemeData['wordScores'] = [];
	const scores: number[] = [];

	const groups = (snapshot as PerformanceReviewSnapshot)?.groups ?? [];

	for (const group of groups) {
		for (const row of group.rows ?? []) {
			const textScore = getTextScoreFromRow(row);
			if (!textScore?.word_score_list) continue;

			for (const wordScore of textScore.word_score_list) {
				const word = wordScore.word?.trim() || row.text?.trim() || '';
				const wordLevelScore = wordScore.quality_score ?? 100;
				scores.push(wordLevelScore);

				const phonemeEntries: Array<{ phoneme: string; score: number }> = [];

				for (const phone of wordScore.phone_score_list ?? []) {
					const phoneme = phone.phone?.trim();
					if (!phoneme) continue;

					const phoneScore = phone.quality_score ?? 100;
					phonemeEntries.push({ phoneme, score: phoneScore });

					if (phoneScore < passThreshold && !incorrectPhonemes.includes(phoneme)) {
						incorrectPhonemes.push(phoneme);
					}
				}

				if (wordLevelScore < passThreshold && word) {
					for (const letter of word.toLowerCase()) {
						if (/[a-z]/.test(letter) && !incorrectLetters.includes(letter)) {
							incorrectLetters.push(letter);
						}
					}
				}

				if (word) {
					wordScores.push({
						word,
						score: wordLevelScore,
						phonemes: phonemeEntries,
					});
				}
			}
		}
	}

	const textScore =
		scores.length > 0
			? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
			: 0;

	return { incorrectPhonemes, incorrectLetters, wordScores, textScore };
}

function mergeWordLists(
	existing: StrugglingWord[],
	incoming: StrugglingWord[]
): StrugglingWord[] {
	const wordMap = new Map<string, number>();
	for (const w of existing) {
		wordMap.set(w.word, (wordMap.get(w.word) ?? 0) + w.count);
	}
	for (const w of incoming) {
		wordMap.set(w.word, (wordMap.get(w.word) ?? 0) + w.count);
	}
	return Array.from(wordMap.entries())
		.map(([word, count]) => ({ word, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, MAX_WORDS_PER_SOUND);
}

/** Merge phoneme problem areas by phoneme key, summing counts and merging word lists. */
export function mergePhonemeProblemAreas(
	...sources: PhonemeProblemArea[][]
): PhonemeProblemArea[] {
	const merged = new Map<string, PhonemeProblemArea>();

	for (const source of sources) {
		for (const item of source) {
			if (!item.phoneme) continue;
			const existing = merged.get(item.phoneme);
			if (existing) {
				existing.count += item.count;
				existing.words = mergeWordLists(existing.words ?? [], item.words ?? []);
			} else {
				merged.set(item.phoneme, {
					phoneme: item.phoneme,
					count: item.count,
					words: [...(item.words ?? [])],
				});
			}
		}
	}

	return Array.from(merged.values())
		.sort((a, b) => b.count - a.count)
		.slice(0, MAX_PHONEMES);
}

/** Build PhonemeProblemArea[] from raw phoneme hit counts (snapshot / progress aggregation). */
export function buildPhonemeProblemAreas(
	phonemeCounts: Map<string, { count: number; words: Map<string, number> }>
): PhonemeProblemArea[] {
	return Array.from(phonemeCounts.entries())
		.map(([phoneme, { count, words }]) => ({
			phoneme,
			count,
			words: Array.from(words.entries())
				.map(([word, wordCount]) => ({ word, count: wordCount }))
				.sort((a, b) => b.count - a.count)
				.slice(0, MAX_WORDS_PER_SOUND),
		}))
		.sort((a, b) => b.count - a.count)
		.slice(0, MAX_PHONEMES);
}

/** Accumulate phoneme hits from extractPhonemesFromReviewSnapshot into a count map. */
export function accumulatePhonemeHits(
	counts: Map<string, { count: number; words: Map<string, number> }>,
	extracted: ExtractedPhonemeData,
	passThreshold = DEFAULT_PASS_THRESHOLD
): void {
	for (const wordScore of extracted.wordScores) {
		for (const ph of wordScore.phonemes) {
			if (ph.score >= passThreshold) continue;
			if (!counts.has(ph.phoneme)) {
				counts.set(ph.phoneme, { count: 0, words: new Map() });
			}
			const entry = counts.get(ph.phoneme)!;
			entry.count++;
			if (wordScore.word) {
				entry.words.set(wordScore.word, (entry.words.get(wordScore.word) ?? 0) + 1);
			}
		}
	}
}

/** Merge letter problem areas by letter key, summing counts and merging word lists. */
export function mergeLetterProblemAreas(
	...sources: LetterProblemArea[][]
): LetterProblemArea[] {
	const merged = new Map<string, LetterProblemArea>();

	for (const source of sources) {
		for (const item of source) {
			if (!item.letter) continue;
			const existing = merged.get(item.letter);
			if (existing) {
				existing.count += item.count;
				existing.words = mergeWordLists(existing.words ?? [], item.words ?? []);
			} else {
				merged.set(item.letter, {
					letter: item.letter,
					count: item.count,
					words: [...(item.words ?? [])],
				});
			}
		}
	}

	return Array.from(merged.values())
		.sort((a, b) => b.count - a.count)
		.slice(0, MAX_LETTERS);
}

/** Build LetterProblemArea[] from raw letter hit counts (snapshot / progress aggregation). */
export function buildLetterProblemAreas(
	letterCounts: Map<string, { count: number; words: Map<string, number> }>
): LetterProblemArea[] {
	return Array.from(letterCounts.entries())
		.map(([letter, { count, words }]) => ({
			letter,
			count,
			words: Array.from(words.entries())
				.map(([word, wordCount]) => ({ word, count: wordCount }))
				.sort((a, b) => b.count - a.count)
				.slice(0, MAX_WORDS_PER_SOUND),
		}))
		.sort((a, b) => b.count - a.count)
		.slice(0, MAX_LETTERS);
}

/**
 * Accumulate letter hits from extracted snapshot data.
 * Same heuristic as extract / word-attempt write path: failing words contribute unique a–z letters.
 */
export function accumulateLetterHits(
	counts: Map<string, { count: number; words: Map<string, number> }>,
	extracted: ExtractedPhonemeData,
	passThreshold = DEFAULT_PASS_THRESHOLD
): void {
	for (const wordScore of extracted.wordScores) {
		if (wordScore.score >= passThreshold) continue;
		const word = wordScore.word;
		if (!word) continue;

		const seen = new Set<string>();
		for (const char of word.toLowerCase()) {
			if (!/[a-z]/.test(char) || seen.has(char)) continue;
			seen.add(char);

			if (!counts.has(char)) {
				counts.set(char, { count: 0, words: new Map() });
			}
			const entry = counts.get(char)!;
			entry.count++;
			entry.words.set(word, (entry.words.get(word) ?? 0) + 1);
		}
	}
}
