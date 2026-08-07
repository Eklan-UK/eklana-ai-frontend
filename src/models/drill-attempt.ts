// models/drill-attempt.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

export interface IDrillAttempt extends Document {
	_id: Types.ObjectId;
	drillAssignmentId: Types.ObjectId; // Which assignment
	// Better Auth (web sign-up, incl. Google/Apple OAuth) assigns UUID string
	// user ids; legacy/mobile accounts use ObjectId.
	learnerId: Types.ObjectId | string;
	drillId: Types.ObjectId;
	drillType?: string;

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

	pronunciationResults?: {
		wordScores: Array<{
			word: string;
			score: number;
			attempts: number;
			pronunciationScore?: number;
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
		/** Per successful lock: duration since previous lock (or session start for first), with canonical pair labels. */
		pairMatchEvents?: Array<{
			durationSec: number;
			left: string;
			right: string;
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
			// Reviewer (tutor/admin) id — Better Auth accounts may have a UUID _id.
			reviewedBy?: Types.ObjectId | string;
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
			reviewedBy?: Types.ObjectId | string; // Tutor/admin who reviewed; Better Auth accounts may have a UUID _id
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
			reviewedBy?: Types.ObjectId | string; // Better Auth accounts may have a UUID _id
		};
	};

	listeningResults?: {
		completed: boolean;
		timeSpent: number;
	};

	fillBlankResults?: {
		items: Array<{
			sentence: string;
			blanks: Array<{
				position: number;
				selectedAnswer: string;
				correctAnswer: string;
				isCorrect: boolean;
			}>;
		}>;
		totalBlanks?: number;
		correctBlanks?: number;
		score?: number;
	};

	keyPhrasesResults?: {
		items: Array<{
			prompt: string;
			selectedAnswer: string;
			correctAnswer: string;
			isCorrect: boolean;
			pronunciationScore?: number;
			textScore?: Record<string, unknown>;
			attempts: number;
		}>;
		totalItems: number;
		correctItems: number;
		score: number;
	};

	/** Frozen copy of in-drill Review Performance (Speechace groups) for admin/tutor replay */
	performanceReviewSnapshot?: Record<string, unknown>;

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
		// Mixed (not ObjectId) so UUID user ids (Better Auth web sign-up,
		// incl. Google/Apple OAuth) can be stored without a cast error. No
		// `ref` since populate cannot reliably resolve a mixed-type field;
		// `model: User` is passed explicitly at populate call sites instead.
		type: Schema.Types.Mixed,
		required: [true, 'User ID is required'],
		// Removed index: true - covered by compound index { learnerId: 1, completedAt: -1 }
	},
		drillId: {
			type: Schema.Types.ObjectId,
			ref: 'Drill',
			required: [true, 'Drill ID is required'],
			// Removed index: true - covered by compound index { drillId: 1, completedAt: -1 }
		},
		drillType: {
			type: String,
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
		pronunciationResults: {
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
			pairMatchEvents: [
				{
					durationSec: Number,
					left: String,
					right: String,
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
			// No default: a nested default here contaminated EVERY DrillAttempt.create
			// (roleplay/key_phrases/etc.) with grammarResults.reviewStatus='pending'.
			// Submit payloads set 'pending' only for real grammar drills.
			reviewStatus: {
				type: String,
				enum: ['pending', 'reviewed'],
			},
			patternReviews: [
				{
					patternIndex: Number,
					sentenceIndex: Number,
					isCorrect: Boolean,
					correctedText: String,
					reviewedAt: Date,
					reviewedBy: {
						// Mixed (not ObjectId): the reviewing tutor/admin may be a
						// Better Auth account with a UUID _id, same as learnerId.
						type: Schema.Types.Mixed,
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
			// No default — set only when sentence submit payload includes it.
			reviewStatus: {
				type: String,
				enum: ['pending', 'reviewed'],
			},
			sentenceReviews: [
				{
					sentenceIndex: Number,
					isCorrect: Boolean,
					correctedText: String,
					reviewedAt: Date,
					reviewedBy: {
						// Mixed (not ObjectId): the reviewing tutor/admin may be a
						// Better Auth account with a UUID _id, same as learnerId.
						type: Schema.Types.Mixed,
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
			// No default — set only when summary submit payload includes it.
			reviewStatus: {
				type: String,
				enum: ['pending', 'reviewed'],
			},
			review: {
				feedback: String,
				isAcceptable: Boolean,
				correctedVersion: String,
				reviewedAt: Date,
				reviewedBy: {
					// Mixed (not ObjectId): the reviewing tutor/admin may be a
					// Better Auth account with a UUID _id, same as learnerId.
					type: Schema.Types.Mixed,
				},
			},
		},
		listeningResults: {
			completed: Boolean,
			timeSpent: Number,
		},
		fillBlankResults: {
			items: [
				{
					sentence: String,
					blanks: [
						{
							position: Number,
							selectedAnswer: String,
							correctAnswer: String,
							isCorrect: Boolean,
						},
					],
				},
			],
			totalBlanks: Number,
			correctBlanks: Number,
			score: Number,
		},
		keyPhrasesResults: {
			items: [
				{
					prompt: String,
					selectedAnswer: String,
					correctAnswer: String,
					isCorrect: Boolean,
					pronunciationScore: Number,
					textScore: Schema.Types.Mixed,
					attempts: Number,
				},
			],
			totalItems: Number,
			correctItems: Number,
			score: Number,
		},
		performanceReviewSnapshot: {
			type: Schema.Types.Mixed,
			default: undefined,
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
// Daily practice reminder: qualifying attempts by learner + day window
drillAttemptSchema.index({ learnerId: 1, completedAt: -1, score: 1 });

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

