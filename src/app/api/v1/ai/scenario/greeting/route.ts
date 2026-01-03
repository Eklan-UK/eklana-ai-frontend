// GET /api/v1/ai/scenario/greeting
// Get scenario greeting
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { generateScenarioGreeting } from '@/services/gemini.service';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';

async function handler(
	req: NextRequest,
	context: { userId: any; userRole: string }
): Promise<NextResponse> {
	try {
		const { searchParams } = new URL(req.url);
		const scenario = searchParams.get('scenario');

		if (!scenario) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Scenario query parameter is required',
				},
				{ status: 400 }
			);
		}

		// Validate scenario
		const validScenarios = ['Job Interview', 'Restaurant Order', 'Shopping', 'Travel'];
		if (!validScenarios.includes(scenario)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: `Invalid scenario. Must be one of: ${validScenarios.join(', ')}`,
				},
				{ status: 400 }
			);
		}

		// Generate greeting
		const greeting = await generateScenarioGreeting(scenario);

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Scenario greeting generated',
				data: {
					greeting,
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error in scenario greeting handler', {
			error: error.message,
			stack: error.stack,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to generate scenario greeting',
			},
			{ status: 500 }
		);
	}
}

export const GET = withAuth(handler);

