// GET /api/v1/tutor/students
// Get all students assigned to the authenticated tutor
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import Learner from '@/models/leaner';
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

		// Get total count
		const total = await Learner.countDocuments({ tutorId: context.userId }).exec();

		// Find all learners assigned to this tutor
		const students = await Learner.find({ tutorId: context.userId })
			.populate({
				path: 'userId',
				select: '-password -__v',
			})
			.select('-__v')
			.sort({ createdAt: -1 })
			.limit(limit)
			.skip(offset)
			.lean()
			.exec();

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

