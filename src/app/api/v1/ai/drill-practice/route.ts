// POST /api/v1/ai/drill-practice
// Handle drill-aware AI conversation messages
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { generateDrillPracticeResponse } from '@/services/gemini.service';
import { logger } from '@/lib/api/logger';
import { connectToDatabase } from '@/lib/api/db';
import DrillModel from '@/models/drill';
import DrillAssignment from '@/models/drill-assignment';

async function handler(
	req: NextRequest,
	context: { userId: any; userRole: string }
): Promise<NextResponse> {
	try {
		const body = await req.json();
		const { drillId, userMessage, conversationHistory, temperature } = body;

		if (!drillId || !userMessage) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'drillId and userMessage are required',
				},
				{ status: 400 }
			);
		}

		await connectToDatabase();

		// Verify user has an assignment for this drill
		const assignment = await DrillAssignment.findOne({
			learnerId: context.userId,
			drillId: drillId,
		}).lean();

		if (!assignment) {
			return NextResponse.json(
				{
					code: 'NotFound',
					message: 'Drill not found in your assignments',
				},
				{ status: 404 }
			);
		}

		// Fetch full drill data
		const drill = await DrillModel.findById(drillId).lean();
		if (!drill) {
			return NextResponse.json(
				{
					code: 'NotFound',
					message: 'Drill data not available',
				},
				{ status: 404 }
			);
		}

		// Build drill data
		const drillData = {
			type: drill.type,
			title: drill.title,
			difficulty: drill.difficulty || 'intermediate',
			context: drill.context,
			target_sentences: drill.target_sentences,
			roleplay_scenes: drill.roleplay_scenes,
			roleplay_dialogue: drill.roleplay_dialogue,
			student_character_name: drill.student_character_name,
			ai_character_names: drill.ai_character_names,
			matching_pairs: drill.matching_pairs,
			definition_items: drill.definition_items,
			grammar_items: drill.grammar_items,
			sentence_writing_items: drill.sentence_writing_items,
			fill_blank_items: drill.fill_blank_items,
			article_title: drill.article_title,
			article_content: drill.article_content,
			listening_drill_title: drill.listening_drill_title,
			listening_drill_content: drill.listening_drill_content,
			sentence_drill_word: drill.sentence_drill_word,
		};

		const result = await generateDrillPracticeResponse({
			drill: drillData,
			userMessage,
			conversationHistory: conversationHistory || [],
			temperature,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Drill practice response generated',
				data: {
					response: result.text,
					audioBase64: result.audioBase64,
					audioMimeType: result.audioMimeType,
					drillType: drill.type,
					drillTitle: drill.title,
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error in drill practice handler', {
			error: error.message,
			stack: error.stack,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message?.includes('429') || error.message?.includes('quota')
					? 'AI service is temporarily busy. Please wait a moment and try again.'
					: 'Failed to generate practice response. Please try again.',
			},
			{ status: 500 }
		);
	}
}

export const POST = withAuth(handler);

// Allow up to 60 seconds for Live API audio generation
export const maxDuration = 60;


