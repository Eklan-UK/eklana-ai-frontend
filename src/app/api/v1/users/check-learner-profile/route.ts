// GET /api/v1/users/check-learner-profile
// Check if the authenticated user has a learner profile
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import Learner from '@/models/leaner';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		// Check if user exists and is a learner
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

		// If user is not a learner, they don't need a learner profile
		if (user.role !== 'learner') {
			return NextResponse.json(
				{
					code: 'Success',
					message: 'User is not a learner',
					hasProfile: true, // Not required for non-learners
					role: user.role,
				},
				{ status: 200 }
			);
		}

		// Check if learner profile exists
		const learnerProfile = await Learner.findOne({ userId: context.userId }).lean().exec();

		logger.info('Learner profile check completed', {
			userId: context.userId,
			hasProfile: !!learnerProfile,
			role: user.role,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: learnerProfile ? 'Learner profile exists' : 'Learner profile not found',
				hasProfile: !!learnerProfile,
				role: user.role,
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error checking learner profile', {
			error: error.message,
			stack: error.stack,
			userId: context.userId,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to check learner profile',
				hasProfile: false,
			},
			{ status: 500 }
		);
	}
}

export const GET = withAuth(handler);

