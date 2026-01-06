// GET /api/v1/users/check-profile
// Check if the authenticated user has completed onboarding (hasProfile)
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		// Check if user exists
		const user = await User.findById(context.userId).select('role hasProfile').lean().exec();
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

		// Check hasProfile field (set to true after onboarding completion)
		const hasProfile = user.hasProfile === true;

		logger.info('Profile check completed', {
			userId: context.userId,
			hasProfile,
			role: user.role,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: hasProfile ? 'User has completed onboarding' : 'User has not completed onboarding',
				hasProfile,
				role: user.role,
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

