// models/pronunciation-attempt.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';

export interface IPronunciationAttempt extends Document {
	_id: Types.ObjectId;
	// New structure: problem-based
	problemId?: Types.ObjectId; // Reference to PronunciationProblem
	wordId?: Types.ObjectId; // Reference to PronunciationWord
	progressId?: Types.ObjectId; // Reference to LearnerPronunciationProgress
	// Legacy structure: assignment-based (for backward compatibility)
	pronunciationAssignmentId?: Types.ObjectId; // Reference to PronunciationAssignment
	pronunciationId?: Types.ObjectId; // Reference to Pronunciation
	learnerId: Types.ObjectId; // Reference to Learner
	// Speechace evaluation results
	textScore: number; // Overall pronunciation score (0-100)
	fluencyScore?: number; // Fluency score if available
	passed: boolean; // Whether pronunciation met passing threshold
	passingThreshold: number; // Threshold used for this attempt (default 70)
	// Detailed word-level scores
	wordScores: Array<{
		word: string;
		score: number; // Word-level score (0-100)
		phonemes?: Array<{
			phoneme: string;
			score: number; // Phoneme-level score (0-100)
		}>;
	}>;
	// Incorrectly pronounced elements
	incorrectLetters?: string[]; // Letters not pronounced correctly
	incorrectPhonemes?: string[]; // Phonemes not pronounced correctly
	// Audio recording
	audioUrl?: string; // URL to the recorded audio (Cloudinary)
	audioDuration?: number; // Duration in seconds
	// Feedback
	textFeedback?: string; // Overall feedback
	wordFeedback?: Array<{
		word: string;
		feedback: string;
	}>;
	// Metadata
	attemptNumber: number; // Sequential attempt number for this assignment
	createdAt: Date;
	updatedAt: Date;
}

const pronunciationAttemptSchema = new Schema<IPronunciationAttempt>(
	{
		// New structure: problem-based
		problemId: {
			type: Schema.Types.ObjectId,
			ref: 'PronunciationProblem',
			// Removed index: true - covered by compound index { problemId: 1, learnerId: 1, createdAt: -1 }
		},
		wordId: {
			type: Schema.Types.ObjectId,
			ref: 'PronunciationWord',
			// Removed index: true - covered by compound index { wordId: 1, attemptNumber: -1 }
		},
		progressId: {
			type: Schema.Types.ObjectId,
			ref: 'LearnerPronunciationProgress',
			index: true,
		},
		// Legacy structure: assignment-based (for backward compatibility)
		pronunciationAssignmentId: {
			type: Schema.Types.ObjectId,
			ref: 'PronunciationAssignment',
			// Removed index: true - covered by compound index { pronunciationAssignmentId: 1, attemptNumber: -1 }
		},
		pronunciationId: {
			type: Schema.Types.ObjectId,
			ref: 'Pronunciation',
			// Removed index: true - covered by compound index { pronunciationId: 1, passed: 1 }
		},
		learnerId: {
			type: Schema.Types.ObjectId,
			ref: 'Learner',
			required: [true, 'Learner ID is required'],
			// Removed index: true - covered by compound index { learnerId: 1, createdAt: -1 }
		},
		textScore: {
			type: Number,
			required: [true, 'Text score is required'],
			min: [0, 'Score cannot be negative'],
			max: [100, 'Score cannot exceed 100'],
		},
		fluencyScore: {
			type: Number,
			min: [0, 'Fluency score cannot be negative'],
			max: [100, 'Fluency score cannot exceed 100'],
		},
		passed: {
			type: Boolean,
			required: [true, 'Pass status is required'],
			default: false,
		},
		passingThreshold: {
			type: Number,
			default: 70, // Default passing threshold is 70%
			min: [0, 'Threshold cannot be negative'],
			max: [100, 'Threshold cannot exceed 100'],
		},
		wordScores: {
			type: [
				{
					word: { type: String, required: true },
					score: { type: Number, required: true, min: 0, max: 100 },
					phonemes: {
						type: [
							{
								phoneme: { type: String, required: true },
								score: { type: Number, required: true, min: 0, max: 100 },
							},
						],
						default: [],
					},
				},
			],
			default: [],
		},
		incorrectLetters: {
			type: [String],
			default: [],
		},
		incorrectPhonemes: {
			type: [String],
			default: [],
		},
		audioUrl: {
			type: String,
		},
		audioDuration: {
			type: Number,
			min: [0, 'Duration cannot be negative'],
		},
		textFeedback: {
			type: String,
		},
		wordFeedback: {
			type: [
				{
					word: { type: String, required: true },
					feedback: { type: String, required: true },
				},
			],
			default: [],
		},
		attemptNumber: {
			type: Number,
			required: [true, 'Attempt number is required'],
			min: [1, 'Attempt number must be at least 1'],
		},
	},
	{
		timestamps: true,
		collection: 'pronunciation_attempts',
	}
);

// Indexes for performance
// New structure indexes
pronunciationAttemptSchema.index({ wordId: 1, attemptNumber: -1 });
pronunciationAttemptSchema.index({ progressId: 1, attemptNumber: -1 });
pronunciationAttemptSchema.index({ problemId: 1, learnerId: 1, createdAt: -1 });
// Legacy structure indexes (for backward compatibility)
pronunciationAttemptSchema.index({ pronunciationAssignmentId: 1, attemptNumber: -1 });
pronunciationAttemptSchema.index({ pronunciationId: 1, passed: 1 });
// General indexes
pronunciationAttemptSchema.index({ learnerId: 1, createdAt: -1 });
pronunciationAttemptSchema.index({ learnerId: 1, passed: 1, createdAt: -1 });

export default models?.PronunciationAttempt || model<IPronunciationAttempt>('PronunciationAttempt', pronunciationAttemptSchema);

