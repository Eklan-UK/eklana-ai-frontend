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
	context: z.string().optional(),
	audio_example_url: z.string().url().optional(),
	// Vocabulary fields
	target_sentences: z.array(z.object({
		word: z.string().optional(),
		wordTranslation: z.string().optional(),
		text: z.string(),
		translation: z.string().optional(),
	})).optional(),
	// Roleplay fields
	student_character_name: z.string().optional(),
	ai_character_names: z.array(z.string()).optional(),
	roleplay_scenes: z.array(z.object({
		scene_name: z.string(),
		context: z.string().optional(),
		dialogue: z.array(z.object({
			speaker: z.string(),
			text: z.string(),
			translation: z.string().optional(),
		})),
	})).optional(),
	// Matching fields
	matching_pairs: z.array(z.object({
		left: z.string(),
		right: z.string(),
		leftTranslation: z.string().optional(),
		rightTranslation: z.string().optional(),
	})).optional(),
	// Definition fields
	definition_items: z.array(z.object({
		word: z.string(),
		hint: z.string().optional(),
	})).optional(),
	// Grammar fields
	grammar_items: z.array(z.object({
		pattern: z.string(),
		hint: z.string().optional(),
		example: z.string(),
	})).optional(),
	// Sentence Writing fields
	sentence_writing_items: z.array(z.object({
		word: z.string(),
		hint: z.string().optional(),
	})).optional(),
	// Summary fields
	article_title: z.string().optional(),
	article_content: z.string().optional(),
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

		// Validate assigned_to user IDs if provided
		let assignedUserIds: Types.ObjectId[] = [];
		if (validated.assigned_to !== undefined) {
			if (validated.assigned_to.length === 0) {
				return NextResponse.json(
					{
						code: 'ValidationError',
						message: 'At least one user ID must be assigned',
					},
					{ status: 400 }
				);
			}

			const userIds = validated.assigned_to.map((id) => new Types.ObjectId(id));
			const studentUsers = await User.find({
				_id: { $in: userIds },
				role: 'user',
			})
				.select('_id email')
				.lean()
				.exec();

			if (studentUsers.length !== validated.assigned_to.length) {
				const foundIds = studentUsers.map((u) => u._id.toString());
				const missingIds = validated.assigned_to.filter((id) => !foundIds.includes(id));

				return NextResponse.json(
					{
						code: 'ValidationError',
						message: 'One or more assigned user IDs are invalid or do not belong to users',
						invalidUserIds: missingIds,
					},
					{ status: 400 }
				);
			}
			assignedUserIds = studentUsers.map((u) => u._id);
		}

		// Update drill basic fields
		if (validated.title !== undefined) drill.title = validated.title;
		if (validated.type !== undefined) drill.type = validated.type;
		if (validated.difficulty !== undefined) drill.difficulty = validated.difficulty;
		if (validated.date !== undefined) drill.date = new Date(validated.date);
		if (validated.duration_days !== undefined) drill.duration_days = validated.duration_days;
		if (validated.assigned_to !== undefined) drill.assigned_to = assignedUserIds.map((id) => id.toString());
		if (validated.is_active !== undefined) drill.is_active = validated.is_active;
		if (validated.context !== undefined) drill.context = validated.context;
		if (validated.audio_example_url !== undefined) drill.audio_example_url = validated.audio_example_url;

		// Update type-specific fields
		if (validated.target_sentences !== undefined) drill.target_sentences = validated.target_sentences;
		if (validated.student_character_name !== undefined) drill.student_character_name = validated.student_character_name;
		if (validated.ai_character_names !== undefined) drill.ai_character_names = validated.ai_character_names;
		if (validated.roleplay_scenes !== undefined) drill.roleplay_scenes = validated.roleplay_scenes;
		if (validated.matching_pairs !== undefined) drill.matching_pairs = validated.matching_pairs;
		if (validated.definition_items !== undefined) drill.definition_items = validated.definition_items;
		if (validated.grammar_items !== undefined) drill.grammar_items = validated.grammar_items;
		if (validated.sentence_writing_items !== undefined) drill.sentence_writing_items = validated.sentence_writing_items;
		if (validated.article_title !== undefined) drill.article_title = validated.article_title;
		if (validated.article_content !== undefined) drill.article_content = validated.article_content;

		drill.updated_date = new Date();

		await drill.save();

		// Create DrillAssignment records for newly assigned users
		let newAssignmentsCount = 0;
		if (assignedUserIds.length > 0) {
			// Get user details for the assigned user IDs
			const assignedUsers = await User.find({
				_id: { $in: assignedUserIds },
				role: 'user',
			})
				.select('_id email firstName lastName')
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

