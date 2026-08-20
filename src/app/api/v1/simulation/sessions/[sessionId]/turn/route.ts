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
import { transcribeAudio, TranscriptionRejectedError } from '@/services/gemini.service';
import { uploadToCloudinary } from '@/services/cloudinary.service';
import { checkFindingReveals } from '@/domain/simulation/simulation-turn-reveal.service';
import { buildSimulationSystemInstruction, advancePhaseTool } from '@/domain/simulation/simulation-live-prompt.service';
import config from '@/lib/api/config';

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

		const elapsedMs = Date.now() - session.startedAt.getTime();
		const maxDurationMs = scenario.maxDurationMinutes * 60_000;

		// Time limit reached — end the session before doing any transcription
		// or Live API work.
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

		const secondsRemaining = Math.round((maxDurationMs - elapsedMs) / 1000);

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

		let transcribedText: string;
		try {
			transcribedText = await transcribeAudio(audioBuffer, audioMimeType);
		} catch (error: any) {
			if (error instanceof TranscriptionRejectedError) {
				logger.warn('[SimulationSessionTurn] Transcription rejected', {
					error: error.message,
					sessionId,
				});
				return NextResponse.json(
					{ code: 'ValidationError', message: "We couldn't understand that clearly — please try again" },
					{ status: 422 },
				);
			}
			throw error;
		}

		// Emitted early, before the Live stream starts, so the client can render
		// the student's own turn without waiting on the AI response.
		const transcriptChunk = new TextEncoder().encode(
			`data: ${JSON.stringify({ type: 'transcript', text: transcribedText })}\n\n`,
		);

		// Non-fatal upload — matches the Free Talk attempt convention
		// (src/app/api/v1/ai/free-talk/attempts/route.ts:168-181): a failed
		// upload logs a warning and leaves the URL empty rather than failing
		// the whole request.
		let studentAudioUrl = '';
		try {
			const up = await uploadToCloudinary(audioBuffer, {
				folder: 'eklan/simulation/turns',
				publicId: `sim_${sessionId}_${Date.now()}`,
				resourceType: 'raw',
				transformation: [],
			});
			studentAudioUrl = up.secureUrl;
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			logger.warn('Simulation turn audio upload failed', { error: msg, sessionId });
		}

		// Build conversation history for the Live API. A leading 'model' turn is
		// valid by design here — /opening intentionally persists the AI's opening
		// line as turn 0 — so it must not be trimmed.
		const validHistory: Array<{ role: 'user' | 'model'; text: string }> = session.turns.map(
			(turn: ISimulationSession['turns'][number]) => ({
				role: turn.role === 'student' ? ('user' as const) : ('model' as const),
				text: turn.text,
			}),
		);

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

		const systemInstruction = buildSimulationSystemInstruction(
			scenario,
			currentPhase,
			scenario.studentCharacterName,
			secondsRemaining,
		);

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
		const sessionKey = `sim_${sessionId}`;

		const [relayResponse, revealResult] = await Promise.all([
			fetch(`${config.RELAY_URL}/relay/turn`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Relay-Secret': config.RELAY_AUTH_SECRET || '',
				},
				body: JSON.stringify({
					systemInstruction,
					turns,
					voiceName: 'Kore',
					tools: [advancePhaseTool],
					sessionKey,
				}),
			}),
			unrevealedFindings.length > 0
				? checkFindingReveals(transcribedText, unrevealedFindings)
				: Promise.resolve({ revealedLabels: [] as string[] }),
		]);

		if (!relayResponse.ok || !relayResponse.body) {
			const errorText = await relayResponse.text().catch(() => '');
			logger.error('[SimulationSessionTurn] Relay request failed', {
				status: relayResponse.status,
				error: errorText,
				sessionId,
			});
			return NextResponse.json(
				{ code: 'ServerError', message: 'Failed to reach the live conversation service' },
				{ status: 502 },
			);
		}

		const stream = relayResponse.body;

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
				controller.enqueue(transcriptChunk);

				if (revealFindings.length > 0) {
					const revealChunk = JSON.stringify({ type: 'reveal', findings: revealFindings });
					controller.enqueue(new TextEncoder().encode(`data: ${revealChunk}\n\n`));
				}

				const decoder = new TextDecoder();
				const encoder = new TextEncoder();
				let aiResponseText = '';
				const reader = stream.getReader();

				// SSE frames can be split across multiple read() calls (e.g. large
				// base64 `audio` payloads) — buffer across the whole loop and only
				// process pieces that end in a complete '\n\n' frame separator.
				let sseBuffer = '';

				const processFrame = (line: string): string => {
					const trimmed = line.trim();
					if (!trimmed.startsWith('data: ')) {
						return line;
					}
					try {
						const parsed = JSON.parse(trimmed.slice('data: '.length));
						if (parsed?.type === 'text' && typeof parsed.data === 'string') {
							aiResponseText += parsed.data;
							return line;
						} else if (parsed?.type === 'phaseAdvance' && parsed?.name === 'advancePhase') {
							phaseAdvanced = true;
							const rewritten = JSON.stringify({
								type: 'phaseAdvance',
								newPhaseIndex: session.currentPhaseIndex + 1,
							});
							return `data: ${rewritten}`;
						} else {
							return line;
						}
					} catch {
						/* partial/malformed SSE frame — ignore */
						return line;
					}
				};

				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						sseBuffer += decoder.decode(value, { stream: true });

						const pieces = sseBuffer.split('\n\n');
						// The last piece may be an incomplete frame still waiting on
						// more data from the next read() call — hold it back.
						sseBuffer = pieces.pop() ?? '';

						if (pieces.length > 0) {
							const outputLines = pieces.map(processFrame);
							controller.enqueue(encoder.encode(outputLines.join('\n\n') + '\n\n'));
						}
					}

					if (sseBuffer.length > 0) {
						controller.enqueue(encoder.encode(processFrame(sseBuffer)));
					}
				} finally {
					try {
							const nextTurnNumber = session.turns.length;

							if (!aiResponseText.trim()) {
									logger.error('[SimulationSessionTurn] No AI response text generated, skipping turn persistence', {
											sessionId: session._id,
									});
									// Don't push student or AI turn — nothing was successfully
									// exchanged. Client already received the SSE error event
									// (Part 2 retry logic) and can let the student retry.
							} else {
									session.turns.push({
											turnNumber: nextTurnNumber,
											role: 'student',
											text: transcribedText,
											audioUrl: studentAudioUrl,
											// audioDurationMs intentionally omitted: nothing in this codebase
											// derives duration from a raw audio buffer/File without decoding
											// it (the only other place that tracks it, pronunciation.service.ts,
											// declares the field but neveractually sets it either).
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
							}


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
