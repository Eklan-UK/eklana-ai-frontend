// GET /api/v1/admin/analytics/key-phrases - Platform-wide key phrase analytics
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { getPlatformKeyPhrasesAnalytics } from '@/domain/admin/platform-analytics.service';

async function handler(req: NextRequest): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { searchParams } = new URL(req.url);
		const daysParam = searchParams.get('days');
		const learnerIdsParam = searchParams.get('learnerIds');
		const days = daysParam ? parseInt(daysParam, 10) : 30;
		const learnerIds = learnerIdsParam
			? learnerIdsParam
					.split(',')
					.map((id) => id.trim())
					.filter(Boolean)
			: undefined;

		const analytics = await getPlatformKeyPhrasesAnalytics(
			Number.isNaN(days) ? 30 : days,
			learnerIds
		);

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Key phrase analytics retrieved successfully',
				data: analytics,
			},
			{ status: 200 }
		);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		logger.error('Error fetching key-phrases analytics', { error: message });
		return NextResponse.json(
			{ code: 'ServerError', message: 'Internal Server Error', error: message },
			{ status: 500 }
		);
	}
}

export const GET = withRole(['admin'], (_req, _context) => handler(_req));
