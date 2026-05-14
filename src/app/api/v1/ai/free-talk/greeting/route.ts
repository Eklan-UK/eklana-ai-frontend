// GET /api/v1/ai/free-talk/greeting
// Picks the next ICU scenario, streams the situation text + audio, and ends
// with a metadata chunk containing scenarioTitle, hint, and usefulPhrases.
import { NextRequest, NextResponse } from 'next/server';
import { withPremium } from '@/lib/api/middleware';
import { logger } from '@/lib/api/logger';
import { generateFreeTalkGreetingStream } from '@/services/gemini.service';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';

async function handler(
	req: NextRequest,
	context: { userId: any; userRole: string },
): Promise<NextResponse> {
	void req;
	try {
		await connectToDatabase();
		const user = await User.findById(context.userId).select('firstName').lean();
		const userName = (user?.firstName as string | undefined) || undefined;

		const stream = await generateFreeTalkGreetingStream(userName);

		return new NextResponse(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
			},
		});
	} catch (error: any) {
		logger.error('[FreeTalk] Error generating greeting', {
			error: error?.message,
			stack: error?.stack,
		});
		return NextResponse.json(
			{
				success: false,
				message:
					error?.message?.includes('429') || error?.message?.includes('quota')
						? 'AI service is temporarily busy. Please wait a moment and try again.'
						: 'Failed to start Free Talk session. Please try again.',
			},
			{ status: 500 },
		);
	}
}

export const GET = withPremium(handler);

export const maxDuration = 300;
