// models/word-analytics.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';
import crypto from 'crypto';

export interface IWordAnalytics extends Document {
	_id: Types.ObjectId;
	learnerId: Types.ObjectId;
	word: string; // Normalized lowercase
	wordHash: string; // Hash for faster lookups

	// Difficulty Tracking
	difficultyScore: number; // 0-100, higher = harder for this learner
	initialDifficulty: number; // First attempt difficulty
	currentDifficulty: number; // Latest difficulty

	// Performance Metrics
	totalAttempts: number;
	successfulAttempts: number;
	averageScore: number; // Average pronunciation/usage score
	bestScore: number;
	worstScore: number;

	// Improvement Tracking
	improvementRate: number; // Percentage improvement over time
	masteryLevel: 'struggling' | 'learning' | 'practicing' | 'mastered';

	// Context Tracking
	contexts: string[]; // Sentences/contexts where word appeared
	drillTypes: string[]; // Types of drills where word was used

	// Timestamps
	firstEncountered: Date;
	lastPracticed: Date;
	masteredAt?: Date;

	// Trends (for analytics) - limited to last 20 entries
	scoreHistory: Array<{
		date: Date;
		score: number;
		drillId: Types.ObjectId;
	}>;

	createdAt: Date;
	updatedAt: Date;

	// Methods
	updateFromAttempt(
		score: number,
		drillId: Types.ObjectId,
		drillType: string,
		context?: string
	): void;
}

const wordAnalyticsSchema = new Schema<IWordAnalytics>(
	{
		learnerId: {
			type: Schema.Types.ObjectId,
			ref: 'Learner',
			required: [true, 'Learner ID is required'],
			index: true,
		},
		word: {
			type: String,
			required: [true, 'Word is required'],
			trim: true,
			lowercase: true,
		},
		wordHash: {
			type: String,
			required: true,
			index: true,
		},
		difficultyScore: {
			type: Number,
			default: 50,
			min: 0,
			max: 100,
		},
		initialDifficulty: {
			type: Number,
			default: 50,
			min: 0,
			max: 100,
		},
		currentDifficulty: {
			type: Number,
			default: 50,
			min: 0,
			max: 100,
		},
		totalAttempts: {
			type: Number,
			default: 0,
			min: 0,
		},
		successfulAttempts: {
			type: Number,
			default: 0,
			min: 0,
		},
		averageScore: {
			type: Number,
			default: 0,
			min: 0,
			max: 100,
		},
		bestScore: {
			type: Number,
			default: 0,
			min: 0,
			max: 100,
		},
		worstScore: {
			type: Number,
			default: 100,
			min: 0,
			max: 100,
		},
		improvementRate: {
			type: Number,
			default: 0,
			min: -100,
			max: 100,
		},
		masteryLevel: {
			type: String,
			enum: ['struggling', 'learning', 'practicing', 'mastered'],
			default: 'learning',
		},
		contexts: {
			type: [String],
			default: [],
		},
		drillTypes: {
			type: [String],
			default: [],
		},
		firstEncountered: {
			type: Date,
			default: Date.now,
		},
		lastPracticed: {
			type: Date,
			default: Date.now,
		},
		masteredAt: {
			type: Date,
			default: null,
		},
		scoreHistory: [
			{
				date: {
					type: Date,
					required: true,
				},
				score: {
					type: Number,
					required: true,
					min: 0,
					max: 100,
				},
				drillId: {
					type: Schema.Types.ObjectId,
					ref: 'Drill',
				},
			},
		],
	},
	{
		timestamps: true,
		collection: 'word_analytics',
	}
);

// Indexes for performance
// Unique word per learner
wordAnalyticsSchema.index({ learnerId: 1, wordHash: 1 }, { unique: true });

// Get struggling words
wordAnalyticsSchema.index({ learnerId: 1, masteryLevel: 1, difficultyScore: -1 });

// Recently practiced words
wordAnalyticsSchema.index({ learnerId: 1, lastPracticed: -1 });

// Global word analytics
wordAnalyticsSchema.index({ wordHash: 1 });

// Pre-save middleware to generate word hash
wordAnalyticsSchema.pre('save', function () {
	if (!this.wordHash && this.word) {
		this.wordHash = crypto
			.createHash('md5')
			.update(this.word.toLowerCase().trim())
			.digest('hex');
	}
});

// Method to update analytics from a new attempt
wordAnalyticsSchema.methods.updateFromAttempt = function (
	score: number,
	drillId: Types.ObjectId,
	drillType: string,
	context?: string
) {
	this.totalAttempts += 1;
	if (score >= 70) {
		this.successfulAttempts += 1;
	}

	// Update scores
	const previousAverage = this.averageScore;
	this.averageScore =
		(this.averageScore * (this.totalAttempts - 1) + score) / this.totalAttempts;

	if (score > this.bestScore) {
		this.bestScore = score;
	}
	if (score < this.worstScore) {
		this.worstScore = score;
	}

	// Update difficulty (inverse of performance)
	this.currentDifficulty = 100 - this.averageScore;
	if (!this.initialDifficulty) {
		this.initialDifficulty = this.currentDifficulty;
	}

	// Calculate improvement rate
	if (this.initialDifficulty > 0) {
		this.improvementRate =
			((this.initialDifficulty - this.currentDifficulty) / this.initialDifficulty) * 100;
	}

	// Update mastery level
	if (this.averageScore >= 90 && this.successfulAttempts >= 3) {
		this.masteryLevel = 'mastered';
		if (!this.masteredAt) {
			this.masteredAt = new Date();
		}
	} else if (this.averageScore >= 70) {
		this.masteryLevel = 'practicing';
	} else if (this.averageScore >= 50) {
		this.masteryLevel = 'learning';
	} else {
		this.masteryLevel = 'struggling';
	}

	// Add to score history (keep last 20)
	this.scoreHistory.push({
		date: new Date(),
		score,
		drillId,
	});
	if (this.scoreHistory.length > 20) {
		this.scoreHistory.shift();
	}

	// Update contexts and drill types
	if (context && !this.contexts.includes(context)) {
		this.contexts.push(context);
	}
	if (drillType && !this.drillTypes.includes(drillType)) {
		this.drillTypes.push(drillType);
	}

	this.lastPracticed = new Date();
};

// Prevent model recompilation in Next.js development
const WordAnalyticsModel = models.WordAnalytics || model<IWordAnalytics>('WordAnalytics', wordAnalyticsSchema);
export default WordAnalyticsModel;

