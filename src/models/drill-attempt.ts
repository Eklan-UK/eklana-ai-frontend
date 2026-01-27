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
		patternsPracticed?: number;
		totalPatterns?: number;
		accuracy?: number;
		patternScores?: Array<{
			pattern: string;
			score: number;
			attempts: number;
		}>;
		// New structure for reviewable grammar drills
		patterns?: Array<{
			pattern: string;
			example: string;
			hint?: string;
			sentences: Array<{ text: string; index: number }>;
		}>;
		reviewStatus?: 'pending' | 'reviewed';
		patternReviews?: Array<{
			patternIndex: number;
			sentenceIndex: number;
			isCorrect: boolean;
			correctedText?: string;
			reviewedAt?: Date;
			reviewedBy?: Types.ObjectId;
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

	sentenceResults?: {
		word: string; // Target word (for single word drills or backwards compatibility)
		definition: string; // User's definition (not reviewed)
		sentences: Array<{
			text: string; // User's sentence
			index: number; // 0 or 1
		}>;
		// Multi-word support
		words?: Array<{
			word: string;
			definition: string;
			sentences: Array<{
				text: string;
				index: number;
			}>;
		}>;
		reviewStatus: 'pending' | 'reviewed';
		sentenceReviews?: Array<{
			sentenceIndex: number; // Global index across all words
			isCorrect: boolean;
			correctedText?: string; // Only if isCorrect is false
			reviewedAt?: Date;
			reviewedBy?: Types.ObjectId; // Tutor/admin who reviewed
		}>;
	};

	summaryResults?: {
		summaryProvided: boolean;
		articleTitle?: string;
		articleContent?: string;
		summary?: string; // User's written summary
		wordCount?: number;
		score?: number;
		qualityScore?: number;
		reviewStatus?: 'pending' | 'reviewed';
		review?: {
			feedback?: string; // Admin/tutor feedback
			isAcceptable: boolean;
			correctedVersion?: string; // Optional improved version
			reviewedAt?: Date;
			reviewedBy?: Types.ObjectId;
		};
	};

	listeningResults?: {
		completed: boolean;
		timeSpent: number;
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
			// Removed index: true - covered by compound index { drillAssignmentId: 1, completedAt: -1 }
		},
	learnerId: {
		type: Schema.Types.ObjectId,
		ref: 'User', // learnerId now references User (kept name for backward compatibility)
		required: [true, 'User ID is required'],
		// Removed index: true - covered by compound index { learnerId: 1, completedAt: -1 }
	},
		drillId: {
			type: Schema.Types.ObjectId,
			ref: 'Drill',
			required: [true, 'Drill ID is required'],
			// Removed index: true - covered by compound index { drillId: 1, completedAt: -1 }
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
			// New structure for reviewable grammar drills
			patterns: [
				{
					pattern: String,
					example: String,
					hint: String,
					sentences: [
						{
							text: String,
							index: Number,
						},
					],
				},
			],
			reviewStatus: {
				type: String,
				enum: ['pending', 'reviewed'],
				default: 'pending',
			},
			patternReviews: [
				{
					patternIndex: Number,
					sentenceIndex: Number,
					isCorrect: Boolean,
					correctedText: String,
					reviewedAt: Date,
					reviewedBy: {
						type: Schema.Types.ObjectId,
						ref: 'User',
					},
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
		sentenceResults: {
			word: String,
			definition: String,
			sentences: [
				{
					text: String,
					index: Number,
				},
			],
			// Multi-word support
			words: [
				{
					word: String,
					definition: String,
					sentences: [
						{
							text: String,
							index: Number,
						},
					],
				},
			],
			reviewStatus: {
				type: String,
				enum: ['pending', 'reviewed'],
				default: 'pending',
			},
			sentenceReviews: [
				{
					sentenceIndex: Number,
					isCorrect: Boolean,
					correctedText: String,
					reviewedAt: Date,
					reviewedBy: {
						type: Schema.Types.ObjectId,
						ref: 'User',
					},
				},
			],
		},
		summaryResults: {
			summaryProvided: Boolean,
			articleTitle: String,
			articleContent: String,
			summary: String,
			wordCount: Number,
			score: Number,
			qualityScore: Number,
			reviewStatus: {
				type: String,
				enum: ['pending', 'reviewed'],
				default: 'pending',
			},
			review: {
				feedback: String,
				isAcceptable: Boolean,
				correctedVersion: String,
				reviewedAt: Date,
				reviewedBy: {
					type: Schema.Types.ObjectId,
					ref: 'User',
				},
			},
		},
		listeningResults: {
			completed: Boolean,
			timeSpent: Number,
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

