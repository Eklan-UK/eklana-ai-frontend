// GET /api/v1/ai/free-talk/scenarios
// Ordered list of scenario ids (and light metadata) for cycling in the student Free Talk flow.
import { NextRequest, NextResponse } from 'next/server';
import { withPremium } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import FreeTalkScenario from '@/models/free-talk-scenario';
import { logger } from '@/lib/api/logger';
import { freeTalkScenarioLearnerFilter } from '@/lib/free-talk-scenario-assignment';
import { purgeExpiredFreeTalkScenarios } from '@/lib/free-talk-scenario-purge';

async function handler(
	_req: NextRequest,
	context: { userId: import('mongoose').Types.ObjectId; userRole: string },
): Promise<NextResponse> {
	try {
		await connectToDatabase();
		await purgeExpiredFreeTalkScenarios();

		const rows = await FreeTalkScenario.find(freeTalkScenarioLearnerFilter(context.userId))
			.sort({ createdAt: 1 })
			.select({ title: 1, scenarioType: 1, completionDate: 1 })
			.lean()
			.exec();

		if (!rows.length) {
			return NextResponse.json(
				{
					success: false,
					message:
						'No Simulation Room scenarios are available yet. Please ask an administrator to create scenarios in the admin panel.',
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
				completionDate:
					doc.completionDate instanceof Date
						? doc.completionDate.toISOString()
						: doc.completionDate
							? new Date(doc.completionDate as string).toISOString()
							: null,
			})),
		});
	} catch (err: unknown) {
		logger.error('[FreeTalk] scenarios list handler failed', {
			error: err instanceof Error ? err.message : String(err),
		});
		return NextResponse.json(
			{ success: false, message: 'Unable to load Simulation Room scenarios. Please try again later.' },
			{ status: 503 },
		);
	}
}

export const GET = withPremium(handler);
