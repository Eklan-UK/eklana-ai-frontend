// GET /api/v1/admin/dashboard/stats - Dashboard aggregate counts (admin only)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { getAdminDashboardStats } from '@/domain/admin/dashboard-stats.service';
import { Types } from 'mongoose';

async function handler(
	_req: NextRequest,
	_context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const stats = await getAdminDashboardStats();

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Dashboard stats retrieved successfully',
				data: stats,
			},
			{ status: 200 }
		);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		logger.error('Error fetching dashboard stats', {
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
