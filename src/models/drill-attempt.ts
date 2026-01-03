// models/drill-attempt.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';

export interface IDrillAttempt extends Document {
	_id: Types.ObjectId;
	drillAssignmentId: Types.ObjectId; // Which assignment
	learnerId: Types.ObjectId;
	drillId: Types.ObjectId;

	// Performance Data
	startedAt: Date;
	completedAt?: Date;
	timeSpent: number; // seconds
	score?: number; // Overall score (0-100)
	maxScore: number;

	// Type-specific results
	vocabularyResults?: {
		wordScores: Array<{
			word: string;
			score: number;
			attempts: number;
			pronunciationScore?: number; // From Speechace
		}>;
	};

	roleplayResults?: {
		sceneScores: Array<{
			sceneName: string;
			score: number;
			fluencyScore?: number;
			pronunciationScore?: number;
		}>;
	};

	matchingResults?: {
		pairsMatched: number;
		totalPairs: number;
		accuracy: number;
		incorrectPairs?: Array<{
			left: string;
			right: string;
			attemptedMatch: string;
		}>;
	};

	definitionResults?: {
		wordsDefined: number;
		totalWords: number;
		accuracy: number;
		wordScores: Array<{
			word: string;
			score: number;
			attempts: number;
		}>;
	};

	grammarResults?: {
		patternsPracticed: number;
		totalPatterns: number;
		accuracy: number;
		patternScores: Array<{
			pattern: string;
			score: number;
			attempts: number;
		}>;
	};

	sentenceWritingResults?: {
		sentencesWritten: number;
		totalSentences: number;
		accuracy: number;
		wordScores: Array<{
			word: string;
			score: number;
			attempts: number;
		}>;
	};

	summaryResults?: {
		summaryProvided: boolean;
		score?: number;
		wordCount?: number;
		qualityScore?: number;
	};

	// Metadata
	deviceInfo?: string;
	platform?: 'web' | 'ios' | 'android';
	createdAt: Date;
	updatedAt: Date;
}

const drillAttemptSchema = new Schema<IDrillAttempt>(
	{
		drillAssignmentId: {
			type: Schema.Types.ObjectId,
			ref: 'DrillAssignment',
			required: [true, 'Drill assignment ID is required'],
			index: true,
		},
		learnerId: {
			type: Schema.Types.ObjectId,
			ref: 'Learner',
			required: [true, 'Learner ID is required'],
			index: true,
		},
		drillId: {
			type: Schema.Types.ObjectId,
			ref: 'Drill',
			required: [true, 'Drill ID is required'],
			index: true,
		},
		startedAt: {
			type: Date,
			default: Date.now,
			required: true,
		},
		completedAt: {
			type: Date,
			default: null,
		},
		timeSpent: {
			type: Number,
			default: 0,
			min: 0,
		},
		score: {
			type: Number,
			min: 0,
			max: 100,
		},
		maxScore: {
			type: Number,
			default: 100,
			min: 0,
		},
		vocabularyResults: {
			wordScores: [
				{
					word: String,
					score: Number,
					attempts: Number,
					pronunciationScore: Number,
				},
			],
		},
		roleplayResults: {
			sceneScores: [
				{
					sceneName: String,
					score: Number,
					fluencyScore: Number,
					pronunciationScore: Number,
				},
			],
		},
		matchingResults: {
			pairsMatched: Number,
			totalPairs: Number,
			accuracy: Number,
			incorrectPairs: [
				{
					left: String,
					right: String,
					attemptedMatch: String,
				},
			],
		},
		definitionResults: {
			wordsDefined: Number,
			totalWords: Number,
			accuracy: Number,
			wordScores: [
				{
					word: String,
					score: Number,
					attempts: Number,
				},
			],
		},
		grammarResults: {
			patternsPracticed: Number,
			totalPatterns: Number,
			accuracy: Number,
			patternScores: [
				{
					pattern: String,
					score: Number,
					attempts: Number,
				},
			],
		},
		sentenceWritingResults: {
			sentencesWritten: Number,
			totalSentences: Number,
			accuracy: Number,
			wordScores: [
				{
					word: String,
					score: Number,
					attempts: Number,
				},
			],
		},
		summaryResults: {
			summaryProvided: Boolean,
			score: Number,
			wordCount: Number,
			qualityScore: Number,
		},
		deviceInfo: {
			type: String,
		},
		platform: {
			type: String,
			enum: ['web', 'ios', 'android'],
		},
	},
	{
		timestamps: true,
		collection: 'drill_attempts',
	}
);

// Indexes for performance
// Learner's completion history
drillAttemptSchema.index({ learnerId: 1, completedAt: -1 });

// Drill performance analytics
drillAttemptSchema.index({ drillId: 1, completedAt: -1 });

// Get all attempts for an assignment
drillAttemptSchema.index({ drillAssignmentId: 1, completedAt: -1 });

// Virtual for completion status
drillAttemptSchema.virtual('isCompleted').get(function () {
	return !!this.completedAt;
});

// Virtual for calculating time spent if not set
drillAttemptSchema.virtual('calculatedTimeSpent').get(function () {
	if (this.completedAt && this.startedAt) {
		return Math.floor((this.completedAt.getTime() - this.startedAt.getTime()) / 1000);
	}
	return this.timeSpent || 0;
});

// Pre-save middleware to calculate time spent
drillAttemptSchema.pre('save', function () {
	if (this.completedAt && this.startedAt && !this.timeSpent) {
		this.timeSpent = Math.floor(
			(this.completedAt.getTime() - this.startedAt.getTime()) / 1000
		);
	}
});

// Prevent model recompilation in Next.js development
const DrillAttemptModel = models.DrillAttempt || model<IDrillAttempt>('DrillAttempt', drillAttemptSchema);
export default DrillAttemptModel;

