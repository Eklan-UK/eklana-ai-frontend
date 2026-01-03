// models/learner.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';

export interface ILearner extends Document {
	_id: Types.ObjectId;
	userId: Types.ObjectId; // Link to User
	tutorId?: Types.ObjectId; // Currently assigned tutor
	gradeLevel?: string;
	subjects: string[]; // Subjects interested in
	learningGoals?: string[];
	learningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'reading-writing';
	educationLevel?:
		| 'elementary'
		| 'middle-school'
		| 'high-school'
		| 'undergraduate'
		| 'graduate'
		| 'professional';
	parentContact?: {
		name: string;
		email: string;
		phone: string;
		relationship: string;
	};
	preferences?: {
		sessionDuration: number; // in minutes
		preferredTimeSlots: string[];
		learningPace: 'slow' | 'moderate' | 'fast';
	};
	enrollmentDate: Date;
	totalSessionsAttended: number;
	status: 'active' | 'inactive' | 'on-hold' | 'graduated';
	notes?: string; // Admin/Tutor notes about the learner
	createdAt: Date;
	updatedAt: Date;
}

const learnerSchema = new Schema<ILearner>(
	{
		userId: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			unique: true, // One learner profile per user
		},
		tutorId: {
			type: Schema.Types.ObjectId,
			ref: 'User', // References the User, not Tutor model
			default: null,
		},
		gradeLevel: {
			type: String,
			maxlength: 50,
		},
		subjects: {
			type: [String],
			default: [],
		},
		learningGoals: {
			type: [String],
			default: [],
		},
		learningStyle: {
			type: String,
			enum: ['visual', 'auditory', 'kinesthetic', 'reading-writing'],
		},
		educationLevel: {
			type: String,
			enum: [
				'elementary',
				'middle-school',
				'high-school',
				'undergraduate',
				'graduate',
				'professional',
			],
		},
		parentContact: {
			name: String,
			email: String,
			phone: String,
			relationship: String,
		},
		preferences: {
			sessionDuration: {
				type: Number,
				default: 60,
			},
			preferredTimeSlots: [String],
			learningPace: {
				type: String,
				enum: ['slow', 'moderate', 'fast'],
				default: 'moderate',
			},
		},
		enrollmentDate: {
			type: Date,
			default: Date.now,
		},
		totalSessionsAttended: {
			type: Number,
			default: 0,
		},
		status: {
			type: String,
			enum: ['active', 'inactive', 'on-hold', 'graduated'],
			default: 'active',
		},
		notes: {
			type: String,
			maxlength: 1000,
		},
	},
	{
		timestamps: true,
	}
);

// Indexes
// Note: userId already has an index from unique: true
learnerSchema.index({ tutorId: 1 });
learnerSchema.index({ status: 1 });
learnerSchema.index({ subjects: 1 });

// Prevent model recompilation in Next.js development
const LearnerModel = models.Learner || model<ILearner>('Learner', learnerSchema);
export default LearnerModel;
