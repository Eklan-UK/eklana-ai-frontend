// GET /api/v1/drills - Get all drills
// POST /api/v1/drills - Create a new drill
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { Types } from 'mongoose';
import { z } from 'zod';
import { parseRequestBody } from '@/lib/api/request-parser';
import { parseQueryParams } from '@/lib/api/query-parser';
import { validateRequest } from '@/lib/api/validation';
import { apiResponse } from '@/lib/api/response';
import { DrillService } from '@/domain/drills/drill.service';
import { DrillRepository } from '@/domain/drills/drill.repository';
import { AssignmentRepository } from '@/domain/assignments/assignment.repository';
import { AttemptRepository } from '@/domain/attempts/attempt.repository';

// Validation schemas
const targetSentenceSchema = z.object({
	word: z.string().optional(),
	wordTranslation: z.string().optional(),
	text: z.string().min(1),
	translation: z.string().optional(),
	wordAudioUrl: z.string().optional(),
	sentenceAudioUrl: z.string().optional(),
});

const dialogueTurnSchema = z.object({
	speaker: z.enum(['student', 'ai_0', 'ai_1', 'ai_2', 'ai_3']),
	text: z.string().min(1),
	translation: z.string().optional(),
	audioUrl: z.string().optional(),
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
	leftAudioUrl: z.string().optional(),
	rightAudioUrl: z.string().optional(),
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
	type: z.enum(['vocabulary', 'roleplay', 'matching', 'definition', 'summary', 'grammar', 'sentence_writing', 'sentence', 'listening']),
	difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
	date: z.string().datetime(),
	duration_days: z.number().int().min(1).optional(),
	assigned_to: z.array(z.string().refine((id) => Types.ObjectId.isValid(id), {
		message: 'Each user ID must be a valid MongoDB ObjectId',
	})).min(1),
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
	sentence_drill_word: z.string().optional(),
	listening_drill_title: z.string().optional(),
	listening_drill_content: z.string().optional(),
	listening_drill_audio_url: z.string().optional(),
	article_title: z.string().optional(),
	article_content: z.string().optional(),
	article_audio_url: z.string().optional(),
	is_active: z.boolean().optional(),
});

// GET handler
async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
) {
	await connectToDatabase();

	const queryParams = parseQueryParams(req);
	
	// Initialize services
	const drillRepo = new DrillRepository();
	const assignmentRepo = new AssignmentRepository();
	const attemptRepo = new AttemptRepository();
	const drillService = new DrillService(drillRepo, assignmentRepo, attemptRepo);

	// List drills
	const result = await drillService.listDrills({
		type: queryParams.type,
		difficulty: queryParams.difficulty,
		studentEmail: queryParams.search, // Using search param for studentEmail
		createdBy: queryParams.role === 'creator' ? context.userId.toString() : undefined,
		isActive: queryParams.isActive,
		limit: queryParams.limit,
		offset: queryParams.offset,
	});

	return apiResponse.success({
		drills: result.drills,
		total: result.total,
		limit: result.limit,
		offset: result.offset,
	});
}

// POST handler
async function postHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
) {
	await connectToDatabase();

	const body = await parseRequestBody(req);
	const validated = validateRequest(createDrillSchema, body);

	// Initialize services
	const drillRepo = new DrillRepository();
	const assignmentRepo = new AssignmentRepository();
	const attemptRepo = new AttemptRepository();
	const drillService = new DrillService(drillRepo, assignmentRepo, attemptRepo);

	// Prepare drill data
	const drillData: any = {
		title: validated.title,
		type: validated.type,
		difficulty: validated.difficulty || 'intermediate',
		date: new Date(validated.date),
		duration_days: validated.duration_days || 1,
		assigned_to: validated.assigned_to.map(id => id.toString()),
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
	if (validated.student_character_name !== undefined) drillData.student_character_name = validated.student_character_name;
	if (validated.ai_character_name !== undefined) drillData.ai_character_name = validated.ai_character_name;
	if (validated.ai_character_names !== undefined) drillData.ai_character_names = validated.ai_character_names;
	if (validated.matching_pairs !== undefined) drillData.matching_pairs = validated.matching_pairs;
	if (validated.definition_items !== undefined) drillData.definition_items = validated.definition_items;
	if (validated.grammar_items !== undefined) drillData.grammar_items = validated.grammar_items;
	if (validated.sentence_writing_items !== undefined) drillData.sentence_writing_items = validated.sentence_writing_items;
	if (validated.sentence_drill_word !== undefined) drillData.sentence_drill_word = validated.sentence_drill_word;
	if (validated.listening_drill_title !== undefined) drillData.listening_drill_title = validated.listening_drill_title;
	if (validated.listening_drill_content !== undefined) drillData.listening_drill_content = validated.listening_drill_content;
	if (validated.listening_drill_audio_url !== undefined) drillData.listening_drill_audio_url = validated.listening_drill_audio_url;
	if (validated.article_title !== undefined) drillData.article_title = validated.article_title;
	if (validated.article_content !== undefined) drillData.article_content = validated.article_content;
	if (validated.article_audio_url !== undefined) drillData.article_audio_url = validated.article_audio_url;

	// Create drill
	const result = await drillService.createDrill({
		drillData,
		creatorId: context.userId.toString(),
		assignedUserIds: validated.assigned_to,
	});

	return apiResponse.success(
		{
			drill: result.drill,
			assignmentsCreated: result.assignmentCount,
		},
		201
	);
}

export const GET = withRole(['admin', 'user', 'tutor'], withErrorHandler(getHandler));
export const POST = withRole(['tutor', 'admin'], withErrorHandler(postHandler));
