import { Types } from 'mongoose';
import { logger } from '@/lib/api/logger';
import User from '@/models/user';
import Learner from '@/models/leaner';
import Tutor from '@/models/tutor';

/**
 * Create a Learner profile for a user
 */
export const createLearnerProfile = async (userId: Types.ObjectId, learnerData?: {
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
		// Check if learner profile already exists
		const existingLearner = await Learner.findOne({ userId }).exec();
		if (existingLearner) {
			logger.warn('Learner profile already exists', { userId });
			return;
		}

		// Verify user exists and has learner role
		const user = await User.findById(userId).exec();
		if (!user) {
			throw new Error('User not found');
		}

		if (user.role !== 'learner') {
			throw new Error(`User role is ${user.role}, expected learner`);
		}

		// Create learner profile
		await Learner.create({
			userId,
			gradeLevel: learnerData?.gradeLevel,
			subjects: learnerData?.subjects || [],
			learningGoals: learnerData?.learningGoals || [],
			learningStyle: learnerData?.learningStyle,
			educationLevel: learnerData?.educationLevel,
			parentContact: learnerData?.parentContact,
			preferences: learnerData?.preferences || {
				sessionDuration: 60,
				preferredTimeSlots: [],
				learningPace: 'moderate',
			},
			enrollmentDate: new Date(),
			totalSessionsAttended: 0,
			status: 'active',
		});

		logger.info('Learner profile created successfully', { userId });
	} catch (error: any) {
		logger.error('Error creating learner profile', {
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
			status: approvedBy ? 'active' : 'pending', // Auto-approve if approvedBy is provided
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

/**
 * Update user role and create corresponding profile
 */
export const updateUserRole = async (
	userId: Types.ObjectId,
	newRole: 'learner' | 'tutor' | 'admin',
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
		if (newRole === 'learner') {
			// Remove tutor profile if exists
			await Tutor.deleteOne({ userId }).exec();
			// Create learner profile
			await createLearnerProfile(userId, profileData);
		} else if (newRole === 'tutor') {
			// Remove learner profile if exists
			await Learner.deleteOne({ userId }).exec();
			// Create tutor profile
			await createTutorProfile(userId, profileData, approvedBy);
		} else if (newRole === 'admin') {
			// Remove both learner and tutor profiles
			await Learner.deleteOne({ userId }).exec();
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

