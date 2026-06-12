// GET /api/v1/admin/analytics/learners - Paginated learners with analytics summaries (admin only)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { getAnalyticsLearners } from '@/domain/admin/platform-analytics.service';
import { Types } from 'mongoose';

async function handler(
	req: NextRequest,
	_context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { searchParams } = new URL(req.url);
		const data = await getAnalyticsLearners(searchParams);

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Analytics learners retrieved successfully',
				data,
			},
			{ status: 200 }
		);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		logger.error('Error fetching analytics learners', {
			error: message,
			stack: error instanceof Error ? error.stack : undefined,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message: 'Internal Server Error',
				error: message,
			},
			{ status: 500 }
		);
	}
}

export const GET = withRole(['admin'], handler);
