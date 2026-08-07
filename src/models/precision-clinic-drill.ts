import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/user';
import {
	PRECISION_CLINIC_DRILL_TYPES,
	PRECISION_CLINIC_DIFFICULTIES,
	type PrecisionClinicDrillType,
	type PrecisionClinicDifficulty,
	type ClinicSoundGroup,
	type ClinicKeyPhraseQuestion,
	type ClinicMatchingPair,
	type ClinicGrammarPattern,
	type ClinicSentenceWritingWord,
} from './precision-clinic-drill.shared';

export {
	PRECISION_CLINIC_DRILL_TYPES,
	PRECISION_CLINIC_DIFFICULTIES,
	PRECISION_CLINIC_DRILL_TYPE_LABELS,
	type PrecisionClinicDrillType,
	type PrecisionClinicDifficulty,
	type PrecisionClinicPublishStatus,
	type ClinicSoundGroup,
	type ClinicPronunciationWord,
	type ClinicKeyPhraseQuestion,
	type ClinicMatchingPair,
	type ClinicGrammarPattern,
	type ClinicSentenceWritingWord,
} from './precision-clinic-drill.shared';

export interface IPrecisionClinicDrill extends Document {
	title: string;
	type: PrecisionClinicDrillType;
	difficulty: PrecisionClinicDifficulty;
	context: string;
	completionDate?: Date | null;
	durationDays: number;
	preGenerateAudio: boolean;
	ttsVoiceKey?: string | null;
	/**
	 * Learner ids assigned to this clinic drill.
	 * Mixed: Better Auth UUID strings + legacy ObjectId.
	 * Published = length > 0; Draft = empty.
	 */
	assignedLearnerIds: Array<Types.ObjectId | string>;
	/** Creator user id (Mixed for UUID/ObjectId). */
	createdBy?: Types.ObjectId | string | null;
	createdByEmail?: string;
	isArchived: boolean;
	// Type-specific (only fields for the active type are populated)
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

const ClinicPronunciationWordSchema = new Schema(
	{
		word: { type: String, required: true, trim: true },
		practiceSentence: { type: String, required: true, trim: true },
	},
	{ _id: false }
);

const ClinicSoundGroupSchema = new Schema(
	{
		targetSound: { type: String, required: true, trim: true },
		words: { type: [ClinicPronunciationWordSchema], default: [] },
	},
	{ _id: false }
);

const ClinicKeyPhraseQuestionSchema = new Schema(
	{
		respondentName: { type: String, default: '', trim: true },
		prompt: { type: String, required: true, trim: true },
		options: { type: [String], default: [] },
		correctAnswer: { type: String, required: true, trim: true },
	},
	{ _id: false }
);

const ClinicMatchingPairSchema = new Schema(
	{
		left: { type: String, required: true, trim: true },
		right: { type: String, required: true, trim: true },
		leftTranslation: { type: String, default: '', trim: true },
		rightTranslation: { type: String, default: '', trim: true },
	},
	{ _id: false }
);

const ClinicGrammarPatternSchema = new Schema(
	{
		pattern: { type: String, required: true, trim: true },
		exampleSentence: { type: String, required: true, trim: true },
		hint: { type: String, default: '', trim: true },
	},
	{ _id: false }
);

const ClinicSentenceWritingWordSchema = new Schema(
	{
		word: { type: String, required: true, trim: true },
		hint: { type: String, default: '', trim: true },
	},
	{ _id: false }
);

const PrecisionClinicDrillSchema = new Schema<IPrecisionClinicDrill>(
	{
		title: {
			type: String,
			required: [true, 'Title is required'],
			trim: true,
			maxlength: 200,
		},
		type: {
			type: String,
			enum: PRECISION_CLINIC_DRILL_TYPES,
			required: [true, 'Type is required'],
		},
		difficulty: {
			type: String,
			enum: PRECISION_CLINIC_DIFFICULTIES,
			default: 'intermediate',
		},
		context: {
			type: String,
			default: '',
			trim: true,
		},
		completionDate: {
			type: Date,
			default: null,
		},
		durationDays: {
			type: Number,
			default: 1,
			min: 1,
		},
		preGenerateAudio: {
			type: Boolean,
			default: false,
		},
		ttsVoiceKey: {
			type: String,
			default: null,
			trim: true,
		},
		assignedLearnerIds: {
			// Mixed so UUID (Better Auth) and ObjectId learner ids both store.
			type: [Schema.Types.Mixed],
			default: [],
		},
		createdBy: {
			type: Schema.Types.Mixed,
			default: null,
		},
		createdByEmail: {
			type: String,
			default: '',
			trim: true,
		},
		isArchived: {
			type: Boolean,
			default: false,
		},
		// Pronunciation
		soundGroups: { type: [ClinicSoundGroupSchema], default: [] },
		// Key phrases
		questions: { type: [ClinicKeyPhraseQuestionSchema], default: [] },
		// Matching
		pairs: { type: [ClinicMatchingPairSchema], default: [] },
		// Grammar
		patterns: { type: [ClinicGrammarPatternSchema], default: [] },
		// Sentence writing
		words: { type: [ClinicSentenceWritingWordSchema], default: [] },
		// Listening
		contentTitle: { type: String, default: '', trim: true },
		content: { type: String, default: '' },
		// Summary
		articleTitle: { type: String, default: '', trim: true },
		articleContent: { type: String, default: '' },
	},
	{ timestamps: true, collection: 'precision_clinic_drills' }
);

PrecisionClinicDrillSchema.index({ type: 1 });
PrecisionClinicDrillSchema.index({ isArchived: 1 });
PrecisionClinicDrillSchema.index({ assignedLearnerIds: 1 });
PrecisionClinicDrillSchema.index({ createdAt: -1 });

const PrecisionClinicDrill =
	models.PrecisionClinicDrill ||
	model<IPrecisionClinicDrill>(
		'PrecisionClinicDrill',
		PrecisionClinicDrillSchema
	);

export default PrecisionClinicDrill;
