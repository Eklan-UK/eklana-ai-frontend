// PATCH /api/v1/admin/learners/[learnerId] — admin updates a learner's first/last name
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';

const updateLearnerNameSchema = z.object({
	firstName: z.string().min(1).max(50),
	lastName: z.string().min(1).max(50),
});

async function patchHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { learnerId: string },
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { learnerId } = params;

		if (!learnerId || !Types.ObjectId.isValid(learnerId)) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Invalid learner ID' },
				{ status: 400 },
			);
		}

		const user = await User.findById(learnerId);
		if (!user) {
			return NextResponse.json(
				{ code: 'NotFoundError', message: 'Learner not found' },
				{ status: 404 },
			);
		}

		if (user.role !== 'user') {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Target account is not a learner' },
				{ status: 400 },
			);
		}

		const body = await req.json();
		const validated = updateLearnerNameSchema.parse(body);

		user.firstName = validated.firstName.trim();
		user.lastName = validated.lastName.trim();
		user.name = `${user.firstName} ${user.lastName}`.trim();
		await user.save();

		logger.info('Admin updated learner name', {
			adminId: context.userId.toString(),
			learnerId,
		});

		return NextResponse.json(
			{
				code: 'Success',
				data: {
					learner: {
						id: user._id,
						firstName: user.firstName,
						lastName: user.lastName,
						name: user.name,
					},
				},
			},
			{ status: 200 },
		);
	} catch (error: unknown) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Validation failed', errors: error.issues },
				{ status: 400 },
			);
		}
		const message = error instanceof Error ? error.message : 'Internal Server Error';
		logger.error('Error updating learner name', { error: message });
		return NextResponse.json(
			{ code: 'ServerError', message },
			{ status: 500 },
		);
	}
}

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ learnerId: string }> },
) {
	const resolvedParams = await params;
	return withRole(['admin'], (req, context) =>
		patchHandler(req, context, resolvedParams),
	)(req);
}
