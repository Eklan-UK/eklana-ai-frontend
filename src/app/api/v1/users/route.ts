// GET /api/v1/users
// Get all users (admin only)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { getGoogleCalendarConnectionMapForUsers } from '@/lib/api/google-calendar-connection';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { searchParams } = new URL(req.url);
		const limit = parseInt(searchParams.get('limit') || String(config.defaultResLimit));
		const offset = parseInt(searchParams.get('offset') || String(config.defaultResOffset));
		const role = searchParams.get('role');
		const search = searchParams.get('search');

		const query: any = {};

		// Filter by role if provided
		if (role) {
			query.role = role;
		}

		// Search filter
		if (search) {
			query.$or = [
				{ email: { $regex: search, $options: 'i' } },
				{ firstName: { $regex: search, $options: 'i' } },
				{ lastName: { $regex: search, $options: 'i' } },
				{ name: { $regex: search, $options: 'i' } },
			];
		}

		const total = await User.countDocuments(query).exec();
		const users = await User.find(query)
			.select('-password -__v')
			.sort({ createdAt: -1 })
			.limit(limit)
			.skip(offset)
			.lean()
			.exec();

		const tutorIds = users
			.filter((u: any) => u.role === 'tutor')
			.map((u: any) => String(u._id));
		const googleConnectionByTutorId =
			tutorIds.length > 0
				? await getGoogleCalendarConnectionMapForUsers(tutorIds)
				: new Map();
		const usersWithGoogleStatus = users.map((u: any) => {
			if (u.role !== 'tutor') return u;
			const status = googleConnectionByTutorId.get(String(u._id));
			return {
				...u,
				googleCalendarConnected: status?.connected === true,
			};
		});

		logger.info('Users fetched successfully', {
			total,
			limit,
			offset,
			role,
		});

		return NextResponse.json(
			{
				users: usersWithGoogleStatus,
				total,
				limit,
				offset,
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching users', error);
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

export const GET = withRole(['admin'], handler);

