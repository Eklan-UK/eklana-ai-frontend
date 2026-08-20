// GET /api/v1/simulation/sessions/[sessionId] — session + scenario detail for
// the student running a Simulation Room session (header/hint/progress-dot data).
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import SimulationScenario from '@/models/simulation-scenario';
import SimulationSession from '@/models/simulation-session';

async function getHandler(
	req: NextRequest,
	ctx: { userId: Types.ObjectId; userRole: string },
	params: { sessionId: string },
): Promise<NextResponse> {
	try {
		const { sessionId } = params;

		if (!sessionId || !Types.ObjectId.isValid(sessionId)) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Invalid session ID' },
				{ status: 400 },
			);
		}

		await connectToDatabase();

		const session = await SimulationSession.findById(sessionId);

		if (!session) {
			return NextResponse.json(
				{ code: 'NotFound', message: 'Session not found' },
				{ status: 404 },
			);
		}

		if (!session.studentId.equals(ctx.userId)) {
			return NextResponse.json(
				{ code: 'Forbidden', message: 'This is not your session' },
				{ status: 403 },
			);
		}

		// Resuming from a "Leave & Continue Later" pause — push the deadline
		// forward by exactly the time spent away so the timer doesn't keep
		// counting down while the student wasn't in the session.
		if (session.pausedAt) {
			const pauseDurationMs = Date.now() - session.pausedAt.getTime();
			session.startedAt = new Date(session.startedAt.getTime() + pauseDurationMs);
			session.pausedAt = null;
			await session.save();
		}

		const scenario = await SimulationScenario.findById(session.scenarioId);

		if (!scenario) {
			return NextResponse.json(
				{ code: 'NotFound', message: 'Scenario not found' },
				{ status: 404 },
			);
		}

		const turns = [...session.turns]
			.sort((a, b) => a.turnNumber - b.turnNumber)
			.map((turn) => ({
				role: turn.role,
				text: turn.text,
				turnNumber: turn.turnNumber,
			}));

		return NextResponse.json(
			{
				code: 'Success',
				data: {
					sessionId: session._id,
					status: session.status,
					startedAt: session.startedAt,
					currentPhaseIndex: session.currentPhaseIndex,
					briefingComplete: session.briefingComplete,
					turns,
					scenario: {
						workplaceSetting: scenario.workplaceSetting,
						maxDurationMinutes: scenario.maxDurationMinutes,
						background: scenario.background,
						patientInformation: scenario.patientInformation,
						hints: scenario.hints,
						phases: scenario.scenarioScript.map(
							(phase: {
								phaseTitle: string;
								situation: string;
								clinicalInformation: string;
								characters: string[];
							}) => ({
								phaseTitle: phase.phaseTitle,
								situation: phase.situation,
								clinicalInformation: phase.clinicalInformation,
								characters: phase.characters,
							}),
						),
					},
				},
			},
			{ status: 200 },
		);
	} catch (error: any) {
		logger.error('[SimulationSessionDetail] GET error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to fetch simulation session' },
			{ status: 500 },
		);
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ sessionId: string }> },
) {
	const resolvedParams = await params;
	return withRole(['user'], (req, context) =>
		getHandler(req, context, resolvedParams),
	)(req);
}
