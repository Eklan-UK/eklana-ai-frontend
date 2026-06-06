import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/user';
import type { WeaknessProfile, WeeklyChallenge } from '@/domain/challenges/types';

export interface IWeeklyChallenge extends Document {
	_id: Types.ObjectId;
	learnerId: Types.ObjectId;
	weekStartDate: Date;
	weaknessProfile: WeaknessProfile;
	challengeType: 'structured_drill_sequence';
	content: WeeklyChallenge['content'];
	status: 'pending' | 'generating' | 'ready' | 'failed';
	generatedAt?: Date;
	completedItemIndexes: number[];
	createdAt: Date;
	updatedAt: Date;
}

const weeklyChallengeSchema = new Schema<IWeeklyChallenge>(
	{
		learnerId: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'Learner ID is required'],
		},
		weekStartDate: {
			type: Date,
			required: [true, 'Week start date is required'],
		},
		weaknessProfile: {
			type: Schema.Types.Mixed,
			required: [true, 'Weakness profile is required'],
		},
		challengeType: {
			type: String,
			default: 'structured_drill_sequence',
		},
		content: {
			type: Schema.Types.Mixed,
		},
		status: {
			type: String,
			enum: ['pending', 'generating', 'ready', 'failed'],
			default: 'pending',
		},
		generatedAt: {
			type: Date,
		},
		completedItemIndexes: {
			type: [Number],
			default: [],
		},
	},
	{
		timestamps: true,
		collection: 'weekly_challenges',
	}
);

// One challenge per learner per week
weeklyChallengeSchema.index({ learnerId: 1, weekStartDate: 1 }, { unique: true });

const WeeklyChallengeModel =
	models.WeeklyChallenge || model<IWeeklyChallenge>('WeeklyChallenge', weeklyChallengeSchema);

export default WeeklyChallengeModel;
