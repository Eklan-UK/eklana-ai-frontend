// models/learning-session.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

export interface ILearningSession extends Document {
	_id: Types.ObjectId;
	learnerId: Types.ObjectId;
	tutorId?: Types.ObjectId; // If tutor-supervised
	sessionType: 'self-practice' | 'tutor-guided' | 'drill-completion';

	startedAt: Date;
	endedAt?: Date;
	duration: number; // seconds

	// Activity Summary
	drillsCompleted: number;
	wordsPracticed: number;
	averageScore: number;

	// Focus Areas
	focusAreas: string[]; // ['pronunciation', 'vocabulary', 'grammar']

	// Device/Platform
	deviceType?: 'mobile' | 'desktop' | 'tablet';
	platform?: 'web' | 'ios' | 'android';

	createdAt: Date;
	updatedAt: Date;
}

const learningSessionSchema = new Schema<ILearningSession>(
	{
		learnerId: {
			type: Schema.Types.ObjectId,
			ref: 'Learner',
			required: [true, 'Learner ID is required'],
			index: true,
		},
		tutorId: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			default: null,
			index: true,
		},
		sessionType: {
			type: String,
			enum: ['self-practice', 'tutor-guided', 'drill-completion'],
			required: true,
		},
		startedAt: {
			type: Date,
			default: Date.now,
			required: true,
		},
		endedAt: {
			type: Date,
			default: null,
		},
		duration: {
			type: Number,
			default: 0,
			min: 0,
		},
		drillsCompleted: {
			type: Number,
			default: 0,
			min: 0,
		},
		wordsPracticed: {
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
		focusAreas: {
			type: [String],
			default: [],
		},
		deviceType: {
			type: String,
			enum: ['mobile', 'desktop', 'tablet'],
		},
		platform: {
			type: String,
			enum: ['web', 'ios', 'android'],
		},
	},
	{
		timestamps: true,
		collection: 'learning_sessions',
	}
);

// Indexes for performance
// Learner's session history
learningSessionSchema.index({ learnerId: 1, startedAt: -1 });

// Tutor's session history
learningSessionSchema.index({ tutorId: 1, startedAt: -1 });

// Session type analytics
learningSessionSchema.index({ sessionType: 1, startedAt: -1 });

// Pre-save middleware to calculate duration
learningSessionSchema.pre('save', function () {
	if (this.endedAt && this.startedAt && !this.duration) {
		this.duration = Math.floor(
			(this.endedAt.getTime() - this.startedAt.getTime()) / 1000
		);
	}
});

// Prevent model recompilation in Next.js development
const LearningSessionModel = models.LearningSession || model<ILearningSession>('LearningSession', learningSessionSchema);
export default LearningSessionModel;

