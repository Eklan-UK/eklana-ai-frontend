// GET /api/v1/tutor/students
// Get all students assigned to the authenticated tutor
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import Profile from '@/models/profile';
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { searchParams } = new URL(req.url);
		const limit = parseInt(searchParams.get('limit') || String(config.defaultResLimit));
		const offset = parseInt(searchParams.get('offset') || String(config.defaultResOffset));

		// Find all users with profiles assigned to this tutor
		const profiles = await Profile.find({ tutorId: context.userId })
			.select('userId tutorId')
			.lean()
			.exec();

		const userIds = profiles.map((p) => p.userId);

		// Get total count
		const total = userIds.length;

		// Find all users assigned to this tutor
		const users = await User.find({ _id: { $in: userIds } })
			.select('-password -__v')
			.sort({ createdAt: -1 })
			.limit(limit)
			.skip(offset)
			.lean()
			.exec();

		// Map to students format with profile info
		const students = users.map((user) => ({
			...user,
			userId: user,
		}));

		logger.info('Students fetched successfully for tutor', {
			tutorId: context.userId,
			total: students.length,
		});

		return NextResponse.json(
			{
				limit,
				offset,
				total,
				students,
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching students for tutor', error);
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

export const GET = withRole(['tutor'], handler);

