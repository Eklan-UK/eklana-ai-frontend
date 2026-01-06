// models/profile.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';

export interface IProfile extends Document {
	_id: Types.ObjectId;
	userId: Types.ObjectId; // Link to User (one-to-one)
	tutorId?: Types.ObjectId; // Currently assigned tutor (for users)
	
	// Onboarding data
	userType?: 'professional' | 'student' | 'browsing' | 'ancestor';
	learningGoal?: string;
	nationality?: string;
	language?: string;
	
	// Learning preferences
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
	
	// Contact preferences (for users with parents/guardians)
	parentContact?: {
		name: string;
		email: string;
		phone: string;
		relationship: string;
	};
	
	// Learning preferences
	preferences?: {
		sessionDuration: number; // in minutes
		preferredTimeSlots: string[];
		learningPace: 'slow' | 'moderate' | 'fast';
	};
	
	// Status
	status: 'active' | 'inactive' | 'on-hold' | 'graduated';
	notes?: string; // Admin/Tutor notes about the user
	
	// Metadata
	createdAt: Date;
	updatedAt: Date;
}

const profileSchema = new Schema<IProfile>(
	{
		userId: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			unique: true, // One profile per user
			index: true,
		},
		tutorId: {
			type: Schema.Types.ObjectId,
			ref: 'User', // References the User (tutor role)
			default: null,
			index: true,
		},
		// Onboarding data
		userType: {
			type: String,
			enum: ['professional', 'student', 'browsing', 'ancestor'],
		},
		learningGoal: {
			type: String,
		},
		nationality: {
			type: String,
		},
		language: {
			type: String,
		},
		// Learning preferences
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
		status: {
			type: String,
			enum: ['active', 'inactive', 'on-hold', 'graduated'],
			default: 'active',
			index: true,
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
profileSchema.index({ tutorId: 1 });
profileSchema.index({ status: 1 });
profileSchema.index({ subjects: 1 });

// Prevent model recompilation in Next.js development
const ProfileModel = models.Profile || model<IProfile>('Profile', profileSchema);
export default ProfileModel;

