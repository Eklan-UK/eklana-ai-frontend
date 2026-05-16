// GET /api/v1/ai/free-talk/greeting
// Returns the next scenario data (round-robin) as plain JSON — no Live API call.
import { NextRequest, NextResponse } from 'next/server';
import { withPremium } from '@/lib/api/middleware';
import { pickNextFreeTalkScenario } from '@/services/gemini.service';

async function handler(req: NextRequest): Promise<NextResponse> {
	void req;
	const scenario = pickNextFreeTalkScenario();
	return NextResponse.json({
		success: true,
		scenario: {
			title: scenario.title,
			situation: scenario.situation,
			hint: scenario.hint,
			usefulPhrases: scenario.usefulPhrases,
			scenarioType: scenario.scenarioType,
		},
	});
}

export const GET = withPremium(handler);
