// GET /api/v1/ai/free-talk/scenarios
// Ordered list of scenario ids (and light metadata) for cycling in the student Free Talk flow.
import { NextRequest, NextResponse } from 'next/server';
import { withPremium } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import FreeTalkScenario from '@/models/free-talk-scenario';
import { logger } from '@/lib/api/logger';

async function handler(_req: NextRequest): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const rows = await FreeTalkScenario.find()
			.sort({ createdAt: 1 })
			.select({ title: 1, scenarioType: 1 })
			.lean()
			.exec();

		if (!rows.length) {
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
			scenarios: rows.map((doc) => ({
				id: String(doc._id),
				title: doc.title,
				scenarioType: doc.scenarioType,
			})),
		});
	} catch (err: unknown) {
		logger.error('[FreeTalk] scenarios list handler failed', {
			error: err instanceof Error ? err.message : String(err),
		});
		return NextResponse.json(
			{ success: false, message: 'Unable to load free talk scenarios. Please try again later.' },
			{ status: 503 },
		);
	}
}

export const GET = withPremium(handler);
