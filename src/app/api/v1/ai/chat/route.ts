// POST /api/v1/ai/chat — streaming text conversation (SSE)
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { generateConversationResponseStream } from '@/services/gemini.service';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';

const chatSchema = z.object({
	messages: z
		.array(
			z.object({
				role: z.enum(['user', 'model']),
				content: z.string().min(1),
			})
		)
		.min(1),
	temperature: z.number().min(0).max(2).optional(),
	maxTokens: z.number().int().min(1).max(4000).optional(),
});

async function handler(
	req: NextRequest,
	context: { userId: unknown; userRole: string }
): Promise<NextResponse> {
	void context.userId;
	void context.userRole;
	try {
		const body = await req.json();
		const validated = chatSchema.parse(body);

		const lastMessage = validated.messages[validated.messages.length - 1];
		if (lastMessage.role !== 'user') {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Last message must be from user',
				},
				{ status: 400 }
			);
		}

		const stream = await generateConversationResponseStream({
			messages: validated.messages,
			temperature: validated.temperature,
			maxTokens: validated.maxTokens,
		});

		return new NextResponse(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			},
		});
	} catch (error: unknown) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Validation failed',
					errors: error.issues,
				},
				{ status: 400 }
			);
		}

		const err = error as { message?: string; stack?: string };
		logger.error('Error in AI chat stream handler', {
			error: err.message,
			stack: err.stack,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message:
					err.message?.includes('429') || err.message?.includes('quota')
						? 'AI service is temporarily busy. Please wait a moment and try again.'
						: 'Failed to generate response. Please try again.',
			},
			{ status: 500 }
		);
	}
}

export const POST = withAuth(handler);
