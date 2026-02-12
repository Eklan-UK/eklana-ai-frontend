// models/progress.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

export type ProgressType = 'pronunciation' | 'drill' | 'practice';

export interface IProgress extends Document {
	_id: Types.ObjectId;
	userId: Types.ObjectId; // Reference to User (not Learner)
	type: ProgressType;
	
	// Type-specific data
	// For pronunciation type
	pronunciationData?: {
		problemId: Types.ObjectId; // Reference to PronunciationProblem
		wordId: Types.ObjectId; // Reference to PronunciationWord
		attempts: number;
		accuracyScores: number[];
		bestScore?: number;
		averageScore?: number;
		isChallenging: boolean;
		challengeLevel?: 'low' | 'medium' | 'high';
		weakPhonemes: string[];
		incorrectLetters: string[];
		passed: boolean;
		passedAt?: Date;
	};
	
	// For drill type
	drillData?: {
		drillId: Types.ObjectId; // Reference to Drill
		drillType: string; // vocabulary, roleplay, matching, etc.
		score?: number;
		timeSpent?: number; // in seconds
		completed: boolean;
		completedAt?: Date;
		attempts: number;
		results?: any; // Type-specific results (vocabularyResults, matchingResults, etc.)
	};
	
	// For practice type (extensible for future practice types)
	practiceData?: {
		practiceType: string;
		resourceId: Types.ObjectId;
		score?: number;
		completed: boolean;
		completedAt?: Date;
		metadata?: any; // Flexible metadata
	};
	
	// Common fields
	lastAttemptAt?: Date;
	
	// Metadata
	createdAt: Date;
	updatedAt: Date;
}

const progressSchema = new Schema<IProgress>(
	{
		userId: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'User ID is required'],
			index: true,
		},
		type: {
			type: String,
			enum: ['pronunciation', 'drill', 'practice'],
			required: [true, 'Progress type is required'],
			index: true,
		},
		// Pronunciation-specific data
		pronunciationData: {
			problemId: {
				type: Schema.Types.ObjectId,
				ref: 'PronunciationProblem',
			},
			wordId: {
				type: Schema.Types.ObjectId,
				ref: 'PronunciationWord',
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
			},
			passedAt: {
				type: Date,
			},
		},
		// Drill-specific data
		drillData: {
			drillId: {
				type: Schema.Types.ObjectId,
				ref: 'Drill',
			},
			drillType: {
				type: String,
			},
			score: {
				type: Number,
				min: 0,
				max: 100,
			},
			timeSpent: {
				type: Number,
				min: 0,
			},
			completed: {
				type: Boolean,
				default: false,
			},
			completedAt: {
				type: Date,
			},
			attempts: {
				type: Number,
				default: 0,
				min: 0,
			},
			results: {
				type: Schema.Types.Mixed,
			},
		},
		// Practice-specific data (extensible)
		practiceData: {
			practiceType: {
				type: String,
			},
			resourceId: {
				type: Schema.Types.ObjectId,
			},
			score: {
				type: Number,
				min: 0,
				max: 100,
			},
			completed: {
				type: Boolean,
				default: false,
			},
			completedAt: {
				type: Date,
			},
			metadata: {
				type: Schema.Types.Mixed,
			},
		},
		lastAttemptAt: {
			type: Date,
		},
	},
	{
		timestamps: true,
		collection: 'progress',
	}
);

// Indexes for performance
progressSchema.index({ userId: 1, type: 1 });
progressSchema.index({ userId: 1, 'pronunciationData.problemId': 1 });
progressSchema.index({ userId: 1, 'pronunciationData.wordId': 1 });
progressSchema.index({ userId: 1, 'drillData.drillId': 1 });
progressSchema.index({ userId: 1, 'pronunciationData.passed': 1 });
progressSchema.index({ userId: 1, 'drillData.completed': 1 });
progressSchema.index({ 'pronunciationData.isChallenging': 1 });

// Unique constraint: one progress record per user-word combination (for pronunciation)
progressSchema.index(
	{ userId: 1, 'pronunciationData.wordId': 1 },
	{ unique: true, sparse: true }
);

// Unique constraint: one progress record per user-drill combination (for drills)
progressSchema.index(
	{ userId: 1, 'drillData.drillId': 1 },
	{ unique: true, sparse: true }
);

// Pre-save middleware to calculate challenge indicators for pronunciation
progressSchema.pre('save', async function () {
	if (this.type === 'pronunciation' && this.pronunciationData) {
		const data = this.pronunciationData;
		
		if (data.accuracyScores && data.accuracyScores.length > 0) {
			// Calculate average score
			data.averageScore = data.accuracyScores.reduce((sum: number, score: number) => sum + score, 0) / data.accuracyScores.length;
			
			// Find best score
			data.bestScore = Math.max(...data.accuracyScores);
			
			// Determine if challenging
			data.isChallenging = data.attempts > 3 || (data.averageScore || 0) < 70;
			
			// Determine challenge level
			if (data.attempts > 5 && (data.averageScore || 0) < 60) {
				data.challengeLevel = 'high';
			} else if (data.attempts > 3 || (data.averageScore || 0) < 70) {
				data.challengeLevel = 'medium';
			} else if (data.weakPhonemes && data.weakPhonemes.length > 0) {
				data.challengeLevel = 'low';
			} else {
				data.challengeLevel = undefined;
			}
		}
	}
	
	// Update lastAttemptAt for all types
	if (this.type === 'pronunciation' && this.pronunciationData) {
		this.lastAttemptAt = new Date();
	} else if (this.type === 'drill' && this.drillData) {
		this.lastAttemptAt = new Date();
	} else if (this.type === 'practice' && this.practiceData) {
		this.lastAttemptAt = new Date();
	}
});

export default models?.Progress || model<IProgress>('Progress', progressSchema);

