// POST /api/v1/users/onboard
// Onboard a user by creating their Profile (for users) or Tutor profile (for tutors)
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import { createUserProfile, createTutorProfile } from '@/utils/onboarding';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';

const onboardSchema = z.object({
	role: z.enum(['user', 'tutor']).optional(),
	// Profile data
	userType: z.enum(['professional', 'student', 'browsing', 'ancestor']).optional(),
	learningGoal: z.string().optional(), // Legacy single goal support
	learningGoals: z.array(z.string()).optional(), // New multiple goals support
	nationality: z.string().optional(),
	language: z.string().optional(),
});

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const body = await req.json();
		const validated = onboardSchema.parse(body);

		const user = await User.findById(context.userId).exec();
		if (!user) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'User not found',
				},
				{ status: 404 }
			);
		}

		// Get role from user or request body
		const role = user.role || validated.role || 'user';

		// Validate role
		if (!['user', 'tutor'].includes(role)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Invalid role. Must be "user" or "tutor"',
				},
				{ status: 400 }
			);
		}

		// Update user role if not set
		if (!user.role) {
			user.role = role;
			await user.save();
		}

		// Create appropriate profile
		if (role === 'user') {
			await createUserProfile(context.userId, {
				userType: validated.userType,
				learningGoal: validated.learningGoal,
				nationality: validated.nationality,
				language: validated.language,
				...body, // Include any other profile fields
			});
			logger.info('User onboarded with profile', { userId: context.userId });
		} else if (role === 'tutor') {
			await createTutorProfile(context.userId, body);
			logger.info('User onboarded as tutor', { userId: context.userId });
		}

		return NextResponse.json(
			{
				code: 'Success',
				message: `User successfully onboarded as ${role}`,
				data: {
					userId: context.userId.toString(),
					role,
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Validation failed',
					errors: error.issues,
				},
				{ status: 400 }
			);
		}
		logger.error('Error onboarding user', {
			error: error.message,
			stack: error.stack,
			userId: context.userId,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to onboard user',
			},
			{ status: 500 }
		);
	}
}

export const POST = withAuth(handler);
