// GET, PUT, DELETE /api/v1/drills/[drillId]
import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { withErrorHandler } from "@/lib/api/error-handler";
import { connectToDatabase } from "@/lib/api/db";
import { Types } from "mongoose";
import { z } from "zod";
import { parseRequestBody } from "@/lib/api/request-parser";
import { parseQueryParams } from "@/lib/api/query-parser";
import { validateRequest } from "@/lib/api/validation";
import { apiResponse } from "@/lib/api/response";
import { DrillService } from "@/domain/drills/drill.service";
import { DrillRepository } from "@/domain/drills/drill.repository";
import { AssignmentRepository } from "@/domain/assignments/assignment.repository";
import { AttemptRepository } from "@/domain/attempts/attempt.repository";
import {
	learningJourneyPartSchema,
	learningJourneyTopicSchema,
	refineLearningJourneyFields,
} from "@/domain/learning-journey/learning-journey.validation";

// Update drill schema
const updateDrillSchema = z.object({
	title: z.string().max(200).optional(),
	type: z.enum([
		"vocabulary",
		"pronunciation",
		"roleplay",
		"matching",
		"definition",
		"summary",
		"grammar",
		"sentence_writing",
		"sentence",
		"listening",
		"fill_blank",
		"key_phrases",
	]).optional(),
	difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
	date: z.string().datetime().optional(),
	duration_days: z.number().int().min(1).optional(),
	assigned_to: z.array(z.string().refine((id) => Types.ObjectId.isValid(id), {
		message: 'Each user ID must be a valid MongoDB ObjectId',
	})).optional(),
	is_active: z.boolean().optional(),
	context: z.string().optional(),
	audio_example_url: z.string().url().optional(),
	target_sentences: z.array(z.object({
		word: z.string().optional(),
		wordTranslation: z.string().optional(),
		text: z.string(),
		translation: z.string().optional(),
		wordAudioUrl: z.string().optional(),
		sentenceAudioUrl: z.string().optional(),
	})).optional(),
	pronunciation_items: z.array(z.object({
		sound: z.string().trim().min(1),
		word: z.string().trim().min(1),
		sentence: z.string().trim().min(1),
		soundAudioUrl: z.string().optional(),
		wordAudioUrl: z.string().optional(),
		sentenceAudioUrl: z.string().optional(),
	})).optional(),
	student_character_name: z.string().optional(),
	ai_character_names: z.array(z.string()).optional(),
	drill_intro: z.string().max(5000).optional(),
	roleplay_scenes: z.array(z.object({
		scene_name: z.string(),
		context: z.string().optional(),
		dialogue: z.array(z.object({
			speaker: z.string(),
			text: z.string(),
			translation: z.string().optional(),
			audioUrl: z.string().optional(),
		})),
	})).optional(),
	matching_pairs: z.array(z.object({
		left: z.string(),
		right: z.string(),
		leftTranslation: z.string().optional(),
		rightTranslation: z.string().optional(),
		leftAudioUrl: z.string().optional(),
		rightAudioUrl: z.string().optional(),
	})).optional(),
	definition_items: z.array(z.object({
		word: z.string(),
		hint: z.string().optional(),
		audioUrl: z.string().optional(),
	})).optional(),
	grammar_items: z.array(z.object({
		pattern: z.string(),
		hint: z.string().optional(),
		example: z.string(),
		patternAudioUrl: z.string().optional(),
		exampleAudioUrl: z.string().optional(),
	})).optional(),
	sentence_writing_items: z.array(z.object({
		word: z.string(),
		hint: z.string().optional(),
		audioUrl: z.string().optional(),
	})).optional(),
	sentence_drill_word: z.string().optional(),
	sentence_drill_audio_url: z.string().optional(),
	listening_drill_title: z.string().optional(),
	listening_drill_content: z.string().optional(),
	listening_drill_audio_url: z.string().optional(),
	article_title: z.string().optional(),
	article_content: z.string().optional(),
	article_audio_url: z.string().optional(),
	fill_blank_items: z.array(z.object({
		context: z.string().optional(),
		sentence: z.string().trim().min(1),
		blanks: z.array(z.object({
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
		})).min(1),
		translation: z.string().optional(),
		audioUrl: z.string().optional(),
	})).optional(),
	key_phrase_items: z.array(z.object({
		prompt: z.string().min(1),
		respondentName: z.string().optional(),
		options: z.array(z.string().min(1)).min(2),
		correctAnswer: z.string().min(1),
		promptAudioUrl: z.string().optional(),
	})).optional(),
	learning_journey_part: learningJourneyPartSchema.optional(),
	learning_journey_topic: learningJourneyTopicSchema.optional(),
}).superRefine((data, ctx) => {
	refineLearningJourneyFields(data, ctx);
});

// GET handler
async function getHandler(
	req: NextRequest,
	context: { userId: string; userRole: string },
	params: { drillId: string }
) {
	await connectToDatabase();

	const { drillId } = params;
	const { searchParams } = new URL(req.url);
	const assignmentId = searchParams.get("assignmentId");

	// Initialize services
	const drillRepo = new DrillRepository();
	const assignmentRepo = new AssignmentRepository();
	const attemptRepo = new AttemptRepository();
	const drillService = new DrillService(drillRepo, assignmentRepo, attemptRepo);

	// Get drill with permission check
	const result = await drillService.getDrillById(
		drillId,
		context.userId.toString(),
		context.userRole as 'admin' | 'user' | 'tutor',
		assignmentId || undefined
	);

	return apiResponse.success(result);
}

// PUT handler
async function putHandler(
	req: NextRequest,
	context: { userId: string; userRole: string },
	params: { drillId: string }
) {
	await connectToDatabase();

	const { drillId } = params;
	const body = await parseRequestBody(req);
	const validated = validateRequest(updateDrillSchema, body);

	// Initialize services
	const drillRepo = new DrillRepository();
	const assignmentRepo = new AssignmentRepository();
	const attemptRepo = new AttemptRepository();
	const drillService = new DrillService(drillRepo, assignmentRepo, attemptRepo);

	const existing = await drillRepo.findById(drillId);
	if (!existing) {
		return apiResponse.notFound("Drill");
	}

	// Validate assigned_to if provided
	if (validated.assigned_to !== undefined && validated.assigned_to.length === 0) {
		const totalAssignments = (existing as { totalAssignments?: number }).totalAssignments ?? 0;
		if (totalAssignments > 0) {
			return apiResponse.validationError(
				"Cannot clear assignments on a drill that has already been assigned"
			);
		}
	}

	// Prepare update data
	const updateData: any = {};
	if (validated.title !== undefined) updateData.title = validated.title;
	if (validated.type !== undefined) updateData.type = validated.type;
	if (validated.difficulty !== undefined) updateData.difficulty = validated.difficulty;
	if (validated.date !== undefined) updateData.date = new Date(validated.date);
	if (validated.duration_days !== undefined) updateData.duration_days = validated.duration_days;
	if (validated.assigned_to !== undefined) {
		updateData.assigned_to = validated.assigned_to;
		if (validated.assigned_to.length === 0) {
			updateData.is_active = false;
		}
	}
	if (validated.is_active !== undefined) updateData.is_active = validated.is_active;
	if (validated.context !== undefined) updateData.context = validated.context;
	if (validated.audio_example_url !== undefined) updateData.audio_example_url = validated.audio_example_url;
	if (validated.target_sentences !== undefined) updateData.target_sentences = validated.target_sentences;
	if (validated.pronunciation_items !== undefined) updateData.pronunciation_items = validated.pronunciation_items;
	if (validated.student_character_name !== undefined) updateData.student_character_name = validated.student_character_name;
	if (validated.ai_character_names !== undefined) updateData.ai_character_names = validated.ai_character_names;
	if (validated.drill_intro !== undefined) updateData.drill_intro = validated.drill_intro;
	if (validated.roleplay_scenes !== undefined) updateData.roleplay_scenes = validated.roleplay_scenes;
	if (validated.matching_pairs !== undefined) updateData.matching_pairs = validated.matching_pairs;
	if (validated.definition_items !== undefined) updateData.definition_items = validated.definition_items;
	if (validated.grammar_items !== undefined) updateData.grammar_items = validated.grammar_items;
	if (validated.sentence_writing_items !== undefined) updateData.sentence_writing_items = validated.sentence_writing_items;
	if (validated.sentence_drill_word !== undefined) updateData.sentence_drill_word = validated.sentence_drill_word;
	if (validated.sentence_drill_audio_url !== undefined) updateData.sentence_drill_audio_url = validated.sentence_drill_audio_url;
	if (validated.listening_drill_title !== undefined) updateData.listening_drill_title = validated.listening_drill_title;
	if (validated.listening_drill_content !== undefined) updateData.listening_drill_content = validated.listening_drill_content;
	if (validated.listening_drill_audio_url !== undefined) updateData.listening_drill_audio_url = validated.listening_drill_audio_url;
	if (validated.article_title !== undefined) updateData.article_title = validated.article_title;
	if (validated.article_content !== undefined) updateData.article_content = validated.article_content;
	if (validated.article_audio_url !== undefined) updateData.article_audio_url = validated.article_audio_url;
	if (validated.fill_blank_items !== undefined) updateData.fill_blank_items = validated.fill_blank_items;
	if (validated.key_phrase_items !== undefined) updateData.key_phrase_items = validated.key_phrase_items;
	if (validated.learning_journey_part !== undefined) {
		updateData.learning_journey_part = validated.learning_journey_part;
	}
	if (validated.learning_journey_topic !== undefined) {
		updateData.learning_journey_topic = validated.learning_journey_topic;
	}

	const finalType = (validated.type !== undefined ? validated.type : existing.type) as string;
	const mergedTarget =
		validated.target_sentences !== undefined
			? validated.target_sentences
			: (existing as { target_sentences?: unknown[] }).target_sentences;
	const mergedPron =
		validated.pronunciation_items !== undefined
			? validated.pronunciation_items
			: (existing as { pronunciation_items?: unknown[] }).pronunciation_items;

	if (finalType === "vocabulary" && (!mergedTarget || mergedTarget.length < 1)) {
		return apiResponse.validationError(
			"Vocabulary drills require at least one target sentence"
		);
	}
	if (finalType === "pronunciation" && (!mergedPron || mergedPron.length < 1)) {
		return apiResponse.validationError(
			"Pronunciation drills require at least one pronunciation item"
		);
	}
	if (finalType === "vocabulary") {
		updateData.pronunciation_items = [];
	}
	if (finalType === "pronunciation") {
		updateData.target_sentences = [];
	}

	// Update drill
	const result = await drillService.updateDrill(
		drillId,
		context.userId.toString(),
		context.userRole as 'admin' | 'user' | 'tutor',
		updateData
	);

	return apiResponse.success({
		drill: result.drill,
		newAssignmentsCreated: result.newAssignmentsCreated,
		assignmentsCreated: result.assignmentsCreated,
		assignmentsRequested: result.assignmentsRequested,
		failedLearnerIds: result.failedLearnerIds,
	});
}

// DELETE handler
async function deleteHandler(
	req: NextRequest,
	context: { userId: string; userRole: string },
	params: { drillId: string }
) {
	await connectToDatabase();

	const { drillId } = params;

	// Initialize services
	const drillRepo = new DrillRepository();
	const assignmentRepo = new AssignmentRepository();
	const attemptRepo = new AttemptRepository();
	const drillService = new DrillService(drillRepo, assignmentRepo, attemptRepo);

	// Delete drill
	await drillService.deleteDrill(
		drillId,
		context.userId.toString(),
		context.userRole as 'admin' | 'user' | 'tutor'
	);

	return apiResponse.success({ message: "Drill deleted successfully" });
}

// Next.js App Router requires params to be passed differently
export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ drillId: string }> }
) {
	const resolvedParams = await params;
	return withRole(["admin", "user", "tutor"], withErrorHandler((req, context) =>
		getHandler(req, context, resolvedParams)
	))(req);
}

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ drillId: string }> }
) {
	const resolvedParams = await params;
	return withRole(["tutor", "admin"], withErrorHandler((req, context) =>
		putHandler(req, context, resolvedParams)
	))(req);
}

export async function DELETE(
	req: NextRequest,
	{ params }: { params: Promise<{ drillId: string }> }
) {
	const resolvedParams = await params;
	return withRole(["tutor", "admin"], withErrorHandler((req, context) =>
		deleteHandler(req, context, resolvedParams)
	))(req);
}
