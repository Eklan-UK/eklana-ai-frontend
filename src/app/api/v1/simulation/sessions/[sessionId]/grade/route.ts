// POST /api/v1/simulation/sessions/[sessionId]/grade — runs SpeechAce scoring
// for every student turn in a completed session, in parallel. Kept as its own
// route (rather than inline in turn-taking) so the per-turn Speechace latency
// doesn't sit on the live-conversation critical path.
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120; // generous for N parallel Speechace calls, not 300×N

import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import SimulationSession, { ISimulationSession } from '@/models/simulation-session';
import { speechaceService } from '@/lib/api/speechace.service';

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

		if (session.status !== 'completed') {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Session must be completed before grading' },
				{ status: 400 },
			);
		}

		const gradableTurns = session.turns.filter(
			(turn: ISimulationSession['turns'][number]) => turn.role === 'student' && !!turn.audioUrl,
		);

		const results = await Promise.all(
			gradableTurns.map(async (turn: ISimulationSession['turns'][number]) => {
				try {
					const audioResponse = await fetch(turn.audioUrl);
					if (!audioResponse.ok) {
						throw new Error(`Failed to download turn audio: ${audioResponse.status} ${audioResponse.statusText}`);
					}
					const audioArrayBuffer = await audioResponse.arrayBuffer();
					const audioBuffer = Buffer.from(audioArrayBuffer);

					const speechaceResult = await speechaceService.scorePronunciation(
						turn.text,
						audioBuffer,
						ctx.userId.toString(),
					);

					return { turnNumber: turn.turnNumber, speechaceResult };
				} catch (error: any) {
					logger.warn('[SimulationSessionGrade] Failed to score turn', {
						error: error.message,
						sessionId,
						turnNumber: turn.turnNumber,
					});
					return { turnNumber: turn.turnNumber, speechaceResult: null };
				}
			}),
		);

		const resultsByTurnNumber = new Map(results.map((r) => [r.turnNumber, r.speechaceResult]));
		for (const turn of session.turns) {
			if (resultsByTurnNumber.has(turn.turnNumber)) {
				turn.speechaceResult = resultsByTurnNumber.get(turn.turnNumber);
			}
		}

		await session.save();

		const failedTurnCount = results.filter((r) => r.speechaceResult === null).length;

		return NextResponse.json(
			{
				code: 'Success',
				data: {
					gradedTurnCount: results.length - failedTurnCount,
					failedTurnCount,
				},
			},
			{ status: 200 },
		);
	} catch (error: any) {
		logger.error('[SimulationSessionGrade] POST error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to grade simulation session' },
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
