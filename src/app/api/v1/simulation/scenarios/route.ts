// GET /api/v1/simulation/scenarios — list a student's assigned Simulation Room
// scenarios, each paired with their most recent session (if any).
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import SimulationScenario from '@/models/simulation-scenario';
import SimulationSession, { ISimulationSession } from '@/models/simulation-session';
import { getTopicName } from '@/config/competency-framework';

async function handler(
	req: NextRequest,
	ctx: { userId: Types.ObjectId; userRole: string },
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const scenarios = await SimulationScenario.find({
			assignedLearnerIds: ctx.userId,
			isActive: true,
		}).sort({ createdAt: -1 });

		const scenarioIds = scenarios.map((scenario) => scenario._id);

		const sessions =
			scenarioIds.length > 0
				? await SimulationSession.find({
						studentId: ctx.userId,
						scenarioId: { $in: scenarioIds },
					}).sort({ createdAt: -1 })
				: [];

		// sessions is sorted newest-first, so the first hit per scenarioId is the latest.
		const latestSessionByScenarioId = new Map<string, ISimulationSession>();
		for (const session of sessions) {
			const key = session.scenarioId.toString();
			if (!latestSessionByScenarioId.has(key)) {
				latestSessionByScenarioId.set(key, session);
			}
		}

		const data = scenarios.map((scenario) => {
			const latestSession = latestSessionByScenarioId.get(scenario._id.toString());
			return {
				scenarioId: scenario._id,
				title: scenario.title,
				workplaceSetting: scenario.workplaceSetting,
				maxDurationMinutes: scenario.maxDurationMinutes,
				topic: getTopicName(scenario.topicId),
				latestSession: latestSession
					? { sessionId: latestSession._id, status: latestSession.status }
					: null,
			};
		});

		return NextResponse.json({ code: 'Success', data: { scenarios: data } }, { status: 200 });
	} catch (error: any) {
		logger.error('[SimulationScenarios] GET error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to fetch simulation scenarios' },
			{ status: 500 },
		);
	}
}

export const GET = withRole(['user'], handler);
