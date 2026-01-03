// POST /api/v1/drills/[drillId]/assign
// Assign drill to learners with email notification
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import Drill from '@/models/drill';
import DrillAssignment from '@/models/drill-assignment';
import Learner from '@/models/leaner';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';
import { sendDrillAssignmentNotification } from '@/lib/api/email.service';

const assignSchema = z.object({
	learnerIds: z.array(z.string().refine((id) => Types.ObjectId.isValid(id), {
		message: 'Each learner ID must be a valid MongoDB ObjectId',
	})).min(1),
	dueDate: z.string().datetime().optional(),
});

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { drillId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { drillId } = params;
		const body = await req.json();
		const validated = assignSchema.parse(body);

		// Verify drill exists
		const drill = await Drill.findById(drillId).exec();
		if (!drill) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Drill not found',
				},
				{ status: 404 }
			);
		}

		// Verify assigner
		const assigner = await User.findById(context.userId).select('role email firstName lastName').lean().exec();
		if (!assigner) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'User not found',
				},
				{ status: 404 }
			);
		}

		// Verify all learners exist and get their learner profiles
		const learners = await Learner.find({
			userId: { $in: validated.learnerIds.map((id) => new Types.ObjectId(id)) },
		})
			.populate('userId', 'email firstName lastName')
			.exec();

		if (learners.length !== validated.learnerIds.length) {
			const foundLearnerIds = learners.map((l) => l.userId.toString());
			const missingIds = validated.learnerIds.filter((id) => !foundLearnerIds.includes(id));

			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'One or more learner IDs are invalid',
					invalidLearnerIds: missingIds,
				},
				{ status: 400 }
			);
		}

		// Create drill assignments
		const assignments = await Promise.all(
			learners.map(async (learner) => {
				try {
					const assignment = await DrillAssignment.create({
						drillId: drill._id,
						learnerId: learner._id,
						assignedBy: context.userId,
						assignedAt: new Date(),
						dueDate: validated.dueDate ? new Date(validated.dueDate) : undefined,
						status: 'pending',
					});

					// Send email notification
					const learnerUser = learner.userId as any;
					if (learnerUser && learnerUser.email) {
						await sendDrillAssignmentNotification({
							studentEmail: learnerUser.email,
							studentName: learnerUser.firstName || learnerUser.name || 'Student',
							drillTitle: drill.title,
							drillType: drill.type,
							dueDate: validated.dueDate ? new Date(validated.dueDate) : undefined,
							assignerName: assigner.firstName || assigner.name || assigner.email,
						}).catch((emailError) => {
							// Log but don't fail the assignment if email fails
							logger.error('Failed to send drill assignment email', {
								error: emailError.message,
								studentEmail: learnerUser.email,
							});
						});
					}

					return assignment;
				} catch (error: any) {
					// Handle duplicate assignment error
					if (error.code === 11000) {
						logger.warn('Drill already assigned to learner', {
							learnerId: learner._id,
							drillId: drill._id,
						});
						return null; // Skip duplicate
					}
					throw error;
				}
			})
		);

		// Filter out nulls (duplicates)
		const successfulAssignments = assignments.filter((a) => a !== null) as any[];

		// Update drill's totalAssignments count
		drill.totalAssignments = (drill.totalAssignments || 0) + successfulAssignments.length;
		await drill.save();

		logger.info('Drill assigned to learners', {
			drillId: drill._id,
			assignedBy: assigner.email,
			learnerCount: successfulAssignments.length,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: `Drill assigned to ${successfulAssignments.length} learner(s)`,
				data: {
					assignments: successfulAssignments.map((a) => ({
						id: a._id,
						learnerId: a.learnerId,
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

		logger.error('Error assigning drill', {
			error: error.message,
			stack: error.stack,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message: 'Internal Server Error',
				error: error.message,
			},
			{ status: 500 }
		);
	}
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ drillId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['tutor', 'admin'], (req, context) =>
		handler(req, context, resolvedParams)
	)(req);
}

