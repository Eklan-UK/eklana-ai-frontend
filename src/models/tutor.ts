// models/tutor.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

export interface ITutor extends Document {
	_id: Types.ObjectId;
	userId: Types.ObjectId; // Link to User
	expertise?: string[]; // Subjects they can teach
	qualifications?: {
		degree: string;
		institution: string;
		year: number;
	}[];
	certifications?: {
		name: string;
		issuedBy: string;
		issuedDate: Date;
		expiryDate?: Date;
		credentialId?: string;
	}[];
	bio?: string;
	hourlyRate?: number;
	rating: number; // Average rating (0-5)
	totalRatings: number;
	totalSessions: number;
	completedSessions: number;
	yearsOfExperience?: number;
	languages: string[];
	teachingStyle?: string;
	availability: {
		timezone: string;
		schedule: {
			day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
			slots: {
				start: string; // e.g., "09:00"
				end: string; // e.g., "17:00"
			}[];
		}[];
	};
	bankDetails?: {
		accountName: string;
		accountNumber: string;
		bankName: string;
		routingNumber?: string;
	};
	status: 'pending' | 'active' | 'inactive' | 'suspended';
	approvedBy?: Types.ObjectId; // Admin who approved
	approvedAt?: Date;
	notes?: string; // Admin notes
	createdAt: Date;
	updatedAt: Date;
}

const tutorSchema = new Schema<ITutor>(
	{
		userId: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			unique: true,
		},
		expertise: {
			type: [String],
			default: [],
		},
		qualifications: [
			{
				degree: {
					type: String,
					required: true,
				},
				institution: {
					type: String,
					required: true,
				},
				year: {
					type: Number,
					required: true,
				},
			},
		],
		certifications: [
			{
				name: String,
				issuedBy: String,
				issuedDate: Date,
				expiryDate: Date,
				credentialId: String,
			},
		],
		bio: {
			type: String,
			maxlength: [1000, 'Bio cannot exceed 1000 characters'],
		},
		hourlyRate: {
			type: Number,
			min: [0, 'Hourly rate cannot be negative'],
		},
		rating: {
			type: Number,
			default: 0,
			min: 0,
			max: 5,
		},
		totalRatings: {
			type: Number,
			default: 0,
		},
		totalSessions: {
			type: Number,
			default: 0,
		},
		completedSessions: {
			type: Number,
			default: 0,
		},
		yearsOfExperience: {
			type: Number,
			min: 0,
		},
		languages: {
			type: [String],
			default: ['English'],
		},
		teachingStyle: {
			type: String,
			maxlength: 500,
		},
		availability: {
			timezone: {
				type: String,
				default: 'UTC',
			},
			schedule: [
				{
					day: {
						type: String,
						enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
					},
					slots: [
						{
							start: String,
							end: String,
						},
					],
				},
			],
		},
		bankDetails: {
			accountName: String,
			accountNumber: {
				type: String,
				select: false, // Don't return by default for security
			},
			bankName: String,
			routingNumber: {
				type: String,
				select: false,
			},
		},
		status: {
			type: String,
			enum: ['pending', 'active', 'inactive', 'suspended'],
			default: 'pending', // Tutors need admin approval
		},
		approvedBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
		},
		approvedAt: {
			type: Date,
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
tutorSchema.index({ status: 1 });
tutorSchema.index({ expertise: 1 });
tutorSchema.index({ hourlyRate: 1 });
tutorSchema.index({ rating: -1 }); // For sorting by rating

// Prevent model recompilation in Next.js development
const TutorModel = models.Tutor || model<ITutor>('Tutor', tutorSchema);
export default TutorModel;
