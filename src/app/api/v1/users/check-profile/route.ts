// GET /api/v1/users/check-profile
// Check if the authenticated user has completed onboarding (has Profile)
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import Profile from '@/models/profile';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		// Check if user exists
		const user = await User.findById(context.userId).select('role').lean().exec();
		if (!user) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'User not found',
					hasProfile: false,
				},
				{ status: 404 }
			);
		}

		// Normalize role (handle legacy "learner" role)
		const userRole = user.role === 'learner' ? 'user' : user.role;

		// Check if Profile exists (onboarding completed)
		// Admins and tutors don't need profiles, so they're considered as having completed onboarding
		if (userRole === 'admin' || userRole === 'tutor') {
			return NextResponse.json(
				{
					code: 'Success',
					message: 'User is admin or tutor, no profile required',
					hasProfile: true,
					role: user.role,
				},
				{ status: 200 }
			);
		}

		// For users, check if Profile exists
		const profile = await Profile.findOne({ userId: context.userId }).lean().exec();
		const hasProfile = !!profile;

		logger.info('Profile check completed', {
			userId: context.userId,
			hasProfile,
			role: userRole,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: hasProfile ? 'User has completed onboarding' : 'User has not completed onboarding',
				hasProfile,
				role: userRole,
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error checking user profile', {
			error: error.message,
			stack: error.stack,
			userId: context.userId,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to check user profile',
				hasProfile: false,
			},
			{ status: 500 }
		);
	}
}

export const GET = withAuth(handler);

