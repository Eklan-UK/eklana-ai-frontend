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

// GET handler - Simple, direct drill fetch by ID
async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { drillId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { drillId } = params;
		const { searchParams } = new URL(req.url);
		const assignmentId = searchParams.get('assignmentId');

		// Validate drill ID
		if (!Types.ObjectId.isValid(drillId)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Invalid drill ID format',
				},
				{ status: 400 }
			);
		}

		// Fetch drill directly
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

		// Permission check: Use DrillAssignment if assignmentId provided, otherwise check role-based access
		if (assignmentId) {
			// Validate assignmentId format
			if (!Types.ObjectId.isValid(assignmentId)) {
				return NextResponse.json(
					{
						code: 'ValidationError',
						message: 'Invalid assignment ID format',
					},
					{ status: 400 }
				);
			}

			// Verify assignment exists and belongs to the user
			const assignment = await DrillAssignment.findOne({
				_id: new Types.ObjectId(assignmentId),
				drillId: new Types.ObjectId(drillId),
				learnerId: context.userId,
			}).lean().exec();

			if (!assignment) {
				return NextResponse.json(
					{
						code: 'NotFoundError',
						message: 'Assignment not found or you do not have access',
					},
					{ status: 404 }
				);
			}

			// Return drill with assignment info
			return NextResponse.json({
				drill,
				assignment: {
					assignmentId: assignment._id,
					status: assignment.status,
					dueDate: assignment.dueDate,
					completedAt: assignment.completedAt,
				},
			}, { status: 200 });
		}

		// No assignmentId provided - check role-based permissions
		// Use userRole from context to avoid extra query
		const userRole = context.userRole;

		// Admin: can view any drill
		if (userRole === 'admin') {
			return NextResponse.json({ drill }, { status: 200 });
		}

		// Tutor: can view drills they created
		if (userRole === 'tutor') {
			// Check createdById first (preferred method)
			const isCreatorById = drill.createdById?.toString() === context.userId.toString();
			
			// If createdById matches, allow access
			if (isCreatorById) {
				return NextResponse.json({ drill }, { status: 200 });
			}
			
			// Fallback: check created_by email (legacy support)
			// Only fetch user if created_by looks like an email
			if (typeof drill.created_by === 'string' && drill.created_by.includes('@')) {
				const user = await User.findById(context.userId).select('email').lean().exec();
				if (user && drill.created_by === user.email) {
					return NextResponse.json({ drill }, { status: 200 });
				}
			}
			
			// Not the creator
			return NextResponse.json(
				{
					code: 'AuthorizationError',
					message: 'You do not have permission to view this drill',
				},
				{ status: 403 }
			);
		}

		// User: must have an assignment to view the drill
		// Use indexed query for performance
		if (userRole === 'user') {
			const assignment = await DrillAssignment.findOne({
				drillId: new Types.ObjectId(drillId),
				learnerId: context.userId,
			})
				.select('_id status dueDate completedAt')
				.lean()
				.exec();

			if (!assignment) {
				return NextResponse.json(
					{
						code: 'AuthorizationError',
						message: 'You do not have access to this drill',
					},
					{ status: 403 }
				);
			}

			return NextResponse.json({ drill }, { status: 200 });
		}

		// Fallback: deny access
		return NextResponse.json(
			{
				code: 'AuthorizationError',
				message: 'You do not have permission to view this drill',
			},
			{ status: 403 }
		);
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
			const newUsers = assignedUsers.filter(
				(user) => !existingUserIds.has(user._id.toString())
			);

			if (newUsers.length > 0) {
				// drill.date is now the completion/due date
				const dueDate = new Date(drill.date);

				// Bulk insert assignments (much faster than individual creates)
				const newAssignments = newUsers.map((user) => ({
					drillId: drill._id,
					learnerId: user._id,
					assignedBy: context.userId,
					assignedAt: new Date(),
					dueDate: dueDate,
					status: 'pending' as const,
				}));

				try {
					const createdAssignments = await DrillAssignment.insertMany(newAssignments, {
						ordered: false, // Continue even if some fail
					});
					newAssignmentsCount = Array.isArray(createdAssignments) ? createdAssignments.length : 0;
				} catch (error: any) {
					// Handle partial failures
					if (error.writeErrors) {
						newAssignmentsCount = error.insertedDocs?.length || 0;
						logger.warn('Some drill assignments failed', {
							successful: newAssignmentsCount,
							failed: error.writeErrors.length,
						});
					} else {
						throw error;
					}
				}
			}

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


