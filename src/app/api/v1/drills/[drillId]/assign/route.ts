// POST /api/v1/drills/[drillId]/assign
// Assign drill to users with email notification
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import Drill from '@/models/drill';
import DrillAssignment from '@/models/drill-assignment';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';
import { sendDrillAssignmentNotification } from '@/lib/api/email.service';

const assignSchema = z.object({
	userIds: z.array(z.string().refine((id) => Types.ObjectId.isValid(id), {
		message: 'Each user ID must be a valid MongoDB ObjectId',
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
		
		// Parse request body with proper error handling
		let body;
		try {
			body = await req.json();
		} catch (parseError: any) {
			logger.error('Error parsing request body', {
				error: parseError.message,
				drillId,
				contentType: req.headers.get('content-type'),
			});
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Invalid or empty request body. Please ensure the request includes valid JSON data.',
					error: parseError.message,
				},
				{ status: 400 }
			);
		}

		// Validate body exists
		if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Request body is required and must contain userIds array',
				},
				{ status: 400 }
			);
		}

		const validated = assignSchema.parse(body);

		// Verify drill exists
		const drill = await Drill.findById(drillId).lean().exec();
		if (!drill) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Drill not found',
				},
				{ status: 404 }
			);
		}

		// Verify assigner - include 'name' field for Better Auth users who may not have firstName/lastName
		const assigner = await User.findById(context.userId).select('role email firstName lastName name').lean().exec();
		if (!assigner) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'User not found',
				},
				{ status: 404 }
			);
		}

		// Verify all users exist and have role 'user'
		const users = await User.find({
			_id: { $in: validated.userIds.map((id) => new Types.ObjectId(id)) },
			role: 'user',
		})
			.select('email firstName lastName')
			.lean()
			.exec();

		if (users.length !== validated.userIds.length) {
			const foundUserIds = users.map((u) => u._id.toString());
			const missingIds = validated.userIds.filter((id) => !foundUserIds.includes(id));

			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'One or more user IDs are invalid or do not have the user role',
					invalidUserIds: missingIds,
				},
				{ status: 400 }
			);
		}

		// Calculate due date if not provided
		// Note: drill.date is now the completion/due date, not start date
		let dueDate: Date | undefined;
		if (validated.dueDate) {
			dueDate = new Date(validated.dueDate);
		} else {
			// Use drill.date as completion date, or calculate from assignment date + duration
			// If drill.date is set, use it; otherwise calculate from today + duration_days
			if (drill.date) {
				dueDate = new Date(drill.date);
			} else {
				dueDate = new Date();
				dueDate.setDate(dueDate.getDate() + (drill.duration_days || 1));
			}
		}

		// Check for existing assignments in bulk (avoid N+1 queries)
		const userIds = users.map((u) => u._id);
		const existingAssignments = await DrillAssignment.find({
			drillId: new Types.ObjectId(drillId),
			learnerId: { $in: userIds },
		})
			.select('learnerId')
			.lean()
			.exec();

		const existingUserIds = new Set(
			existingAssignments.map((a) => a.learnerId.toString())
		);

		// Prepare new assignments for users that don't have one yet
		const newAssignments = users
			.filter((user) => !existingUserIds.has(user._id.toString()))
			.map((user) => ({
				drillId: new Types.ObjectId(drillId),
				learnerId: user._id,
				assignedBy: context.userId,
				assignedAt: new Date(),
				dueDate: dueDate!,
				status: 'pending' as const,
			}));

		// Bulk insert assignments (much faster than individual creates)
		let successfulAssignments: any[] = [];
		if (newAssignments.length > 0) {
			try {
				successfulAssignments = await DrillAssignment.insertMany(newAssignments, {
					ordered: false, // Continue even if some fail
				});
			} catch (error: any) {
				// Handle partial failures (e.g., duplicates)
				if (error.writeErrors) {
					successfulAssignments = error.insertedDocs || [];
					logger.warn('Some drill assignments failed', {
						successful: successfulAssignments.length,
						failed: error.writeErrors.length,
					});
				} else {
					throw error;
				}
			}

			// Send email notifications asynchronously (don't block response)
			// Use successfulAssignments to get the assignment IDs for deep linking
			Promise.all(
				successfulAssignments.map(async (assignment: any) => {
					const user = users.find((u) => u._id.toString() === assignment.learnerId.toString());
					if (user?.email) {
						try {
							// Get best available name for the assigner (tutor or admin)
							// Check firstName/lastName first, then fall back to name field (Better Auth), then email
							let assignerName = 'Your instructor';
							if (assigner.firstName) {
								assignerName = `${assigner.firstName}${assigner.lastName ? ' ' + assigner.lastName : ''}`.trim();
							} else if ((assigner as any).name) {
								assignerName = (assigner as any).name;
							} else if (assigner.email) {
								assignerName = assigner.email.split('@')[0];
							}
							
							await sendDrillAssignmentNotification({
								studentEmail: user.email,
								studentName: user.firstName || 'Student',
								drillTitle: drill.title,
								drillType: drill.type,
								dueDate: dueDate!,
								assignerName: assignerName,
								drillId: drillId,
								assignmentId: assignment._id?.toString(),
							});
						} catch (emailError: any) {
							logger.error('Failed to send drill assignment email', {
								error: emailError.message,
								studentEmail: user.email,
							});
						}
					}
				})
			).catch((err) => {
				logger.error('Error sending email notifications', { error: err.message });
			});
		}

		// Update drill's totalAssignments count
		if (successfulAssignments.length > 0) {
			await Drill.findByIdAndUpdate(drillId, {
				$inc: { totalAssignments: successfulAssignments.length },
			}).exec();
		}

		logger.info('Drill assigned to users', {
			drillId: drill._id,
			assignedBy: assigner.email,
			userCount: successfulAssignments.length,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: `Drill assigned to ${successfulAssignments.length} user(s)`,
				data: {
					assignments: successfulAssignments.map((a) => ({
						id: a._id,
						userId: a.learnerId, // learnerId field contains userId
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

