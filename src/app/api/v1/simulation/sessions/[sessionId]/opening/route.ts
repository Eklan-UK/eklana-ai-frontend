// POST /api/v1/simulation/sessions/[sessionId]/opening — AI speaks first: generate
// (or replay) the scene's opening line as turn 0, streamed in the same SSE shape
// the /turn route produces.
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import SimulationScenario from '@/models/simulation-scenario';
import SimulationSession from '@/models/simulation-session';
import { generateWithLiveAPIStream } from '@/services/gemini.service';
import { buildSimulationSystemInstruction } from '@/domain/simulation/simulation-live-prompt.service';

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

		if (!session.briefingComplete) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Session briefing has not been started' },
				{ status: 400 },
			);
		}

		const scenario = await SimulationScenario.findById(session.scenarioId);

		if (!scenario) {
			return NextResponse.json(
				{ code: 'NotFound', message: 'Scenario not found' },
				{ status: 404 },
			);
		}

		const elapsedMs = Date.now() - session.startedAt.getTime();
		const maxDurationMs = scenario.maxDurationMinutes * 60_000;

		// Time limit reached — in case a student stalls long enough before ever
		// taking their first turn.
		if (elapsedMs >= maxDurationMs) {
			if (session.status === 'in_progress') {
				session.status = 'completed';
				session.completedAt = new Date();
				await session.save();
			}

			return NextResponse.json(
				{ code: 'Success', data: { sessionComplete: true } },
				{ status: 200 },
			);
		}

		// Idempotent against reloads/retries — if the opening line already exists,
		// stream back the persisted turn 0 instead of regenerating it.
		if (session.turns.length > 0) {
			const existingTurn = session.turns[0];
			const replayStream = new ReadableStream({
				start(controller) {
					const textChunk = JSON.stringify({ type: 'text', data: existingTurn.text });
					controller.enqueue(new TextEncoder().encode(`data: ${textChunk}\n\n`));
					controller.close();
				},
			});

			return new NextResponse(replayStream, {
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					'Connection': 'keep-alive',
				},
			});
		}

		const currentPhase = scenario.scenarioScript[session.currentPhaseIndex];

		if (!currentPhase) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'No active phase for this session' },
				{ status: 400 },
			);
		}

		const systemInstruction =
			buildSimulationSystemInstruction(scenario, currentPhase, scenario.studentCharacterName) +
			'\n\nBegin the scene now with your opening line based on the conversation beats above — do not wait for the student to speak first.';

		// Synthetic kickoff turn needed to elicit a response from the Live API —
		// intentionally never persisted to session.turns.
		const turns = [
			{
				role: 'user',
				parts: [{ text: 'The scene begins now.' }],
			},
		];

		const stream = await generateWithLiveAPIStream(systemInstruction, turns, 'Kore');

		const wrappedStream = new ReadableStream({
			async start(controller) {
				const decoder = new TextDecoder();
				let aiResponseText = '';
				const reader = stream.getReader();

				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						const decoded = decoder.decode(value, { stream: true });
						for (const line of decoded.split('\n\n')) {
							const trimmed = line.trim();
							if (!trimmed.startsWith('data: ')) continue;
							try {
								const parsed = JSON.parse(trimmed.slice('data: '.length));
								if (parsed?.type === 'text' && typeof parsed.data === 'string') {
									aiResponseText += parsed.data;
								}
							} catch {
								/* partial/malformed SSE frame split across chunks — ignore */
							}
						}

						controller.enqueue(value);
					}
				} finally {
					try {
						session.turns.push({
							turnNumber: 0,
							role: 'ai',
							text: aiResponseText,
							audioUrl: '',
							createdAt: new Date(),
						});

						await session.save();
					} catch (persistError: any) {
						logger.error('[SimulationSessionOpening] Failed to persist opening turn after stream drained', {
							error: persistError.message,
							stack: persistError.stack,
							sessionId,
						});
					}

					controller.close();
				}
			},
		});

		return new NextResponse(wrappedStream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
			},
		});
	} catch (error: any) {
		logger.error('[SimulationSessionOpening] POST error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to generate simulation opening line' },
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
