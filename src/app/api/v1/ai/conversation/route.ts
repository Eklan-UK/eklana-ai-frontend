// POST /api/v1/ai/conversation
// Handle AI conversation
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { generateConversationResponse } from '@/services/gemini.service';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';

const conversationSchema = z.object({
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
	context: { userId: any; userRole: string }
): Promise<NextResponse> {
	try {
		const body = await req.json();
		const validated = conversationSchema.parse(body);

		// Ensure last message is from user
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

		// Generate AI response
		const response = await generateConversationResponse({
			messages: validated.messages,
			temperature: validated.temperature,
			maxTokens: validated.maxTokens,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Conversation response generated',
				data: {
					response,
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
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

		logger.error('Error in conversation handler', {
			error: error.message,
			stack: error.stack,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message?.includes('429') || error.message?.includes('quota')
					? 'AI service is temporarily busy. Please wait a moment and try again.'
					: 'Failed to generate response. Please try again.',
			},
			{ status: 500 }
		);
	}
}

export const POST = withAuth(handler);

