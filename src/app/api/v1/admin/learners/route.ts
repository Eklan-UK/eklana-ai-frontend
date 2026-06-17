// GET /api/v1/admin/learners - Get all learners (admin only)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

function startOfDay(dateString: string): Date {
	const date = new Date(dateString);
	date.setHours(0, 0, 0, 0);
	return date;
}

function endOfDay(dateString: string): Date {
	const date = new Date(dateString);
	date.setHours(23, 59, 59, 999);
	return date;
}

function buildLearnerQuery(searchParams: URLSearchParams): Record<string, unknown> {
	const query: Record<string, unknown> = { role: 'user' };

	const search = searchParams.get('search')?.trim();
	const signupDateFrom = searchParams.get('signupDateFrom');
	const signupDateTo = searchParams.get('signupDateTo');
	const status = searchParams.get('status');

	if (search) {
		query.$or = [
			{ firstName: { $regex: search, $options: 'i' } },
			{ lastName: { $regex: search, $options: 'i' } },
			{ name: { $regex: search, $options: 'i' } },
			{ email: { $regex: search, $options: 'i' } },
		];
	}

	if (signupDateFrom || signupDateTo) {
		const createdAt: Record<string, Date> = {};
		if (signupDateFrom) createdAt.$gte = startOfDay(signupDateFrom);
		if (signupDateTo) createdAt.$lte = endOfDay(signupDateTo);
		query.createdAt = createdAt;
	}

	if (status === 'active') {
		query.isActive = { $ne: false };
	} else if (status === 'inactive') {
		query.isActive = false;
	}

	return query;
}

async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { searchParams } = new URL(req.url);
		const limit = parseInt(searchParams.get('limit') || '100');
		const offset = parseInt(searchParams.get('offset') || '0');
		const query = buildLearnerQuery(searchParams);

		const total = await User.countDocuments(query).exec();

		const users = await User.find(query)
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

