// GET /api/v1/tutor/drills
// Get all drills created by the authenticated tutor
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import Drill from '@/models/drill';
import User from '@/models/user';
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
		const type = searchParams.get('type');
		const difficulty = searchParams.get('difficulty');
		const studentEmail = searchParams.get('studentEmail');
		const isActive = searchParams.get('isActive');

		// Get tutor's email
		const tutor = await User.findById(context.userId).select('email').lean().exec();
		if (!tutor) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Tutor not found',
				},
				{ status: 404 }
			);
		}

		// Build query - only drills created by this tutor
		const query: any = { created_by: tutor.email };
		if (type) query.type = type;
		if (difficulty) query.difficulty = difficulty;
		if (isActive !== null) query.is_active = isActive === 'true';
		if (studentEmail) query.assigned_to = studentEmail;

		const total = await Drill.countDocuments(query).exec();
		const drills = await Drill.find(query)
			.limit(limit)
			.skip(offset)
			.sort({ created_date: -1 })
			.lean()
			.exec();

		return NextResponse.json(
			{
				limit,
				offset,
				total,
				drills,
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching tutor drills', error);
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

