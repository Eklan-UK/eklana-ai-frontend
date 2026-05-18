// GET /api/v1/ai/free-talk/greeting
// Returns a scenario as plain JSON from admin-configured MongoDB documents.
// Optional query: scenarioId — load that document; omitted — random pick (legacy / mobile).
import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { withPremium } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import FreeTalkScenario from '@/models/free-talk-scenario';
import { logger } from '@/lib/api/logger';
import { normalizeFreeTalkScenarioStringList } from '@/lib/free-talk-scenario-lists';

function scenarioPayload(dbScenario: {
	_id: Types.ObjectId;
	title: string;
	background: string;
	task: string;
	hint?: string;
	usefulPhrases?: unknown;
	scenarioType: string;
	include?: unknown;
}) {
	const situation = [dbScenario.background, dbScenario.task].filter(Boolean).join('\n\n');
	const hint = dbScenario.hint || dbScenario.task || '';
	return {
		id: String(dbScenario._id),
		title: dbScenario.title,
		situation,
		hint,
		usefulPhrases: normalizeFreeTalkScenarioStringList(dbScenario.usefulPhrases),
		scenarioType: dbScenario.scenarioType,
		background: dbScenario.background,
		task: dbScenario.task,
		include: normalizeFreeTalkScenarioStringList(dbScenario.include),
	};
}

async function handler(req: NextRequest): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const scenarioId = req.nextUrl.searchParams.get('scenarioId')?.trim();

		let dbScenario: {
			_id: Types.ObjectId;
			title: string;
			background: string;
			task: string;
			hint?: string;
			usefulPhrases?: unknown;
			scenarioType: string;
			include?: unknown;
		} | null = null;

		if (scenarioId) {
			if (!Types.ObjectId.isValid(scenarioId)) {
				return NextResponse.json({ success: false, message: 'Invalid scenario id.' }, { status: 400 });
			}
			dbScenario = await FreeTalkScenario.findById(scenarioId).lean().exec();
		} else {
			const [picked] = await FreeTalkScenario.aggregate([{ $sample: { size: 1 } }]);
			dbScenario = picked ?? null;
		}

		if (!dbScenario) {
			return NextResponse.json(
				{
					success: false,
					message:
						'No free talk scenarios are available yet. Please ask an administrator to create scenarios in the admin panel.',
				},
				{ status: 404 },
			);
		}

		return NextResponse.json({
			success: true,
			scenario: scenarioPayload(dbScenario),
		});
	} catch (err: unknown) {
		logger.error('[FreeTalk] greeting handler failed', {
			error: err instanceof Error ? err.message : String(err),
		});
		return NextResponse.json(
			{ success: false, message: 'Unable to load a free talk scenario. Please try again later.' },
			{ status: 503 },
		);
	}
}

export const GET = withPremium(handler);
