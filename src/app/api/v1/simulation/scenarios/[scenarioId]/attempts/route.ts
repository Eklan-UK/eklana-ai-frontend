// GET /api/v1/simulation/scenarios/[scenarioId]/attempts — every completed
// session the authenticated student has run against this scenario, oldest
// first (so attempt numbering on the client is stable/chronological).
// In-progress and abandoned/paused sessions are excluded — only finished
// attempts, which reliably carry grading feedback now that /end auto-grades.
// Summary only — no turns array, that belongs to session detail
// (GET .../sessions/[sessionId]).
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import SimulationSession, { ISimulationSession } from '@/models/simulation-session';

async function handler(
	req: NextRequest,
	ctx: { userId: Types.ObjectId; userRole: string },
	params: { scenarioId: string },
): Promise<NextResponse> {
	try {
		const { scenarioId } = params;

		if (!scenarioId || !Types.ObjectId.isValid(scenarioId)) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Invalid scenario ID' },
				{ status: 400 },
			);
		}

		await connectToDatabase();

		const sessions = await SimulationSession.find({
			scenarioId,
			studentId: ctx.userId,
			status: 'completed',
		})
			.sort({ startedAt: 1 })
			.select('status startedAt completedAt overallGradeResult');

		const attempts = sessions.map((session: ISimulationSession) => ({
			sessionId: session._id,
			status: session.status,
			// A completed session's meaningful "when" is when it wrapped up, not
			// when the timer started — fall back to startedAt for sessions still
			// in progress or abandoned mid-way with no completedAt set.
			attemptedAt: session.completedAt ?? session.startedAt,
			overallGradeResult: session.overallGradeResult ?? null,
		}));

		return NextResponse.json({ code: 'Success', data: { attempts } }, { status: 200 });
	} catch (error: any) {
		logger.error('[SimulationScenarioAttempts] GET error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to fetch scenario attempts' },
			{ status: 500 },
		);
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ scenarioId: string }> },
) {
	const resolvedParams = await params;
	return withRole(['user'], (req, context) =>
		handler(req, context, resolvedParams),
	)(req);
}
