// GET /api/v1/admin/analytics/dashboard - Aggregated analytics (platform-wide or filtered learners)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { getAnalyticsDashboard } from '@/domain/admin/platform-analytics.service';
import { Types } from 'mongoose';
import { resolveTutorScopedLearnerIds } from '@/lib/api/staff-learner-access';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { searchParams } = new URL(req.url);
		const learnerIdsParam = searchParams.get('learnerIds');
		const daysParam = searchParams.get('days');

		const requestedIds = learnerIdsParam
			? learnerIdsParam
					.split(',')
					.map((id) => id.trim())
					.filter(Boolean)
			: undefined;

		const scoped = await resolveTutorScopedLearnerIds(context, requestedIds);
		if (!scoped.ok) {
			return NextResponse.json(
				{ code: 'NotFoundError', message: 'Not found' },
				{ status: 404 }
			);
		}

		const days = daysParam ? parseInt(daysParam, 10) : 30;

		const dashboard = await getAnalyticsDashboard(
			scoped.learnerIds,
			Number.isNaN(days) ? 30 : days
		);

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Analytics dashboard retrieved successfully',
				data: dashboard,
			},
			{ status: 200 }
		);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		logger.error('Error fetching analytics dashboard', {
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

export const GET = withRole(['admin', 'tutor'], handler);
