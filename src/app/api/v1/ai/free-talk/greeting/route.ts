// GET /api/v1/ai/free-talk/greeting
// Returns a scenario as plain JSON — DB first (random), fallback to hardcoded round-robin.
import { NextRequest, NextResponse } from 'next/server';
import { withPremium } from '@/lib/api/middleware';
import { pickNextFreeTalkScenario } from '@/services/gemini.service';
import { connectToDatabase } from '@/lib/api/db';
import FreeTalkScenario from '@/models/free-talk-scenario';

async function handler(req: NextRequest): Promise<NextResponse> {
	void req;

	try {
		await connectToDatabase();

		// Pick a random scenario from the database
		const [dbScenario] = await FreeTalkScenario.aggregate([{ $sample: { size: 1 } }]);

		if (dbScenario) {
			// Map DB shape → FreeTalkScenario shape expected by the student page.
			// `situation` is background + newline + task so the grading prompt has full context.
			const situation = [dbScenario.background, dbScenario.task].filter(Boolean).join('\n\n');
			const hint = dbScenario.hint || dbScenario.task || '';

			return NextResponse.json({
				success: true,
				scenario: {
					title: dbScenario.title,
					situation,
					hint,
					usefulPhrases: dbScenario.usefulPhrases ?? [],
					scenarioType: dbScenario.scenarioType,
					// Extra fields the student page can optionally use
					background: dbScenario.background,
					task: dbScenario.task,
					include: dbScenario.include ?? [],
				},
			});
		}
	} catch {
		// Fall through to hardcoded on any DB error
	}

	// Fallback: hardcoded round-robin
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
