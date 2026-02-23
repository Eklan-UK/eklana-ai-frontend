// GET /api/v1/ai/drill-practice/greeting
// Generate a contextual greeting for drill-aware conversation
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { generateDrillPracticeGreeting } from '@/services/gemini.service';
import { logger } from '@/lib/api/logger';
import { connectToDatabase } from '@/lib/api/db';
import DrillModel from '@/models/drill';
import DrillAssignment from '@/models/drill-assignment';

async function handler(
	req: NextRequest,
	context: { userId: any; userRole: string }
): Promise<NextResponse> {
	try {
		const { searchParams } = new URL(req.url);
		const drillId = searchParams.get('drillId');

		if (!drillId) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'drillId query parameter is required',
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

		// Build drill data for greeting
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

		const greetingResult = await generateDrillPracticeGreeting(drillData);

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Drill practice greeting generated',
				data: {
					greeting: greetingResult.text,
					audioBase64: greetingResult.audioBase64,
					audioMimeType: greetingResult.audioMimeType,
					drillType: drill.type,
					drillTitle: drill.title,
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error generating drill practice greeting', {
			error: error.message,
			stack: error.stack,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message?.includes('429') || error.message?.includes('quota')
					? 'AI service is temporarily busy. Please wait a moment and try again.'
					: 'Failed to start practice session. Please try again.',
			},
			{ status: 500 }
		);
	}
}

export const GET = withAuth(handler);

// Allow up to 60 seconds for greeting text + native audio generation
export const maxDuration = 60;

