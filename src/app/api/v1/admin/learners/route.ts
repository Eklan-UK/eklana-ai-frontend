// GET /api/v1/admin/learners - Get all learners (admin only)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
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

		// Get total count of users with role 'user'
		const total = await User.countDocuments({ role: 'user' }).exec();

		// Find all users with role 'user'
		const users = await User.find({ role: 'user' })
			.select('-password -__v')
			.sort({ createdAt: -1 })
			.limit(limit)
			.skip(offset)
			.lean()
			.exec();

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Users retrieved successfully',
				data: {
					learners: users, // Keep 'learners' key for backward compatibility
					pagination: {
						total,
						limit,
						offset,
						hasMore: offset + users.length < total,
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

