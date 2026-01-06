// GET, PUT, DELETE /api/v1/drills/[drillId]
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import Drill from '@/models/drill';
import DrillAssignment from '@/models/drill-assignment';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';

// GET handler
async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { drillId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { drillId } = params;

		if (!Types.ObjectId.isValid(drillId)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Invalid drill ID format',
				},
				{ status: 400 }
			);
		}

		const drill = await Drill.findById(drillId).select('-__v').lean().exec();

		if (!drill) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Drill not found',
				},
				{ status: 404 }
			);
		}

		// Check permissions
		const user = await User.findById(context.userId).select('email role').lean().exec();
		if (!user) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'User not found',
				},
				{ status: 404 }
			);
		}

		// Learners can only view drills assigned to them
		if (user.role === 'user' && !drill.assigned_to.includes(user.email)) {
			return NextResponse.json(
				{
					code: 'AuthorizationError',
					message: 'You do not have permission to view this drill',
				},
				{ status: 403 }
			);
		}

		// Tutors can only view drills they created
		if (user.role === 'tutor' && drill.created_by !== user.email) {
			return NextResponse.json(
				{
					code: 'AuthorizationError',
					message: 'You do not have permission to view this drill',
				},
				{ status: 403 }
			);
		}

		return NextResponse.json({ drill }, { status: 200 });
	} catch (error: any) {
		logger.error('Error fetching drill', error);
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

// PUT handler
const updateDrillSchema = z.object({
	title: z.string().min(1).max(200).optional(),
	type: z.enum(['vocabulary', 'roleplay', 'matching', 'definition', 'summary', 'grammar', 'sentence_writing']).optional(),
	difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
	date: z.string().datetime().optional(),
	duration_days: z.number().int().min(1).optional(),
	assigned_to: z.array(z.string().email()).optional(),
	is_active: z.boolean().optional(),
});

async function putHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { drillId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { drillId } = params;

		if (!Types.ObjectId.isValid(drillId)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Invalid drill ID format',
				},
				{ status: 400 }
			);
		}

		const body = await req.json();
		const validated = updateDrillSchema.parse(body);

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

		// Check permissions - only creator or admin can update
		const user = await User.findById(context.userId).select('email role').lean().exec();
		if (!user) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'User not found',
				},
				{ status: 404 }
			);
		}

		if (user.role !== 'admin' && drill.created_by !== user.email) {
			return NextResponse.json(
				{
					code: 'AuthorizationError',
					message: 'You do not have permission to update this drill',
				},
				{ status: 403 }
			);
		}

		// Validate assigned_to emails if provided
		if (validated.assigned_to !== undefined) {
			if (validated.assigned_to.length === 0) {
				return NextResponse.json(
					{
						code: 'ValidationError',
						message: 'At least one student email must be assigned',
					},
					{ status: 400 }
				);
			}

			const studentUsers = await User.find({
				email: { $in: validated.assigned_to },
				role: 'user',
			})
				.select('email')
				.lean()
				.exec();

			if (studentUsers.length !== validated.assigned_to.length) {
				const foundEmails = studentUsers.map((u) => u.email);
				const missingEmails = validated.assigned_to.filter((email) => !foundEmails.includes(email));

				return NextResponse.json(
					{
						code: 'ValidationError',
						message: 'One or more assigned student emails are invalid or do not belong to learners',
						invalidEmails: missingEmails,
					},
					{ status: 400 }
				);
			}
		}

		// Update drill
		if (validated.title !== undefined) drill.title = validated.title;
		if (validated.type !== undefined) drill.type = validated.type;
		if (validated.difficulty !== undefined) drill.difficulty = validated.difficulty;
		if (validated.date !== undefined) drill.date = new Date(validated.date);
		if (validated.duration_days !== undefined) drill.duration_days = validated.duration_days;
		if (validated.assigned_to !== undefined) drill.assigned_to = validated.assigned_to;
		if (validated.is_active !== undefined) drill.is_active = validated.is_active;
		drill.updated_date = new Date();

		await drill.save();

		// Create DrillAssignment records for newly assigned users
		let newAssignmentsCount = 0;
		if (validated.assigned_to !== undefined) {
			// Get user IDs for the assigned emails
			const assignedUsers = await User.find({
				email: { $in: validated.assigned_to },
				role: 'user',
			})
				.select('_id email')
				.lean()
				.exec();

			// Get existing assignments to avoid duplicates
			const existingAssignments = await DrillAssignment.find({
				drillId: drill._id,
			})
				.select('learnerId')
				.lean()
				.exec();

			const existingUserIds = new Set(
				existingAssignments.map((a) => a.learnerId.toString())
			);

			// Create drill assignments for users that don't have one yet
			const assignmentPromises = assignedUsers
				.filter((user) => !existingUserIds.has(user._id.toString()))
				.map(async (user) => {
					try {
						// Calculate due date based on drill date and duration
						const dueDate = new Date(drill.date);
						dueDate.setDate(dueDate.getDate() + drill.duration_days);

						const assignment = await DrillAssignment.create({
							drillId: drill._id,
							learnerId: user._id, // learnerId field stores User ID
							assignedBy: context.userId,
							assignedAt: new Date(),
							dueDate: dueDate,
							status: 'pending',
						});

						return assignment;
					} catch (error: any) {
						// Handle duplicate assignment error
						if (error.code === 11000) {
							logger.warn('Duplicate drill assignment skipped', {
								drillId: drill._id,
								userId: user._id,
							});
							return null;
						}
						throw error;
					}
				});

			const assignments = await Promise.all(assignmentPromises);
			newAssignmentsCount = assignments.filter((a) => a !== null).length;

			// Update drill's totalAssignments count
			if (newAssignmentsCount > 0) {
				drill.totalAssignments = (drill.totalAssignments || 0) + newAssignmentsCount;
				await drill.save();
			}
		}

		logger.info('Drill updated successfully', {
			drillId: drill._id,
			updatedBy: context.userId,
			newAssignmentsCreated: newAssignmentsCount,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Drill updated successfully',
				data: { drill, newAssignmentsCreated: newAssignmentsCount },
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
		logger.error('Error updating drill', error);
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

// DELETE handler
async function deleteHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { drillId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { drillId } = params;

		if (!Types.ObjectId.isValid(drillId)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Invalid drill ID format',
				},
				{ status: 400 }
			);
		}

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

		// Check permissions
		const user = await User.findById(context.userId).select('email role').lean().exec();
		if (!user) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'User not found',
				},
				{ status: 404 }
			);
		}

		if (user.role !== 'admin' && drill.created_by !== user.email) {
			return NextResponse.json(
				{
					code: 'AuthorizationError',
					message: 'You do not have permission to delete this drill',
				},
				{ status: 403 }
			);
		}

		await Drill.findByIdAndDelete(drillId).exec();

		logger.info('Drill deleted successfully', {
			drillId,
			deletedBy: context.userId,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Drill deleted successfully',
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error deleting drill', error);
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

// Next.js App Router requires params to be passed differently
export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ drillId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['admin', 'user', 'tutor'], (req, context) =>
		getHandler(req, context, resolvedParams)
	)(req);
}

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ drillId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['tutor', 'admin'], (req, context) =>
		putHandler(req, context, resolvedParams)
	)(req);
}

export async function DELETE(
	req: NextRequest,
	{ params }: { params: Promise<{ drillId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['tutor', 'admin'], (req, context) =>
		deleteHandler(req, context, resolvedParams)
	)(req);
}

