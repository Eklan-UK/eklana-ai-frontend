import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/user';

const WeaknessSignalSchema = new Schema(
	{
		drillType: { type: String, required: true },
		category: {
			type: String,
			enum: ['pronunciation', 'fluency', 'vocabulary', 'grammar'],
			required: true,
		},
		severity: { type: Number, required: true, min: 0, max: 1 },
		evidence: { type: [String], default: [] },
		label: { type: String, required: true },
	},
	{ _id: false },
);

const PronunciationItemSchema = new Schema(
	{
		word: { type: String, required: true },
		sentence: { type: String, required: true },
		sound: { type: String },
		wordAudioUrl: { type: String },
		sentenceAudioUrl: { type: String },
	},
	{ _id: false },
);

const FillBlankBlankSchema = new Schema(
	{
		position: { type: Number, required: true },
		correctAnswer: { type: String, required: true },
		options: { type: [String], required: true },
		hint: { type: String },
	},
	{ _id: false },
);

const FillBlankItemSchema = new Schema(
	{
		sentence: { type: String, required: true },
		blanks: { type: [FillBlankBlankSchema], required: true },
		translation: { type: String },
		audioUrl: { type: String },
	},
	{ _id: false },
);

const KeyPhraseItemSchema = new Schema(
	{
		prompt: { type: String, required: true },
		options: { type: [String], required: true },
		correctAnswer: { type: String, required: true },
		respondentName: { type: String },
		promptAudioUrl: { type: String },
	},
	{ _id: false },
);

const RoleplayDialogueSchema = new Schema(
	{
		speaker: { type: String, required: true },
		text: { type: String, required: true },
		translation: { type: String },
		audioUrl: { type: String },
	},
	{ _id: false },
);

const RoleplaySceneSchema = new Schema(
	{
		scene_name: { type: String },
		context: { type: String },
		dialogue: { type: [RoleplayDialogueSchema], default: [] },
	},
	{ _id: false },
);

const ChallengeDrillItemSchema = new Schema(
	{
		drillType: {
			type: String,
			enum: ['pronunciation', 'fill_blank', 'key_phrases', 'roleplay'],
			required: true,
		},
		targetWeakness: { type: WeaknessSignalSchema, required: true },
		instructions: { type: String, required: true },
		generatedContent: { type: Schema.Types.Mixed, required: true },
		estimatedMinutes: { type: Number, required: true, min: 1 },
	},
	{ _id: false },
);

const WeaknessProfileSchema = new Schema(
	{
		learnerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
		weekStartDate: { type: Date, required: true },
		weaknesses: { type: [WeaknessSignalSchema], default: [] },
		topWeaknesses: { type: [WeaknessSignalSchema], default: [] },
		generatedAt: { type: Date, required: true },
	},
	{ _id: false },
);

export interface IWeeklyChallenge extends Document {
	_id: Types.ObjectId;
	learnerId: Types.ObjectId;
	weekStartDate: Date;
	weaknessProfile?: {
		learnerId: Types.ObjectId;
		weekStartDate: Date;
		weaknesses: Array<{
			drillType: string;
			category: 'pronunciation' | 'fluency' | 'vocabulary' | 'grammar';
			severity: number;
			evidence: string[];
			label: string;
		}>;
		topWeaknesses: Array<{
			drillType: string;
			category: 'pronunciation' | 'fluency' | 'vocabulary' | 'grammar';
			severity: number;
			evidence: string[];
			label: string;
		}>;
		generatedAt: Date;
	};
	challengeType: 'structured_drill_sequence';
	content: {
		drillSequence: Array<{
			drillType: 'pronunciation' | 'fill_blank' | 'key_phrases' | 'roleplay';
			targetWeakness: {
				drillType: string;
				category: 'pronunciation' | 'fluency' | 'vocabulary' | 'grammar';
				severity: number;
				evidence: string[];
				label: string;
			};
			instructions: string;
			generatedContent: Record<string, unknown>;
			estimatedMinutes: number;
		}>;
		totalEstimatedMinutes: number;
		summaryMessage: string;
	};
	status: 'pending' | 'generating' | 'ready' | 'failed';
	completedItemIndexes: number[];
	generatedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

const weeklyChallengeSchema = new Schema<IWeeklyChallenge>(
	{
		learnerId: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			index: true,
		},
		weekStartDate: {
			type: Date,
			required: true,
		},
		weaknessProfile: {
			type: WeaknessProfileSchema,
		},
		challengeType: {
			type: String,
			enum: ['structured_drill_sequence'],
			default: 'structured_drill_sequence',
		},
		content: {
			drillSequence: { type: [ChallengeDrillItemSchema], default: [] },
			totalEstimatedMinutes: { type: Number, default: 0 },
			summaryMessage: { type: String, default: '' },
		},
		status: {
			type: String,
			enum: ['pending', 'generating', 'ready', 'failed'],
			default: 'pending',
		},
		completedItemIndexes: {
			type: [Number],
			default: [],
		},
		generatedAt: {
			type: Date,
		},
	},
	{
		timestamps: true,
		collection: 'weekly_challenges',
	},
);

weeklyChallengeSchema.index({ learnerId: 1, weekStartDate: 1 }, { unique: true });

const WeeklyChallengeModel =
	models.WeeklyChallenge ||
	model<IWeeklyChallenge>('WeeklyChallenge', weeklyChallengeSchema);

export default WeeklyChallengeModel;
