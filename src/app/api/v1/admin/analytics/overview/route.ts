// GET /api/v1/admin/analytics/overview - Platform-wide drill aggregates (admin only)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { getPlatformDrillOverview } from '@/domain/admin/platform-analytics.service';
import { Types } from 'mongoose';

async function handler(
	_req: NextRequest,
	_context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const overview = await getPlatformDrillOverview();

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Platform analytics overview retrieved successfully',
				data: overview,
			},
			{ status: 200 }
		);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		logger.error('Error fetching platform analytics overview', {
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
