// GET /api/v1/admin/learners - Get all learners (admin only)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import Learner from '@/models/leaner';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { searchParams } = new URL(req.url);
		const limit = parseInt(searchParams.get('limit') || '100');
		const offset = parseInt(searchParams.get('offset') || '0');

		// Get total count
		const total = await Learner.countDocuments().exec();

		// Find all learners and populate user details
		const learners = await Learner.find()
			.populate({
				path: 'userId',
				select: 'email firstName lastName role',
			})
			.select('-__v')
			.sort({ createdAt: -1 })
			.limit(limit)
			.skip(offset)
			.lean()
			.exec();

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Learners retrieved successfully',
				data: {
					learners,
					pagination: {
						total,
						limit,
						offset,
						hasMore: offset + learners.length < total,
					},
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching learners', {
			error: error.message,
			stack: error.stack,
		});

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

export const GET = withRole(['admin'], getHandler);

