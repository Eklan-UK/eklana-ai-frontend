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

		// Check existing assignments in bulk (single query instead of N queries)
		const userIds = users.map((u) => u._id);
		const existingAssignments = await PronunciationAssignment.find({
			pronunciationId,
			learnerId: { $in: userIds },
		})
			.select('learnerId')
			.lean()
			.exec();

		const existingUserIds = new Set(
			existingAssignments.map((a) => a.learnerId.toString())
		);

		// Filter out users who already have assignments
		const usersToAssign = users.filter(
			(u) => !existingUserIds.has(u._id.toString())
		);

		// Create assignments in bulk (single insertMany instead of N creates)
		const assignmentsToCreate = usersToAssign.map((user) => ({
			pronunciationId,
			learnerId: user._id,
			assignedBy: context.userId,
			dueDate: validated.dueDate ? new Date(validated.dueDate) : undefined,
			status: 'pending',
		}));

		const createdAssignments = await PronunciationAssignment.insertMany(
			assignmentsToCreate,
			{ ordered: false } // Continue on duplicate errors
		);

		// Populate assignments
		const assignments = await PronunciationAssignment.find({
			_id: { $in: createdAssignments.map((a) => a._id) },
		})
			.populate('learnerId', 'email firstName lastName')
			.populate('assignedBy', 'email firstName lastName')
			.lean()
			.exec();

		const skipped = userIds.length - assignments.length;

		logger.info('Pronunciation assignments created', {
			pronunciationId,
			assignedCount: assignments.length,
			skippedCount: skipped,
			assignedBy: context.userId,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Pronunciation assigned successfully',
				data: {
					assigned: assignments.length,
					skipped,
					assignments: assignments.map((a: any) => ({
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

