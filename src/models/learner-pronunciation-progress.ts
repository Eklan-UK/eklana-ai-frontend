// models/learner-pronunciation-progress.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';

export interface ILearnerPronunciationProgress extends Document {
	_id: Types.ObjectId;
	learnerId: Types.ObjectId; // Reference to Learner
	problemId: Types.ObjectId; // Reference to PronunciationProblem
	wordId: Types.ObjectId; // Reference to PronunciationWord
	
	// Attempt tracking
	attempts: number; // Total number of attempts
	accuracyScores: number[]; // All attempt scores (0-100)
	bestScore?: number; // Best score achieved
	averageScore?: number; // Average of all attempts
	
	// Challenge indicators
	isChallenging: boolean; // true if attempts > 3 OR averageScore < 70
	challengeLevel?: 'low' | 'medium' | 'high'; // Based on attempts & scores
	
	// Phoneme-level tracking
	weakPhonemes: string[]; // Phonemes with consistently low scores
	incorrectLetters: string[]; // Letters frequently mispronounced
	
	// Status
	passed: boolean; // Whether word has been passed
	passedAt?: Date; // When word was first passed
	lastAttemptAt?: Date; // Last attempt timestamp
	
	// Metadata
	createdAt: Date;
	updatedAt: Date;
}

const learnerPronunciationProgressSchema = new Schema<ILearnerPronunciationProgress>(
	{
		learnerId: {
			type: Schema.Types.ObjectId,
			ref: 'Learner',
			required: [true, 'Learner ID is required'],
			index: true,
		},
		problemId: {
			type: Schema.Types.ObjectId,
			ref: 'PronunciationProblem',
			required: [true, 'Problem ID is required'],
			index: true,
		},
		wordId: {
			type: Schema.Types.ObjectId,
			ref: 'PronunciationWord',
			required: [true, 'Word ID is required'],
			index: true,
		},
		attempts: {
			type: Number,
			default: 0,
			min: 0,
		},
		accuracyScores: {
			type: [Number],
			default: [],
		},
		bestScore: {
			type: Number,
			min: 0,
			max: 100,
		},
		averageScore: {
			type: Number,
			min: 0,
			max: 100,
		},
		isChallenging: {
			type: Boolean,
			default: false,
			index: true,
		},
		challengeLevel: {
			type: String,
			enum: ['low', 'medium', 'high'],
		},
		weakPhonemes: {
			type: [String],
			default: [],
		},
		incorrectLetters: {
			type: [String],
			default: [],
		},
		passed: {
			type: Boolean,
			default: false,
			index: true,
		},
		passedAt: {
			type: Date,
		},
		lastAttemptAt: {
			type: Date,
		},
	},
	{
		timestamps: true,
		collection: 'learner_pronunciation_progress',
	}
);

// Unique constraint: one progress record per learner-word combination
learnerPronunciationProgressSchema.index({ learnerId: 1, wordId: 1 }, { unique: true });

// Indexes for performance
learnerPronunciationProgressSchema.index({ learnerId: 1, problemId: 1, passed: 1 });
learnerPronunciationProgressSchema.index({ learnerId: 1, isChallenging: 1, passed: 1 });
learnerPronunciationProgressSchema.index({ problemId: 1, passed: 1 });
learnerPronunciationProgressSchema.index({ wordId: 1, passed: 1 });

// Pre-save middleware to calculate challenge indicators
learnerPronunciationProgressSchema.pre('save', function (next) {
	if (this.accuracyScores.length > 0) {
		// Calculate average score
		this.averageScore = this.accuracyScores.reduce((sum, score) => sum + score, 0) / this.accuracyScores.length;
		
		// Find best score
		this.bestScore = Math.max(...this.accuracyScores);
		
		// Determine if challenging
		this.isChallenging = this.attempts > 3 || (this.averageScore || 0) < 70;
		
		// Determine challenge level
		if (this.attempts > 5 && (this.averageScore || 0) < 60) {
			this.challengeLevel = 'high';
		} else if (this.attempts > 3 || (this.averageScore || 0) < 70) {
			this.challengeLevel = 'medium';
		} else if (this.weakPhonemes.length > 0) {
			this.challengeLevel = 'low';
		} else {
			this.challengeLevel = undefined;
		}
	}
	next();
});

export default models?.LearnerPronunciationProgress || model<ILearnerPronunciationProgress>('LearnerPronunciationProgress', learnerPronunciationProgressSchema);

