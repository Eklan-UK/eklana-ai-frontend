// POST /api/v1/ai/drill-practice/voice
// Voice drill practice: use Gemini Live built-in transcription + audio streaming.
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { logger } from '@/lib/api/logger';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import DrillModel from '@/models/drill';
import DrillAssignment from '@/models/drill-assignment';
import { generateDrillPracticeVoiceResponseStream } from '@/services/gemini.service';

async function handler(
	req: NextRequest,
	context: { userId: any; userRole: string }
): Promise<NextResponse> {
	try {
		const formData = await req.formData();
		const drillId = formData.get('drillId') as string | null;
		const conversationHistoryRaw = formData.get('conversationHistory') as string | null;
		const audioFile = formData.get('audio') as File | null;

		if (!drillId || !audioFile) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'drillId and audio file are required',
				},
				{ status: 400 }
			);
		}

		let conversationHistory: Array<{ role: 'user' | 'model'; content: string }> = [];
		try {
			conversationHistory = JSON.parse(conversationHistoryRaw || '[]');
		} catch {
			conversationHistory = [];
		}

		await connectToDatabase();

		const user = await User.findById(context.userId).select('firstName').lean();
		const userName = (user?.firstName as string | undefined) || undefined;

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

		const arrayBuffer = await audioFile.arrayBuffer();
		const audioBuffer = Buffer.from(arrayBuffer);
		const mimeType = audioFile.type || 'audio/m4a';

		const stream = await generateDrillPracticeVoiceResponseStream({
			drill: drillData,
			audioBuffer,
			conversationHistory,
			mimeType,
			userName,
			userId:  String(context.userId),  // enables session reuse
			drillId: drillId,
		});

		return new NextResponse(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
			},
		});
	} catch (error: any) {
		logger.error('Error in drill voice handler', {
			error: error?.message,
			stack: error?.stack,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message:
					error?.message?.includes('429') || error?.message?.includes('quota')
						? 'AI service is temporarily busy. Please wait a moment and try again.'
						: 'Failed to generate drill voice response. Please try again.',
			},
			{ status: 500 }
		);
	}
}

export const POST = withAuth(handler);

// Allow enough time for native audio generation.
export const maxDuration = 60;

