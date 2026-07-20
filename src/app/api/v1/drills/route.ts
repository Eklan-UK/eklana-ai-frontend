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
import { roleplaySpeakerIdSchema } from '@/lib/roleplay-speakers';
import {
	learningJourneyPartSchema,
	learningJourneyTopicSchema,
	refineLearningJourneyFields,
} from '@/domain/learning-journey/learning-journey.validation';
import { assertLearnersEnrolledForDrill } from '@/domain/learning-journey/mission-enrollment.service';

// Validation schemas
const targetSentenceSchema = z.object({
	word: z.string().optional(),
	wordTranslation: z.string().optional(),
	text: z.string().min(1),
	translation: z.string().optional(),
	wordAudioUrl: z.string().optional(),
	sentenceAudioUrl: z.string().optional(),
});

const pronunciationItemSchema = z.object({
	sound: z.string().trim().min(1),
	word: z.string().trim().min(1),
	sentence: z.string().trim().min(1),
	soundAudioUrl: z.string().optional(),
	wordAudioUrl: z.string().optional(),
	sentenceAudioUrl: z.string().optional(),
});

const dialogueTurnSchema = z.object({
	speaker: roleplaySpeakerIdSchema,
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
	audioUrl: z.string().optional(),
});

const grammarItemSchema = z.object({
	pattern: z.string().min(1),
	hint: z.string().optional(),
	example: z.string().min(1),
	patternAudioUrl: z.string().optional(),
	exampleAudioUrl: z.string().optional(),
});

const sentenceWritingItemSchema = z.object({
	word: z.string().min(1),
	hint: z.string().optional(),
	audioUrl: z.string().optional(),
});

const fillBlankBlankSchema = z.object({
	position: z.number().int().min(0),
	correctAnswer: z.string().trim().min(1),
	options: z.array(z.string().trim().min(1)).min(2),
	hint: z.string().optional(),
}).superRefine((data, ctx) => {
	if (!data.options.includes(data.correctAnswer)) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "Options must include the correct answer",
			path: ["options"],
		});
	}
});

const fillBlankItemSchema = z.object({
	context: z.string().optional(),
	sentence: z.string().trim().min(1),
	blanks: z.array(fillBlankBlankSchema).min(1),
	translation: z.string().optional(),
	audioUrl: z.string().optional(),
});

const keyPhraseItemSchema = z.object({
	prompt: z.string().min(1),
	respondentName: z.string().optional(),
	options: z.array(z.string().min(1)).min(2),
	correctAnswer: z.string().min(1),
	promptAudioUrl: z.string().optional(),
}).superRefine((data, ctx) => {
	if (!data.options.includes(data.correctAnswer)) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "correctAnswer must be one of the options",
			path: ["correctAnswer"],
		});
	}
});

const createDrillSchema = z.object({
	title: z.string().max(200).default(""),
	type: z.enum(['vocabulary', 'pronunciation', 'roleplay', 'matching', 'definition', 'summary', 'grammar', 'sentence_writing', 'sentence', 'listening', 'fill_blank', 'key_phrases']),
	difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
	date: z.string().datetime(),
	duration_days: z.number().int().min(1).optional(),
	assigned_to: z.array(z.string().refine((id) => Types.ObjectId.isValid(id), {
		message: 'Each user ID must be a valid MongoDB ObjectId',
	})).min(0),
	context: z.string().optional(),
	audio_example_url: z.string().url().optional(),
	tts_voice_key: z.string().optional(),
	target_sentences: z.array(targetSentenceSchema).optional(),
	pronunciation_items: z.array(pronunciationItemSchema).optional(),
	roleplay_dialogue: z.array(dialogueTurnSchema).optional(),
	roleplay_scenes: z.array(roleplaySceneSchema).optional(),
	student_character_name: z.string().optional(),
	ai_character_name: z.string().optional(),
	ai_character_names: z.array(z.string()).optional(),
	drill_intro: z.string().max(5000).optional(),
	matching_pairs: z.array(matchingPairSchema).optional(),
	definition_items: z.array(definitionItemSchema).optional(),
	grammar_items: z.array(grammarItemSchema).optional(),
	sentence_writing_items: z.array(sentenceWritingItemSchema).optional(),
	sentence_drill_word: z.string().optional(),
	sentence_drill_audio_url: z.string().optional(),
	listening_drill_title: z.string().optional(),
	listening_drill_content: z.string().optional(),
	listening_drill_audio_url: z.string().optional(),
	article_title: z.string().optional(),
	article_content: z.string().optional(),
	article_audio_url: z.string().optional(),
	fill_blank_items: z.array(fillBlankItemSchema).optional(),
	key_phrase_items: z.array(keyPhraseItemSchema).optional(),
	is_active: z.boolean().optional(),
	learning_journey_part: learningJourneyPartSchema.optional(),
	learning_journey_topic: learningJourneyTopicSchema.optional(),
}).superRefine((data, ctx) => {
	refineLearningJourneyFields(data, ctx, { requireAlways: true });
	if (data.type === 'vocabulary') {
		if (!data.target_sentences || data.target_sentences.length < 1) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Vocabulary drills require at least one target sentence',
				path: ['target_sentences'],
			});
		}
	}
	if (data.type === 'pronunciation') {
		if (!data.pronunciation_items || data.pronunciation_items.length < 1) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Pronunciation drills require at least one pronunciation item',
				path: ['pronunciation_items'],
			});
		}
	}
});

// GET handler
async function getHandler(
	req: NextRequest,
	context: { userId: string; userRole: string }
) {
	await connectToDatabase();

	const queryParams = parseQueryParams(req);
	
	// Initialize services
	const drillRepo = new DrillRepository();
	const assignmentRepo = new AssignmentRepository();
	const attemptRepo = new AttemptRepository();
	const drillService = new DrillService(drillRepo, assignmentRepo, attemptRepo);

	// List drills
	const assignmentStatus =
		queryParams.assignmentStatus === 'saved' || queryParams.assignmentStatus === 'assigned'
			? queryParams.assignmentStatus
			: undefined;

	// Parse comma-separated assignedToIds param for server-side student filtering
	const rawAssignedToIds = new URL(req.url).searchParams.get('assignedToIds');
	const assignedToIds = rawAssignedToIds
		? rawAssignedToIds.split(',').map(s => s.trim()).filter(Boolean)
		: undefined;

	const result = await drillService.listDrills({
		type: queryParams.type,
		difficulty: queryParams.difficulty,
		assignedToIds,
		studentEmail: assignedToIds ? undefined : queryParams.search,
		createdBy: queryParams.role === 'creator' ? context.userId.toString() : undefined,
		isActive: queryParams.isActive,
		assignmentStatus,
		q: queryParams.q,
		isBookmarked: queryParams.isBookmarked,
		learningJourneyPart: queryParams.learningJourneyPart,
		learningJourneyTopic: queryParams.learningJourneyTopic,
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
	context: { userId: string; userRole: string }
) {
	await connectToDatabase();

	const body = await parseRequestBody(req);
	const validated = validateRequest(createDrillSchema, body);

	if (validated.learning_journey_part && validated.assigned_to.length > 0) {
		await assertLearnersEnrolledForDrill({
			learnerIds: validated.assigned_to,
			part: validated.learning_journey_part,
		});
	}

	// Initialize services
	const drillRepo = new DrillRepository();
	const assignmentRepo = new AssignmentRepository();
	const attemptRepo = new AttemptRepository();
	const drillService = new DrillService(drillRepo, assignmentRepo, attemptRepo);

	const isSavedDrill = validated.assigned_to.length === 0;

	// Prepare drill data
	const drillData: any = {
		title: validated.title,
		type: validated.type,
		difficulty: validated.difficulty || 'intermediate',
		date: new Date(validated.date),
		duration_days: validated.duration_days || 1,
		assigned_to: validated.assigned_to.map(id => id.toString()),
		is_active: isSavedDrill
			? false
			: validated.is_active !== undefined
				? validated.is_active
				: true,
		totalAssignments: 0,
		totalCompletions: 0,
		averageScore: 0,
		averageCompletionTime: 0,
	};

	// Add optional fields
	if (validated.context !== undefined) drillData.context = validated.context;
	if (validated.audio_example_url !== undefined) drillData.audio_example_url = validated.audio_example_url;
	if (validated.tts_voice_key !== undefined) drillData.tts_voice_key = validated.tts_voice_key || null;
	if (validated.type === 'vocabulary') {
		if (validated.target_sentences !== undefined) drillData.target_sentences = validated.target_sentences;
		drillData.pronunciation_items = [];
	} else if (validated.type === 'pronunciation') {
		if (validated.pronunciation_items !== undefined) drillData.pronunciation_items = validated.pronunciation_items;
		drillData.target_sentences = [];
	} else {
		if (validated.target_sentences !== undefined) drillData.target_sentences = validated.target_sentences;
		drillData.pronunciation_items = [];
	}
	if (validated.roleplay_dialogue !== undefined) drillData.roleplay_dialogue = validated.roleplay_dialogue;
	if (validated.roleplay_scenes !== undefined) drillData.roleplay_scenes = validated.roleplay_scenes;
	if (validated.student_character_name !== undefined) drillData.student_character_name = validated.student_character_name;
	if (validated.ai_character_name !== undefined) drillData.ai_character_name = validated.ai_character_name;
	if (validated.ai_character_names !== undefined) drillData.ai_character_names = validated.ai_character_names;
	if (validated.drill_intro !== undefined) drillData.drill_intro = validated.drill_intro;
	if (validated.matching_pairs !== undefined) drillData.matching_pairs = validated.matching_pairs;
	if (validated.definition_items !== undefined) drillData.definition_items = validated.definition_items;
	if (validated.grammar_items !== undefined) drillData.grammar_items = validated.grammar_items;
	if (validated.sentence_writing_items !== undefined) drillData.sentence_writing_items = validated.sentence_writing_items;
	if (validated.sentence_drill_word !== undefined) drillData.sentence_drill_word = validated.sentence_drill_word;
	if (validated.sentence_drill_audio_url !== undefined) drillData.sentence_drill_audio_url = validated.sentence_drill_audio_url;
	if (validated.listening_drill_title !== undefined) drillData.listening_drill_title = validated.listening_drill_title;
	if (validated.listening_drill_content !== undefined) drillData.listening_drill_content = validated.listening_drill_content;
	if (validated.listening_drill_audio_url !== undefined) drillData.listening_drill_audio_url = validated.listening_drill_audio_url;
	if (validated.article_title !== undefined) drillData.article_title = validated.article_title;
	if (validated.article_content !== undefined) drillData.article_content = validated.article_content;
	if (validated.article_audio_url !== undefined) drillData.article_audio_url = validated.article_audio_url;
	if (validated.fill_blank_items !== undefined) drillData.fill_blank_items = validated.fill_blank_items;
	if (validated.key_phrase_items !== undefined) drillData.key_phrase_items = validated.key_phrase_items;
	if (validated.learning_journey_part !== undefined) {
		drillData.learning_journey_part = validated.learning_journey_part;
	}
	if (validated.learning_journey_topic !== undefined) {
		drillData.learning_journey_topic = validated.learning_journey_topic;
	}

	// Create drill
	const result = await drillService.createDrill({
		drillData,
		creatorId: context.userId.toString(),
		assignedUserIds: validated.assigned_to,
	});

	return apiResponse.success(
		{
			drill: result.drill,
			assignmentsCreated: result.assignmentsCreated,
			assignmentsRequested: result.assignmentsRequested,
			failedLearnerIds: result.failedLearnerIds,
		},
		201
	);
}

export const GET = withRole(['admin', 'user', 'tutor'], withErrorHandler(getHandler));
export const POST = withRole(['tutor', 'admin'], withErrorHandler(postHandler));
