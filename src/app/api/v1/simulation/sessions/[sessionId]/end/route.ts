// POST /api/v1/simulation/sessions/[sessionId]/end — student-initiated early end of a Simulation Room session
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120; // grading runs inline here now — same budget as /grade

import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import SimulationSession from '@/models/simulation-session';
import { gradeSimulationSession } from '@/domain/simulation/simulation-grading.service';

async function postHandler(
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

		if (session.status !== 'in_progress') {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Session is not in progress' },
				{ status: 400 },
			);
		}

		session.status = 'completed';
		session.completedAt = new Date();
		await session.save();

		// Best-effort — a grading failure (e.g. an LLM call errors out) must not
		// fail this request. The session is already marked completed above;
		// overallGradeResult is simply left unset, same as any other partial
		// sub-result failure inside gradeSimulationSession itself. The student
		// can still retry via the "See my grades" button (POST .../grade).
		try {
			await gradeSimulationSession(sessionId);
		} catch (gradingError: any) {
			logger.warn('[SimulationSessionEnd] Auto-grading failed after session end', {
				error: gradingError.message,
				sessionId,
			});
		}

		return NextResponse.json(
			{ code: 'Success', data: { sessionComplete: true } },
			{ status: 200 },
		);
	} catch (error: any) {
		logger.error('[SimulationSessionEnd] POST error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to end simulation session' },
			{ status: 500 },
		);
	}
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ sessionId: string }> },
) {
	const resolvedParams = await params;
	return withRole(['user'], (req, context) =>
		postHandler(req, context, resolvedParams),
	)(req);
}
