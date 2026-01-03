// models/challenge-area.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';

export interface IChallengeArea extends Document {
	_id: Types.ObjectId;
	learnerId: Types.ObjectId;

	// Challenge Type
	area: 'pronunciation' | 'vocabulary' | 'grammar' | 'fluency' | 'comprehension';
	subArea?: string; // e.g., 'th-sounds', 'past-tense', 'phrasal-verbs'

	// Severity
	severity: 'low' | 'medium' | 'high' | 'critical';
	difficultyScore: number; // 0-100

	// Evidence
	affectedWords: string[]; // Words causing issues
	affectedDrills: Types.ObjectId[]; // Drills where challenge appeared
	attemptsCount: number;
	averageScore: number;

	// Improvement Tracking
	improvementTrend: 'improving' | 'stable' | 'declining';
	recommendedActions: string[];

	// Timestamps
	firstIdentified: Date;
	lastObserved: Date;
	resolvedAt?: Date;

	createdAt: Date;
	updatedAt: Date;
}

const challengeAreaSchema = new Schema<IChallengeArea>(
	{
		learnerId: {
			type: Schema.Types.ObjectId,
			ref: 'Learner',
			required: [true, 'Learner ID is required'],
			index: true,
		},
		area: {
			type: String,
			enum: ['pronunciation', 'vocabulary', 'grammar', 'fluency', 'comprehension'],
			required: [true, 'Challenge area is required'],
		},
		subArea: {
			type: String,
			maxlength: 100,
		},
		severity: {
			type: String,
			enum: ['low', 'medium', 'high', 'critical'],
			default: 'medium',
			required: true,
		},
		difficultyScore: {
			type: Number,
			default: 50,
			min: 0,
			max: 100,
		},
		affectedWords: {
			type: [String],
			default: [],
		},
		affectedDrills: {
			type: [Schema.Types.ObjectId],
			ref: 'Drill',
			default: [],
		},
		attemptsCount: {
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
		improvementTrend: {
			type: String,
			enum: ['improving', 'stable', 'declining'],
			default: 'stable',
		},
		recommendedActions: {
			type: [String],
			default: [],
		},
		firstIdentified: {
			type: Date,
			default: Date.now,
		},
		lastObserved: {
			type: Date,
			default: Date.now,
		},
		resolvedAt: {
			type: Date,
			default: null,
		},
	},
	{
		timestamps: true,
		collection: 'challenge_areas',
	}
);

// Indexes for performance
// Get active challenges for learner
challengeAreaSchema.index({ learnerId: 1, severity: -1, lastObserved: -1 });

// Get resolved challenges
challengeAreaSchema.index({ learnerId: 1, area: 1, resolvedAt: 1 });

// Get challenges by area
challengeAreaSchema.index({ learnerId: 1, area: 1, severity: -1 });

// Method to mark as resolved
challengeAreaSchema.methods.resolve = function () {
	this.resolvedAt = new Date();
	this.severity = 'low';
	this.improvementTrend = 'improving';
};

// Method to update challenge
challengeAreaSchema.methods.updateChallenge = function (
	score: number,
	drillId: Types.ObjectId,
	word?: string
) {
	this.attemptsCount += 1;
	this.averageScore = (this.averageScore * (this.attemptsCount - 1) + score) / this.attemptsCount;

	if (word && !this.affectedWords.includes(word)) {
		this.affectedWords.push(word);
	}

	if (!this.affectedDrills.includes(drillId)) {
		this.affectedDrills.push(drillId);
	}

	this.lastObserved = new Date();
	this.difficultyScore = 100 - this.averageScore;

	// Update severity based on difficulty
	if (this.difficultyScore >= 80) {
		this.severity = 'critical';
	} else if (this.difficultyScore >= 60) {
		this.severity = 'high';
	} else if (this.difficultyScore >= 40) {
		this.severity = 'medium';
	} else {
		this.severity = 'low';
	}
};

// Prevent model recompilation in Next.js development
const ChallengeAreaModel = models.ChallengeArea || model<IChallengeArea>('ChallengeArea', challengeAreaSchema);
export default ChallengeAreaModel;

