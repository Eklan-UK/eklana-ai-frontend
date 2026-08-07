import type {
	PrecisionClinicDrillType,
	PrecisionClinicDifficulty,
	ClinicSoundGroup,
	ClinicKeyPhraseQuestion,
	ClinicMatchingPair,
	ClinicGrammarPattern,
	ClinicSentenceWritingWord,
} from '@/hooks/usePrecisionClinic';

export type ClinicLearnerOption = {
	_id: string;
	firstName?: string;
	lastName?: string;
	name?: string;
	email?: string;
};

export type ClinicCreateFormState = {
	title: string;
	type: PrecisionClinicDrillType;
	difficulty: PrecisionClinicDifficulty;
	context: string;
	completionDate: string;
	durationDays: number;
	preGenerateAudio: boolean;
	ttsVoiceKey: string;
	assignedLearnerIds: string[];
	soundGroups: ClinicSoundGroup[];
	questions: ClinicKeyPhraseQuestion[];
	pairs: ClinicMatchingPair[];
	patterns: ClinicGrammarPattern[];
	words: ClinicSentenceWritingWord[];
	contentTitle: string;
	content: string;
	articleTitle: string;
	articleContent: string;
	/** Raw text from import/paste for listening/summary fallbacks */
	importedText: string;
};

export type ClinicAiModalState = {
	studentIds: string[];
	title: string;
	drillTypes: PrecisionClinicDrillType[];
	difficulty: PrecisionClinicDifficulty;
	context: string;
	prompt: string;
};
