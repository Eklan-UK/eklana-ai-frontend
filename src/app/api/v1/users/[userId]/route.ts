// GET /api/v1/users/[userId]
// Get user by ID (admin/tutor only)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import Learner from '@/models/leaner';
import Tutor from '@/models/tutor';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { userId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { userId } = params;

		if (!Types.ObjectId.isValid(userId)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Invalid user ID format',
				},
				{ status: 400 }
			);
		}

		const user = await User.findById(userId).select('-password -__v').lean().exec();

		if (!user) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'User not found',
				},
				{ status: 404 }
			);
		}

		const response: any = { user };

		// Include profile if exists
		if (user.role === 'user') {
			const learnerProfile = await Learner.findOne({ userId: new Types.ObjectId(userId) })
				.select('-__v')
				.lean()
				.exec();
			if (learnerProfile) {
				response.learnerProfile = learnerProfile;
			}
		} else if (user.role === 'tutor') {
			const tutorProfile = await Tutor.findOne({ userId: new Types.ObjectId(userId) })
				.select('-__v')
				.lean()
				.exec();
			if (tutorProfile) {
				response.tutorProfile = tutorProfile;
			}
		}

		return NextResponse.json(response, { status: 200 });
	} catch (error: any) {
		logger.error('Error fetching user', error);
		return NextResponse.json(
			{
				code: 'ServerError',
				message: 'Internal Server Error',
				error: error.message,
			},
			{ status: 500 }
		);
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ userId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['admin', 'tutor'], (req, context) =>
		handler(req, context, resolvedParams)
	)(req);
}

