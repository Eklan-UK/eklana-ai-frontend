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

// Update drill schema
const updateDrillSchema = z.object({
	title: z.string().min(1).max(200).optional(),
	type: z.enum([
		"vocabulary",
		"roleplay",
		"matching",
		"definition",
		"summary",
		"grammar",
		"sentence_writing",
		"sentence",
		"listening",
		"fill_blank",
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
	student_character_name: z.string().optional(),
	ai_character_names: z.array(z.string()).optional(),
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
	})).optional(),
	grammar_items: z.array(z.object({
		pattern: z.string(),
		hint: z.string().optional(),
		example: z.string(),
	})).optional(),
	sentence_writing_items: z.array(z.object({
		word: z.string(),
		hint: z.string().optional(),
	})).optional(),
	sentence_drill_word: z.string().optional(),
	listening_drill_title: z.string().optional(),
	listening_drill_content: z.string().optional(),
	listening_drill_audio_url: z.string().optional(),
	article_title: z.string().optional(),
	article_content: z.string().optional(),
	article_audio_url: z.string().optional(),
	fill_blank_items: z.array(z.object({
		sentence: z.string().min(1),
		blanks: z.array(z.object({
			position: z.number().int().min(0),
			correctAnswer: z.string().min(1),
			options: z.array(z.string().min(1)).min(2),
			hint: z.string().optional(),
		})).min(1),
		translation: z.string().optional(),
		audioUrl: z.string().optional(),
	})).optional(),
});

// GET handler
async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
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
	context: { userId: Types.ObjectId; userRole: string },
	params: { drillId: string }
) {
	await connectToDatabase();

	const { drillId } = params;
	const body = await parseRequestBody(req);
	const validated = validateRequest(updateDrillSchema, body);

	// Validate assigned_to if provided
	if (validated.assigned_to !== undefined && validated.assigned_to.length === 0) {
		return apiResponse.validationError("At least one user ID must be assigned");
	}

	// Initialize services
	const drillRepo = new DrillRepository();
	const assignmentRepo = new AssignmentRepository();
	const attemptRepo = new AttemptRepository();
	const drillService = new DrillService(drillRepo, assignmentRepo, attemptRepo);

	// Prepare update data
	const updateData: any = {};
	if (validated.title !== undefined) updateData.title = validated.title;
	if (validated.type !== undefined) updateData.type = validated.type;
	if (validated.difficulty !== undefined) updateData.difficulty = validated.difficulty;
	if (validated.date !== undefined) updateData.date = new Date(validated.date);
	if (validated.duration_days !== undefined) updateData.duration_days = validated.duration_days;
	if (validated.assigned_to !== undefined) updateData.assigned_to = validated.assigned_to;
	if (validated.is_active !== undefined) updateData.is_active = validated.is_active;
	if (validated.context !== undefined) updateData.context = validated.context;
	if (validated.audio_example_url !== undefined) updateData.audio_example_url = validated.audio_example_url;
	if (validated.target_sentences !== undefined) updateData.target_sentences = validated.target_sentences;
	if (validated.student_character_name !== undefined) updateData.student_character_name = validated.student_character_name;
	if (validated.ai_character_names !== undefined) updateData.ai_character_names = validated.ai_character_names;
	if (validated.roleplay_scenes !== undefined) updateData.roleplay_scenes = validated.roleplay_scenes;
	if (validated.matching_pairs !== undefined) updateData.matching_pairs = validated.matching_pairs;
	if (validated.definition_items !== undefined) updateData.definition_items = validated.definition_items;
	if (validated.grammar_items !== undefined) updateData.grammar_items = validated.grammar_items;
	if (validated.sentence_writing_items !== undefined) updateData.sentence_writing_items = validated.sentence_writing_items;
	if (validated.sentence_drill_word !== undefined) updateData.sentence_drill_word = validated.sentence_drill_word;
	if (validated.listening_drill_title !== undefined) updateData.listening_drill_title = validated.listening_drill_title;
	if (validated.listening_drill_content !== undefined) updateData.listening_drill_content = validated.listening_drill_content;
	if (validated.listening_drill_audio_url !== undefined) updateData.listening_drill_audio_url = validated.listening_drill_audio_url;
	if (validated.article_title !== undefined) updateData.article_title = validated.article_title;
	if (validated.article_content !== undefined) updateData.article_content = validated.article_content;
	if (validated.article_audio_url !== undefined) updateData.article_audio_url = validated.article_audio_url;

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
	});
}

// DELETE handler
async function deleteHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
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
