// GET /api/v1/drills - Get all drills
// POST /api/v1/drills - Create a new drill
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

// Validation schemas
const targetSentenceSchema = z.object({
	word: z.string().optional(),
	wordTranslation: z.string().optional(),
	text: z.string().min(1),
	translation: z.string().optional(),
});

const dialogueTurnSchema = z.object({
	speaker: z.enum(['student', 'ai_0', 'ai_1', 'ai_2', 'ai_3']),
	text: z.string().min(1),
	translation: z.string().optional(),
});

const roleplaySceneSchema = z.object({
	scene_name: z.string().min(1),
	context: z.string().optional(),
	dialogue: z.array(dialogueTurnSchema).min(1),
});

const matchingPairSchema = z.object({
	left: z.string().min(1),
	right: z.string().min(1),
	leftTranslation: z.string().optional(),
	rightTranslation: z.string().optional(),
});

const definitionItemSchema = z.object({
	word: z.string().min(1),
	hint: z.string().optional(),
});

const grammarItemSchema = z.object({
	pattern: z.string().min(1),
	hint: z.string().optional(),
	example: z.string().min(1),
});

const sentenceWritingItemSchema = z.object({
	word: z.string().min(1),
	hint: z.string().optional(),
});

const createDrillSchema = z.object({
	title: z.string().min(1).max(200),
	type: z.enum(['vocabulary', 'roleplay', 'matching', 'definition', 'summary', 'grammar', 'sentence_writing']),
	difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
	date: z.string().datetime(),
	duration_days: z.number().int().min(1).optional(),
	assigned_to: z.array(z.string().email()).min(1),
	context: z.string().optional(),
	audio_example_url: z.string().url().optional(),
	target_sentences: z.array(targetSentenceSchema).optional(),
	roleplay_dialogue: z.array(dialogueTurnSchema).optional(),
	roleplay_scenes: z.array(roleplaySceneSchema).optional(),
	student_character_name: z.string().optional(),
	ai_character_name: z.string().optional(),
	ai_character_names: z.array(z.string()).optional(),
	matching_pairs: z.array(matchingPairSchema).optional(),
	definition_items: z.array(definitionItemSchema).optional(),
	grammar_items: z.array(grammarItemSchema).optional(),
	sentence_writing_items: z.array(sentenceWritingItemSchema).optional(),
	article_title: z.string().optional(),
	article_content: z.string().optional(),
	is_active: z.boolean().optional(),
});

// GET handler
async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { searchParams } = new URL(req.url);
		const limit = parseInt(searchParams.get('limit') || '20');
		const offset = parseInt(searchParams.get('offset') || '0');
		const type = searchParams.get('type');
		const difficulty = searchParams.get('difficulty');
		const studentEmail = searchParams.get('studentEmail');
		const createdBy = searchParams.get('createdBy');
		const isActive = searchParams.get('isActive');

		const query: any = {};

		if (type) query.type = type;
		if (difficulty) query.difficulty = difficulty;
		if (isActive !== null) query.is_active = isActive === 'true';
		if (createdBy) query.created_by = createdBy;
		if (studentEmail) query.assigned_to = studentEmail;

		const drills = await Drill.find(query)
			.limit(limit)
			.skip(offset)
			.sort({ created_date: -1 })
			.lean()
			.exec();

		const total = await Drill.countDocuments(query);

		// Return in format compatible with both old and new API clients
		return NextResponse.json(
			{
				drills,
				total,
				limit,
				offset,
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching drills', error);
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

// POST handler
async function postHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const body = await req.json();
		const validated = createDrillSchema.parse(body);

		// Get creator
		const creator = await User.findById(context.userId).select('email role').lean().exec();
		if (!creator) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'User not found',
				},
				{ status: 404 }
			);
		}

		// Validate assigned students
		if (validated.assigned_to && validated.assigned_to.length > 0) {
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

		// Create drill
		const drillData: any = {
			title: validated.title,
			type: validated.type,
			difficulty: validated.difficulty || 'intermediate',
			date: new Date(validated.date),
			duration_days: validated.duration_days || 1,
			assigned_to: validated.assigned_to,
			created_by: creator.email,
			createdById: context.userId,
			created_date: new Date(),
			updated_date: new Date(),
			is_active: validated.is_active !== undefined ? validated.is_active : true,
			totalAssignments: 0,
			totalCompletions: 0,
			averageScore: 0,
			averageCompletionTime: 0,
		};

		// Add optional fields
		if (validated.context !== undefined) drillData.context = validated.context;
		if (validated.audio_example_url !== undefined) drillData.audio_example_url = validated.audio_example_url;
		if (validated.target_sentences !== undefined) drillData.target_sentences = validated.target_sentences;
		if (validated.roleplay_dialogue !== undefined) drillData.roleplay_dialogue = validated.roleplay_dialogue;
		if (validated.roleplay_scenes !== undefined) drillData.roleplay_scenes = validated.roleplay_scenes;
		if (validated.student_character_name !== undefined)
			drillData.student_character_name = validated.student_character_name;
		if (validated.ai_character_name !== undefined) drillData.ai_character_name = validated.ai_character_name;
		if (validated.ai_character_names !== undefined) drillData.ai_character_names = validated.ai_character_names;
		if (validated.matching_pairs !== undefined) drillData.matching_pairs = validated.matching_pairs;
		if (validated.definition_items !== undefined) drillData.definition_items = validated.definition_items;
		if (validated.grammar_items !== undefined) drillData.grammar_items = validated.grammar_items;
		if (validated.sentence_writing_items !== undefined)
			drillData.sentence_writing_items = validated.sentence_writing_items;
		if (validated.article_title !== undefined) drillData.article_title = validated.article_title;
		if (validated.article_content !== undefined) drillData.article_content = validated.article_content;

		const drill = await Drill.create(drillData);

		// Create DrillAssignment records for assigned learners
		let assignmentCount = 0;
		if (validated.assigned_to && validated.assigned_to.length > 0) {
			// Get user IDs for the assigned emails
			const assignedUsers = await User.find({
				email: { $in: validated.assigned_to },
				role: 'user',
			})
				.select('_id email')
				.lean()
				.exec();

			// Get learner profiles for these users
			const learnerProfiles = await Learner.find({
				userId: { $in: assignedUsers.map((u) => u._id) },
			}).exec();

			// Create drill assignments
			const assignmentPromises = learnerProfiles.map(async (learner) => {
				try {
					// Check if assignment already exists (shouldn't happen on create, but just in case)
					const existingAssignment = await DrillAssignment.findOne({
						drillId: drill._id,
						learnerId: learner._id,
					}).exec();

					if (existingAssignment) {
						logger.warn('Drill assignment already exists', {
							drillId: drill._id,
							learnerId: learner._id,
						});
						return null;
					}

					// Calculate due date based on drill date and duration
					const dueDate = new Date(validated.date);
					dueDate.setDate(dueDate.getDate() + (validated.duration_days || 1));

					const assignment = await DrillAssignment.create({
						drillId: drill._id,
						learnerId: learner._id,
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
							learnerId: learner._id,
						});
						return null;
					}
					throw error;
				}
			});

			const assignments = await Promise.all(assignmentPromises);
			assignmentCount = assignments.filter((a) => a !== null).length;

			// Update drill's totalAssignments count
			drill.totalAssignments = assignmentCount;
			await drill.save();
		}

		logger.info('Drill created successfully', {
			drillId: drill._id,
			createdBy: context.userId,
			assignmentsCreated: assignmentCount,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Drill created successfully',
				drill,
				assignmentsCreated: assignmentCount,
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
		logger.error('Error creating drill', error);
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

export const GET = withRole(['admin', 'user', 'tutor'], getHandler);
export const POST = withRole(['tutor', 'admin'], postHandler);

