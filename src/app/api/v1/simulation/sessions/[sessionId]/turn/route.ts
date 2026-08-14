// POST /api/v1/simulation/sessions/[sessionId]/turn — core Simulation Room turn:
// transcribe the student's audio, run one live-conversation turn, and check for
// newly-revealed findings, all in a single request.
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import SimulationScenario from '@/models/simulation-scenario';
import SimulationSession, { ISimulationSession } from '@/models/simulation-session';
import { transcribeAudio, generateWithLiveAPIStream } from '@/services/gemini.service';
import { checkFindingReveals } from '@/domain/simulation/simulation-turn-reveal.service';
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

		const formData = await req.formData();
		const audio = formData.get('audio');

		if (!audio) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'No audio provided' },
				{ status: 400 },
			);
		}

		// Convert FormData audio field to File/Blob — mirrors the narrowing pattern
		// used for slide-deck uploads in admin/simulation/scenarios/route.ts.
		let audioToProcess: File | Blob;
		let audioMimeType: string;
		let audioSize: number;

		if (typeof audio === 'string') {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Invalid audio format. Expected File object.' },
				{ status: 400 },
			);
		}

		if (audio instanceof File) {
			audioToProcess = audio;
			audioMimeType = audio.type || 'audio/webm';
			audioSize = audio.size;
		} else {
			const blobLike = audio as any;
			if (
				blobLike &&
				typeof blobLike.size === 'number' &&
				typeof blobLike.arrayBuffer === 'function'
			) {
				audioToProcess = blobLike as Blob;
				audioMimeType = blobLike.type || 'audio/webm';
				audioSize = blobLike.size;
			} else {
				return NextResponse.json(
					{ code: 'ValidationError', message: 'Invalid audio format. Expected File or Blob.' },
					{ status: 400 },
				);
			}
		}

		const maxSize = 10 * 1024 * 1024;
		if (audioSize > maxSize) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'File size exceeds 10MB limit' },
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

		const currentPhase = scenario.scenarioScript[session.currentPhaseIndex];

		// All phases complete — natural session-end signal. Full end-of-session
		// grading/completion logic is out of scope for this endpoint.
		if (!currentPhase) {
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

		const arrayBuffer = await audioToProcess.arrayBuffer();
		const audioBuffer = Buffer.from(arrayBuffer);
		const transcribedText = await transcribeAudio(audioBuffer, audioMimeType);

		// Build conversation history for the Live API — mirrors the leading-role
		// trim logic in generateTopicPracticeResponseStream (gemini.service.ts)
		// so a stray leading 'model' turn never opens the history.
		let validHistory: Array<{ role: 'user' | 'model'; text: string }> = session.turns.map(
			(turn: ISimulationSession['turns'][number]) => ({
				role: turn.role === 'student' ? ('user' as const) : ('model' as const),
				text: turn.text,
			}),
		);
		if (validHistory.length > 0 && validHistory[0].role === 'model') {
			const firstUserIndex = validHistory.findIndex((msg) => msg.role === 'user');
			if (firstUserIndex > 0) {
				validHistory = validHistory.slice(firstUserIndex);
			} else if (firstUserIndex === -1) {
				validHistory = [];
			}
		}

		const history = validHistory.map((msg) => ({
			role: msg.role,
			parts: [{ text: msg.text }],
		}));

		const turns = [
			...history,
			{
				role: 'user',
				parts: [{ text: transcribedText }],
			},
		];

		const systemInstruction = buildSimulationSystemInstruction(scenario, currentPhase);

		const revealedLabelsForPhase = new Set(
			session.revealedFindings
				.filter(
					(finding: ISimulationSession['revealedFindings'][number]) =>
						finding.phaseIndex === session.currentPhaseIndex,
				)
				.map((finding: ISimulationSession['revealedFindings'][number]) => finding.label),
		);
		const unrevealedFindings = currentPhase.gatedFindings.filter(
			(finding: { label: string; revealCondition: string }) =>
				!revealedLabelsForPhase.has(finding.label),
		);

		let phaseAdvanced = false;
		const onToolCall = (name: string) => {
			if (name === 'advancePhase') {
				phaseAdvanced = true;
			}
		};

		// generateWithLiveAPIStream resolves with the ReadableStream almost
		// immediately (its `start()` callback opens the WebSocket and runs in
		// the background) — it does NOT wait for the Live API session to
		// finish. `phaseAdvanced` is therefore read only after the stream is
		// fully drained (see the wrappedStream `finally` block below), by
		// which point any advancePhase tool call has had a chance to fire.
		const [stream, revealResult] = await Promise.all([
			generateWithLiveAPIStream(
				systemInstruction,
				turns,
				'Kore',
				[
					{
						name: 'advancePhase',
						description:
							"Call this when the current phase's trigger condition has been clearly and fully satisfied by the conversation so far.",
						parameters: { type: 'object', properties: {} },
					},
				],
				onToolCall,
			),
			unrevealedFindings.length > 0
				? checkFindingReveals(transcribedText, unrevealedFindings)
				: Promise.resolve({ revealedLabels: [] as string[] }),
		]);

		const newlyRevealedLabels = revealResult.revealedLabels.filter(
			(label) => !revealedLabelsForPhase.has(label),
		);

		const revealFindings = newlyRevealedLabels.map((label) => ({
			label,
			data:
				currentPhase.gatedFindings.find(
					(finding: { label: string; data: string }) => finding.label === label,
				)?.data ?? '',
		}));

		// Turn persistence (student turn, AI turn, revealedFindings,
		// currentPhaseIndex) is deliberately deferred until AFTER the Live API
		// stream is fully drained below — see the two KNOWN LIMITATION notes this
		// replaced. Draining first lets us (a) accumulate the AI's actual spoken
		// text from the streamed `outputTranscription` chunks instead of writing
		// an empty string, and (b) observe whether `advancePhase` was actually
		// called by the time the session closes, instead of checking a flag that
		// hadn't had a chance to flip yet.
		const wrappedStream = new ReadableStream({
			async start(controller) {
				if (revealFindings.length > 0) {
					const revealChunk = JSON.stringify({ type: 'reveal', findings: revealFindings });
					controller.enqueue(new TextEncoder().encode(`data: ${revealChunk}\n\n`));
				}

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
						const nextTurnNumber = session.turns.length;
						session.turns.push({
							turnNumber: nextTurnNumber,
							role: 'student',
							text: transcribedText,
							audioUrl: '',
							createdAt: new Date(),
						});
						session.turns.push({
							turnNumber: nextTurnNumber + 1,
							role: 'ai',
							text: aiResponseText,
							audioUrl: '',
							createdAt: new Date(),
						});

						const now = new Date();
						for (const label of newlyRevealedLabels) {
							session.revealedFindings.push({
								phaseIndex: session.currentPhaseIndex,
								label,
								revealedAt: now,
							});
						}

						if (phaseAdvanced) {
							session.currentPhaseIndex += 1;
						}

						await session.save();
					} catch (persistError: any) {
						logger.error('[SimulationSessionTurn] Failed to persist turn after stream drained', {
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
		logger.error('[SimulationSessionTurn] POST error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to process simulation turn' },
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
