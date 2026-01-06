// POST /api/v1/pronunciations/[pronunciationId]/assign
// Assign pronunciation to learners
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import Pronunciation from '@/models/pronunciation';
import PronunciationAssignment from '@/models/pronunciation-assignment';
import User from '@/models/user';
import Profile from '@/models/profile';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';

const assignSchema = z.object({
	learnerIds: z.array(z.string().refine((id) => Types.ObjectId.isValid(id), {
		message: 'Each user ID must be a valid MongoDB ObjectId',
	})).min(1),
	dueDate: z.string().datetime().optional(),
});

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { pronunciationId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { pronunciationId } = params;
		const body = await req.json();
		const validated = assignSchema.parse(body);

		// Check if pronunciation exists
		const pronunciation = await Pronunciation.findById(pronunciationId).exec();
		if (!pronunciation) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Pronunciation not found',
				},
				{ status: 404 }
			);
		}

		// Verify all users exist (learnerIds are now userIds)
		const users = await User.find({
			_id: { $in: validated.learnerIds.map((id) => new Types.ObjectId(id)) },
			role: 'user', // Only assign to users
		})
			.select('email firstName lastName')
			.lean()
			.exec();

		if (users.length !== validated.learnerIds.length) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'One or more user IDs are invalid',
				},
				{ status: 400 }
			);
		}

		// Create assignments (skip duplicates)
		const assignments = [];
		const skipped = [];

		for (const user of users) {
			try {
				// Check if assignment already exists (learnerId now references User)
				const existing = await PronunciationAssignment.findOne({
					pronunciationId,
					learnerId: user._id,
				});

				if (existing) {
					skipped.push(user._id.toString());
					continue;
				}

				// Create new assignment (learnerId now references User)
				const assignment = await PronunciationAssignment.create({
					pronunciationId,
					learnerId: user._id,
					assignedBy: context.userId,
					dueDate: validated.dueDate ? new Date(validated.dueDate) : undefined,
					status: 'pending',
				});

				await assignment.populate([
					{ path: 'learnerId', select: 'email firstName lastName' },
					{ path: 'assignedBy', select: 'email firstName lastName' },
				]);

				assignments.push(assignment);
			} catch (error: any) {
				if (error.code === 11000) {
					// Duplicate key error
					skipped.push(user._id.toString());
					continue;
				}
				logger.error('Error creating assignment', {
					error: error.message,
					pronunciationId,
					userId: user._id,
				});
			}
		}

		logger.info('Pronunciation assignments created', {
			pronunciationId,
			assignedCount: assignments.length,
			skippedCount: skipped.length,
			assignedBy: context.userId,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Pronunciation assigned successfully',
				data: {
					assigned: assignments.length,
					skipped: skipped.length,
					assignments: assignments.map((a) => ({
						_id: a._id,
						learnerId: a.learnerId,
						assignedBy: a.assignedBy,
						status: a.status,
						dueDate: a.dueDate,
					})),
				},
			},
			{ status: 201 }
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

		logger.error('Error assigning pronunciation', {
			error: error.message,
			stack: error.stack,
			pronunciationId: params.pronunciationId,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to assign pronunciation',
			},
			{ status: 500 }
		);
	}
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ pronunciationId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['admin'], (req, context) =>
		handler(req, context, resolvedParams)
	)(req);
}

