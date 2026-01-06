// POST /api/v1/admin/assign-role
// Assign a role to a user and create corresponding profile
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import { updateUserRole } from '@/utils/onboarding';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';

const assignRoleSchema = z.object({
	userId: z.string().refine((id) => Types.ObjectId.isValid(id), {
		message: 'Invalid user ID format',
	}),
	role: z.enum(['user', 'tutor', 'admin']),
	profileData: z.any().optional(),
});

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const body = await req.json();
		const validated = assignRoleSchema.parse(body);

		// Update role and create profile
		await updateUserRole(
			new Types.ObjectId(validated.userId),
			validated.role,
			validated.profileData,
			validated.role === 'tutor' ? context.userId : undefined // Auto-approve tutors when assigned by admin
		);

		logger.info('Role assigned successfully', {
			userId: validated.userId,
			role: validated.role,
			assignedBy: context.userId,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: `Role "${validated.role}" assigned successfully`,
				data: {
					userId: validated.userId,
					role: validated.role,
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Validation failed',
					errors: error.issues,
				},
				{ status: 400 }
			);
		}

		logger.error('Error assigning role', {
			error: error.message,
			stack: error.stack,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to assign role',
			},
			{ status: 500 }
		);
	}
}

export const POST = withRole(['admin'], handler);

