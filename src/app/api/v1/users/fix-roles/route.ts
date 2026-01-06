// POST /api/v1/users/fix-roles
// Utility endpoint to fix users without roles (one-time migration)
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		// Only allow admins to run this migration
		if (context.userRole !== 'admin') {
			return NextResponse.json(
				{
					code: 'Forbidden',
					message: 'Only admins can run this migration',
				},
				{ status: 403 }
			);
		}

		await connectToDatabase();

		// Find all users without a role or with null/undefined/empty role
		const result = await User.updateMany(
			{
				$or: [
					{ role: { $exists: false } },
					{ role: null },
					{ role: undefined },
					{ role: '' },
				],
			},
			{
				$set: { role: 'user' },
			}
		);

		logger.info(`Fixed ${result.modifiedCount} users without roles`, {
			userId: context.userId,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: `Updated ${result.modifiedCount} users with default role 'user'`,
				data: {
					updatedCount: result.modifiedCount,
					matchedCount: result.matchedCount,
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fixing user roles', {
			error: error.message,
			stack: error.stack,
			userId: context.userId,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to fix user roles',
			},
			{ status: 500 }
		);
	}
}

export const POST = withAuth(handler);

