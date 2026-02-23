// POST /api/v1/ai/scenario
// Handle scenario-based conversation
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { generateScenarioResponse } from '@/services/gemini.service';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';

const scenarioSchema = z.object({
	scenario: z.enum(['Job Interview', 'Restaurant Order', 'Shopping', 'Travel']),
	userMessage: z.string().min(1),
	conversationHistory: z
		.array(
			z.object({
				role: z.enum(['user', 'model']),
				content: z.string(),
			})
		)
		.optional(),
	temperature: z.number().min(0).max(2).optional(),
});

async function handler(
	req: NextRequest,
	context: { userId: any; userRole: string }
): Promise<NextResponse> {
	try {
		const body = await req.json();
		const validated = scenarioSchema.parse(body);

		// Generate scenario response
		const response = await generateScenarioResponse({
			scenario: validated.scenario,
			userMessage: validated.userMessage,
			conversationHistory: validated.conversationHistory || [],
			temperature: validated.temperature,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Scenario response generated',
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

		logger.error('Error in scenario handler', {
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

