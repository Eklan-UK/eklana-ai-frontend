import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { logger } from '@/lib/api/logger';
import { generateTopicPracticeGreetingStream } from '@/services/gemini.service';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';

async function handler(
	req: NextRequest,
	context: { userId: any; userRole: string }
): Promise<NextResponse> {
	try {
        const { searchParams } = new URL(req.url);
        const topic = searchParams.get('topic') || 'daily-life';

		await connectToDatabase();
		const user = await User.findById(context.userId).select('firstName name').lean();
		const userName = user?.firstName || user?.name || undefined;

		const stream = await generateTopicPracticeGreetingStream(topic, userName);

		return new NextResponse(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
			},
		});

	} catch (error: any) {
		logger.error('Error generating topic practice greeting', {
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
