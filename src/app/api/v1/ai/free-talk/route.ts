// POST /api/v1/ai/free-talk
// Receives the student's single response, grades it against the scenario rubric,
// and streams narrative feedback + a metadata chunk with the structured grade.
import { NextRequest, NextResponse } from 'next/server';
import { withPremium } from '@/lib/api/middleware';
import { logger } from '@/lib/api/logger';
import {
	generateFreeTalkGradingStream,
	generateFreeTalkGradingStreamFromScenario,
	type FreeTalkScenario,
} from '@/services/gemini.service';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import FreeTalkScenarioModel from '@/models/free-talk-scenario';

async function handler(
	req: NextRequest,
	context: { userId: any; userRole: string },
): Promise<NextResponse> {
	try {
		const body = await req.json();
		const { userResponse, scenarioTitle } = body as {
			userResponse?: string;
			scenarioTitle?: string;
		};

		if (!userResponse || typeof userResponse !== 'string' || !userResponse.trim()) {
			return NextResponse.json(
				{ success: false, message: 'userResponse is required' },
				{ status: 400 },
			);
		}

		if (!scenarioTitle || typeof scenarioTitle !== 'string' || !scenarioTitle.trim()) {
			return NextResponse.json(
				{ success: false, message: 'scenarioTitle is required' },
				{ status: 400 },
			);
		}

		await connectToDatabase();
		const user = await User.findById(context.userId).select('firstName').lean();
		const userName = (user?.firstName as string | undefined) || undefined;

		// Try to resolve scenario from the DB first; fall back to hardcoded list.
		let stream: ReadableStream;
		const dbScenario = await FreeTalkScenarioModel.findOne({
			title: { $regex: new RegExp(`^${scenarioTitle.trim()}$`, 'i') },
		}).lean();

		if (dbScenario) {
			const situation = [dbScenario.background, dbScenario.task].filter(Boolean).join('\n\n');
			const hint = dbScenario.hint || dbScenario.task || '';
			const scenarioObj: FreeTalkScenario = {
				title: dbScenario.title,
				situation,
				hint,
				usefulPhrases: dbScenario.usefulPhrases ?? [],
				scenarioType: dbScenario.scenarioType as FreeTalkScenario['scenarioType'],
			};
			stream = await generateFreeTalkGradingStreamFromScenario(userResponse.trim(), scenarioObj, userName);
		} else {
			stream = await generateFreeTalkGradingStream(userResponse.trim(), scenarioTitle.trim(), userName);
		}

		return new NextResponse(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
			},
		});
	} catch (error: any) {
		logger.error('[FreeTalk] Error in grading handler', {
			error: error?.message,
			stack: error?.stack,
		});
		return NextResponse.json(
			{
				success: false,
				message:
					error?.message?.includes('429') || error?.message?.includes('quota')
						? 'AI service is temporarily busy. Please wait a moment and try again.'
						: 'Failed to grade Free Talk response. Please try again.',
			},
			{ status: 500 },
		);
	}
}

export const POST = withPremium(handler);

export const maxDuration = 300;
