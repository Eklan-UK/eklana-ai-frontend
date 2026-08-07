import type { Types } from 'mongoose';
import type {
	PrecisionClinicDrillType,
	PrecisionClinicDifficulty,
	PrecisionClinicPublishStatus,
	ClinicSoundGroup,
	ClinicKeyPhraseQuestion,
	ClinicMatchingPair,
	ClinicGrammarPattern,
	ClinicSentenceWritingWord,
} from '@/models/precision-clinic-drill.shared';

export type {
	PrecisionClinicDrillType,
	PrecisionClinicDifficulty,
	PrecisionClinicPublishStatus,
	ClinicSoundGroup,
	ClinicKeyPhraseQuestion,
	ClinicMatchingPair,
	ClinicGrammarPattern,
	ClinicSentenceWritingWord,
} from '@/models/precision-clinic-drill.shared';

export {
	PRECISION_CLINIC_DRILL_TYPES,
	PRECISION_CLINIC_DIFFICULTIES,
	PRECISION_CLINIC_DRILL_TYPE_LABELS,
} from '@/models/precision-clinic-drill.shared';

/** Lean document shape returned by the repository. */
export interface PrecisionClinicDrill {
	_id: Types.ObjectId;
	title: string;
	type: PrecisionClinicDrillType;
	difficulty: PrecisionClinicDifficulty;
	context: string;
	completionDate?: Date | null;
	durationDays: number;
	preGenerateAudio: boolean;
	ttsVoiceKey?: string | null;
	assignedLearnerIds: Array<Types.ObjectId | string>;
	createdBy?: Types.ObjectId | string | null;
	createdByEmail?: string;
	isArchived: boolean;
	soundGroups: ClinicSoundGroup[];
	questions: ClinicKeyPhraseQuestion[];
	pairs: ClinicMatchingPair[];
	patterns: ClinicGrammarPattern[];
	words: ClinicSentenceWritingWord[];
	contentTitle: string;
	content: string;
	articleTitle: string;
	articleContent: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface PrecisionClinicListFilters {
	q?: string;
	type?: PrecisionClinicDrillType;
	difficulty?: PrecisionClinicDifficulty;
	/** published = assignedLearnerIds.length > 0; draft = empty */
	status?: PrecisionClinicPublishStatus;
	/** When true, include archived; default list excludes them. */
	includeArchived?: boolean;
	isArchived?: boolean;
	limit?: number;
	offset?: number;
}

export interface CreatePrecisionClinicDrillData {
	title: string;
	type: PrecisionClinicDrillType;
	difficulty?: PrecisionClinicDifficulty;
	context?: string;
	completionDate?: Date | string | null;
	durationDays?: number;
	preGenerateAudio?: boolean;
	ttsVoiceKey?: string | null;
	assignedLearnerIds?: Array<string | Types.ObjectId>;
	createdBy?: Types.ObjectId | string | null;
	createdByEmail?: string;
	isArchived?: boolean;
	soundGroups?: ClinicSoundGroup[];
	questions?: ClinicKeyPhraseQuestion[];
	pairs?: ClinicMatchingPair[];
	patterns?: ClinicGrammarPattern[];
	words?: ClinicSentenceWritingWord[];
	contentTitle?: string;
	content?: string;
	articleTitle?: string;
	articleContent?: string;
}

export type UpdatePrecisionClinicDrillData = Partial<CreatePrecisionClinicDrillData>;

export interface PrecisionClinicStats {
	total: number;
	practiceItems: number;
	published: number;
	assigned: number;
}

export interface PrecisionClinicListResult {
	drills: PrecisionClinicDrill[];
	total: number;
	limit: number;
	offset: number;
	stats: PrecisionClinicStats;
}
