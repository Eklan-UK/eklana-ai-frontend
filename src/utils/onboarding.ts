import { Types } from 'mongoose';
import { logger } from '@/lib/api/logger';
import User from '@/models/user';
import Profile from '@/models/profile';
import Tutor from '@/models/tutor';

/**
 * Create a Profile for a user (replaces Learner profile)
 */
export const createUserProfile = async (userId: Types.ObjectId, profileData?: {
	userType?: 'professional' | 'student' | 'browsing' | 'ancestor';
	learningGoal?: string;
	nationality?: string;
	language?: string;
	gradeLevel?: string;
	subjects?: string[];
	learningGoals?: string[];
	learningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'reading-writing';
	educationLevel?: 'elementary' | 'middle-school' | 'high-school' | 'undergraduate' | 'graduate' | 'professional';
	parentContact?: {
		name: string;
		email: string;
		phone: string;
		relationship: string;
	};
	preferences?: {
		sessionDuration?: number;
		preferredTimeSlots?: string[];
		learningPace?: 'slow' | 'moderate' | 'fast';
	};
}): Promise<void> => {
	try {
		// Check if profile already exists
		const existingProfile = await Profile.findOne({ userId }).exec();
		if (existingProfile) {
			logger.warn('Profile already exists', { userId });
			return;
		}

		// Verify user exists
		const user = await User.findById(userId).exec();
		if (!user) {
			throw new Error('User not found');
		}

		// Create profile
		await Profile.create({
			userId,
			userType: profileData?.userType,
			learningGoal: profileData?.learningGoal,
			nationality: profileData?.nationality,
			language: profileData?.language,
			gradeLevel: profileData?.gradeLevel,
			subjects: profileData?.subjects || [],
			learningGoals: profileData?.learningGoals || [],
			learningStyle: profileData?.learningStyle,
			educationLevel: profileData?.educationLevel,
			parentContact: profileData?.parentContact,
			preferences: profileData?.preferences || {
				sessionDuration: 60,
				preferredTimeSlots: [],
				learningPace: 'moderate',
			},
			status: 'active',
		});

		logger.info('Profile created successfully', { userId });
	} catch (error: any) {
		logger.error('Error creating profile', {
			error: error.message,
			userId,
		});
		throw error;
	}
};

/**
 * Create a Tutor profile for a user
 */
export const createTutorProfile = async (
	userId: Types.ObjectId,
	tutorData?: {
		expertise?: string[];
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
		yearsOfExperience?: number;
		languages?: string[];
		teachingStyle?: string;
		availability?: {
			timezone: string;
			schedule: {
				day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
				slots: {
					start: string;
					end: string;
				}[];
			}[];
		};
		bankDetails?: {
			accountName: string;
			accountNumber: string;
			bankName: string;
			routingNumber?: string;
		};
	},
	approvedBy?: Types.ObjectId
): Promise<void> => {
	try {
		// Check if tutor profile already exists
		const existingTutor = await Tutor.findOne({ userId }).exec();
		if (existingTutor) {
			logger.warn('Tutor profile already exists', { userId });
			return;
		}

		// Verify user exists and has tutor role
		const user = await User.findById(userId).exec();
		if (!user) {
			throw new Error('User not found');
		}

		if (user.role !== 'tutor') {
			throw new Error(`User role is ${user.role}, expected tutor`);
		}

		// Create tutor profile
		await Tutor.create({
			userId,
			expertise: tutorData?.expertise || [],
			qualifications: tutorData?.qualifications || [],
			certifications: tutorData?.certifications || [],
			bio: tutorData?.bio,
			hourlyRate: tutorData?.hourlyRate,
			rating: 0,
			totalRatings: 0,
			totalSessions: 0,
			completedSessions: 0,
			yearsOfExperience: tutorData?.yearsOfExperience,
			languages: tutorData?.languages || ['English'],
			teachingStyle: tutorData?.teachingStyle,
			availability: tutorData?.availability || {
				timezone: 'UTC',
				schedule: [],
			},
			bankDetails: tutorData?.bankDetails,
			status: approvedBy ? 'active' : 'pending',
			approvedBy: approvedBy,
			approvedAt: approvedBy ? new Date() : undefined,
		});

		logger.info('Tutor profile created successfully', { userId, approvedBy });
	} catch (error: any) {
		logger.error('Error creating tutor profile', {
			error: error.message,
			userId,
		});
		throw error;
	}
};

// Legacy function names for backward compatibility during migration
export const createLearnerProfile = createUserProfile;

/**
 * Update user role and create corresponding profile
 * @deprecated Use createUserProfile or createTutorProfile directly
 */
export const updateUserRole = async (
	userId: Types.ObjectId,
	newRole: 'user' | 'tutor' | 'admin',
	profileData?: any,
	approvedBy?: Types.ObjectId
): Promise<void> => {
	try {
		const user = await User.findById(userId).exec();
		if (!user) {
			throw new Error('User not found');
		}

		// Update user role
		user.role = newRole;
		await user.save();

		// Create corresponding profile
		if (newRole === 'user') {
			// Remove tutor profile if exists
			await Tutor.deleteOne({ userId }).exec();
			// Create user profile
			await createUserProfile(userId, profileData);
		} else if (newRole === 'tutor') {
			// Remove user profile if exists
			await Profile.deleteOne({ userId }).exec();
			// Create tutor profile
			await createTutorProfile(userId, profileData, approvedBy);
		} else if (newRole === 'admin') {
			// Remove both user and tutor profiles
			await Profile.deleteOne({ userId }).exec();
			await Tutor.deleteOne({ userId }).exec();
		}

		logger.info('User role updated and profile created', {
			userId,
			newRole,
			approvedBy,
		});
	} catch (error: any) {
		logger.error('Error updating user role', {
			error: error.message,
			userId,
			newRole,
		});
		throw error;
	}
};
