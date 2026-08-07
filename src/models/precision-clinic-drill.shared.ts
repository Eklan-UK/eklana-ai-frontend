/**
 * Shared Precision Clinic drill types (7 Figma create types only).
 * Used by the Mongoose model, domain layer, and API validation.
 */

export const PRECISION_CLINIC_DRILL_TYPES = [
	'pronunciation',
	'key_phrases',
	'matching',
	'grammar',
	'sentence_writing',
	'listening',
	'summary',
] as const;

export type PrecisionClinicDrillType =
	(typeof PRECISION_CLINIC_DRILL_TYPES)[number];

export const PRECISION_CLINIC_DIFFICULTIES = [
	'beginner',
	'intermediate',
	'advanced',
] as const;

export type PrecisionClinicDifficulty =
	(typeof PRECISION_CLINIC_DIFFICULTIES)[number];

export type PrecisionClinicPublishStatus = 'published' | 'draft';

export const PRECISION_CLINIC_DRILL_TYPE_LABELS: Record<
	PrecisionClinicDrillType,
	string
> = {
	pronunciation: 'Pronunciation',
	key_phrases: 'Key Phrases',
	matching: 'Matching',
	grammar: 'Grammar',
	sentence_writing: 'Sentence Writing',
	listening: 'Listening',
	summary: 'Summarising',
};

// ── Type-specific content shapes ──────────────────────────────────────────

export type ClinicPronunciationWord = {
	word: string;
	practiceSentence: string;
};

export type ClinicSoundGroup = {
	targetSound: string;
	words: ClinicPronunciationWord[];
};

export type ClinicKeyPhraseQuestion = {
	respondentName?: string;
	prompt: string;
	options: string[];
	correctAnswer: string;
};

export type ClinicMatchingPair = {
	left: string;
	right: string;
	leftTranslation?: string;
	rightTranslation?: string;
};

export type ClinicGrammarPattern = {
	pattern: string;
	exampleSentence: string;
	hint?: string;
};

export type ClinicSentenceWritingWord = {
	word: string;
	hint?: string;
};
