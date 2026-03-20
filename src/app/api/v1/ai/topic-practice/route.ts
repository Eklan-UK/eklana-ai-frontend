import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { logger } from '@/lib/api/logger';
import { generateTopicPracticeResponseStream } from '@/services/gemini.service';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';

async function handler(
	req: NextRequest,
	context: { userId: any; userRole: string }
): Promise<NextResponse> {
	try {
        const body = await req.json();
        const { topic, userMessage, conversationHistory } = body;

		if (!userMessage) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'userMessage is required' },
				{ status: 400 }
			);
		}

		await connectToDatabase();
		const user = await User.findById(context.userId).select('firstName').lean();
		const userName = (user?.firstName as string | undefined) || undefined;

		const stream = await generateTopicPracticeResponseStream(
            userMessage,
            conversationHistory || [],
            topic || 'daily-life',
            userName
        );

		return new NextResponse(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
			},
		});
	} catch (error: any) {
		logger.error('Error in topic practice handler', {
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
