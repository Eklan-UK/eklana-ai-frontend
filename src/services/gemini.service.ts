import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI, Modality, type LiveServerMessage } from '@google/genai';
import { spawn } from "child_process";
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';
import { resolveAiNameList, type DrillFreeTalkOverlay } from '@/domain/ai/free-talk';
// Bundled static binary — works in serverless environments where ffmpeg is not on PATH.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegBin: string = require('ffmpeg-static');

// Initialize old SDK (for non-drill functions that still use generateContent)
let genAI: GoogleGenerativeAI | null = null;

// Initialize new SDK (for Live API — drill practice, transcription)
let genAINew: GoogleGenAI | null = null;

if (config.GEMINI_API_KEY) {
	genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
	genAINew = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
} else {
	logger.warn('Gemini API key not configured. AI features will not work.');
}

// Text model (for non-drill functions — transcription, chat)
// gemini-2.5-flash-lite: 20 req/day on the free tier; upgrade Gemini billing for higher limits
const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

/** Low-latency chat + streaming (see config.GEMINI_CHAT_MODEL). */
const CHAT_MODEL = config.GEMINI_CHAT_MODEL;

// Live API model — handles both text + audio in a single WebSocket session
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-latest';

interface ConversationMessage {
	role: 'user' | 'model';
	content: string;
}

interface ConversationOptions {
	messages: ConversationMessage[];
	temperature?: number;
	maxTokens?: number;
	/** Injected as model system instruction (Free Talk: topic, scenario, target words). */
	systemInstruction?: string;
}



interface DrillPracticeOptions {
	drill: {
		type: string;
		title: string;
		difficulty?: string;
		context?: string;
		target_sentences?: any[];
		roleplay_scenes?: any[];
		roleplay_dialogue?: any[];
		student_character_name?: string;
		ai_character_name?: string;
		ai_character_names?: string[];
		matching_pairs?: any[];
		definition_items?: any[];
		grammar_items?: any[];
		sentence_writing_items?: any[];
		fill_blank_items?: any[];
		article_title?: string;
		article_content?: string;
		listening_drill_title?: string;
		listening_drill_content?: string;
		sentence_drill_word?: string;
	};
	userMessage: string;
	conversationHistory?: ConversationMessage[];
	temperature?: number;
	pronunciationWeaknesses?: string[];
	userName?: string;
	/** From role-play: fixed scene + target words (Free Talk from drill). */
	freeTalkOverlay?: DrillFreeTalkOverlay;
	/** User practises as tutor; model plays learner (Alex) in the same drill scenario. */
	freeTalkReversed?: boolean;
}

// ─── PCM to WAV conversion ───────────────────────────────────────────────────
// Live API returns raw PCM L16 audio (24kHz, 16-bit, mono).
// Browsers can't play raw PCM, so we wrap it in a WAV header.

function pcmToWavBase64(pcmBase64: string, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): string {
	const pcmBuffer = Buffer.from(pcmBase64, 'base64');
	const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
	const blockAlign = numChannels * (bitsPerSample / 8);
	const wavHeaderSize = 44;
	const wavBuffer = Buffer.alloc(wavHeaderSize + pcmBuffer.length);

	// RIFF header
	wavBuffer.write('RIFF', 0);
	wavBuffer.writeUInt32LE(36 + pcmBuffer.length, 4);
	wavBuffer.write('WAVE', 8);

	// fmt sub-chunk
	wavBuffer.write('fmt ', 12);
	wavBuffer.writeUInt32LE(16, 16);
	wavBuffer.writeUInt16LE(1, 20); // PCM format
	wavBuffer.writeUInt16LE(numChannels, 22);
	wavBuffer.writeUInt32LE(sampleRate, 24);
	wavBuffer.writeUInt32LE(byteRate, 28);
	wavBuffer.writeUInt16LE(blockAlign, 32);
	wavBuffer.writeUInt16LE(bitsPerSample, 34);

	// data sub-chunk
	wavBuffer.write('data', 36);
	wavBuffer.writeUInt32LE(pcmBuffer.length, 40);
	pcmBuffer.copy(wavBuffer, wavHeaderSize);

	return wavBuffer.toString('base64');
}

// ─── Live API helper ─────────────────────────────────────────────────────────
// Single model for both text (via outputAudioTranscription) and audio.
// No separate generateContent call → avoids gemini-2.5-flash rate limits.

function combineBase64Chunks(chunks: string[]): string {
	if (chunks.length === 0) return '';
	if (chunks.length === 1) return chunks[0];

	const buffers = chunks.map(chunk => Buffer.from(chunk, 'base64'));
	const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
	const combined = Buffer.alloc(totalLength);
	let offset = 0;
	for (const buf of buffers) {
		buf.copy(combined, offset);
		offset += buf.length;
	}
	return combined.toString('base64');
}

/**
 * Returns true if buf is a PCM WAV file already in the exact format
 * Gemini Live expects (16 kHz, 16-bit, mono, little-endian).
 * Checking this lets us skip ffmpeg for iOS recordings (LinearPCM preset).
 */
function isWav16kHz16BitMono(buf: Buffer): boolean {
	if (buf.length < 44) return false;
	if (buf.toString('ascii', 0, 4) !== 'RIFF') return false;
	if (buf.toString('ascii', 8, 12) !== 'WAVE') return false;
	if (buf.toString('ascii', 12, 16) !== 'fmt ') return false;
	const audioFormat = buf.readUInt16LE(20); // 1 = PCM
	const channels    = buf.readUInt16LE(22);
	const sampleRate  = buf.readUInt32LE(24);
	const bitDepth    = buf.readUInt16LE(34);
	return audioFormat === 1 && channels === 1 && sampleRate === 16000 && bitDepth === 16;
}

/** Extract raw PCM payload from a WAV file by locating the 'data' chunk. */
function extractPcmFromWav(buf: Buffer): Buffer {
	let offset = 12;
	while (offset + 8 <= buf.length) {
		const id   = buf.toString('ascii', offset, offset + 4);
		const size = buf.readUInt32LE(offset + 4);
		if (id === 'data') return buf.subarray(offset + 8, offset + 8 + size);
		offset += 8 + size;
	}
	return buf.subarray(44); // fallback: assume standard 44-byte header
}

/**
 * Convert any audio format (m4a, webm, ogg, mp3, etc.) to raw PCM signed-16-bit
 * little-endian at 16 kHz mono — the exact format Gemini Live API expects for
 * `sendRealtimeInput`.  The output contains NO container header; it is raw
 * sample data.  Caller must use mimeType `audio/pcm;rate=16000`.
 *
 * Fast path: if the buffer is already a 16kHz/16-bit/mono WAV (produced by
 * iOS LinearPCM recording), we skip ffmpeg and just strip the RIFF header.
 *
 * Gemini Live docs: https://ai.google.dev/gemini-api/docs/live-guide#sending-audio
 * "Audio needs to be sent as raw PCM data (raw 16-bit PCM audio, 16kHz, little-endian)."
 */
async function convertAudioToRawPcm16k(audioBuffer: Buffer): Promise<Buffer> {
	// Fast path — no ffmpeg needed for iOS LinearPCM recordings.
	if (isWav16kHz16BitMono(audioBuffer)) {
		logger.info('Audio is already 16kHz PCM WAV — skipping ffmpeg');
		return extractPcmFromWav(audioBuffer);
	}

	// Slow path — ffmpeg for m4a / aac / other formats (Android).
	return new Promise((resolve, reject) => {
		const ffmpeg = spawn(ffmpegBin, [
			'-hide_banner', '-loglevel', 'error', '-y',
			'-i', 'pipe:0',   // stdin input
			'-ac', '1',        // mono
			'-ar', '16000',    // 16 kHz — Gemini Live input requirement
			'-f', 's16le',     // raw signed-16-bit little-endian PCM, NO header/container
			'pipe:1',          // stdout output
		]);

		const chunks: Buffer[] = [];
		let stderr = '';

		ffmpeg.stdout.on('data', (d: Buffer) => chunks.push(Buffer.from(d)));
		ffmpeg.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
		ffmpeg.on('error', reject);
		ffmpeg.on('close', (code: number) => {
			if (code === 0) return resolve(Buffer.concat(chunks));
			reject(new Error(`ffmpeg audio conversion failed (exit ${code}): ${stderr || 'no stderr'}`));
		});

		ffmpeg.stdin.end(audioBuffer);
	});
}

async function generateWithLiveAPI(
	systemInstruction: string,
	turns: Array<{ role: string; parts: Array<{ text: string }> }>,
	voiceName: string = 'Kore',
): Promise<{ text: string; audioBase64: string; audioMimeType: string }> {
	if (!genAINew) {
		throw new Error('Gemini Live API is not configured');
	}

	logger.info('Starting Live API session', { model: LIVE_MODEL, turnsCount: turns.length });
	const startTime = Date.now();

	return new Promise(async (resolve, reject) => {
		const audioChunks: string[] = [];
		let transcriptionText = '';  // from outputAudioTranscription
		let modelTurnText = '';      // from modelTurn.parts (often more complete)
		let sessionClosed = false;
		let timeoutHandle: NodeJS.Timeout;

		const getBestText = () => {
			// With native audio models, modelTurnText is ALWAYS internal thinking/reasoning.
			// The actual spoken response only comes via outputAudioTranscription.
			// NEVER use modelTurnText — it shows the AI's chain-of-thought, not its response.
			if (transcriptionText.trim()) return transcriptionText.trim();
			return '(Audio response — transcription unavailable)';
		};

		timeoutHandle = setTimeout(() => {
			if (!sessionClosed) {
				sessionClosed = true;
				logger.warn('Live API session timed out after 45s');
				try { session?.close(); } catch (e) { /* ignore */ }
				if (audioChunks.length > 0 || modelTurnText || transcriptionText) {
					const combinedAudioBase64 = combineBase64Chunks(audioChunks);
					const wavBase64 = pcmToWavBase64(combinedAudioBase64);
					resolve({
						text: getBestText(),
						audioBase64: wavBase64,
						audioMimeType: 'audio/wav',
					});
				} else {
					reject(new Error('Live API session timed out with no response'));
				}
			}
		}, 45000);

		let session: any;

		try {
			session = await genAINew!.live.connect({
				model: LIVE_MODEL,
				config: {
					responseModalities: [Modality.AUDIO],
					speechConfig: {
						voiceConfig: {
							prebuiltVoiceConfig: { voiceName },
						},
					},
					systemInstruction: {
						parts: [{ text: systemInstruction }],
					},
					outputAudioTranscription: {},
					// Same as drill voice / free talk: avoid thought parts + SDK warnings on non-data parts.
					thinkingConfig: { thinkingBudget: 0 },
				},
				callbacks: {
					onopen: () => {
						logger.info('Live API WebSocket connected', { elapsed: `${Date.now() - startTime}ms` });
					},
					onmessage: (message: LiveServerMessage) => {
						// Collect audio data chunks
						const data = message.data;
						if (data) {
							audioChunks.push(data);
						}

						// Collect text from modelTurn parts, skipping "thought" parts
						// (Gemini 2.5 models include chain-of-thought reasoning as thought parts)
						if (message.serverContent?.modelTurn?.parts) {
							for (const part of message.serverContent.modelTurn.parts) {
								if (part.text && !(part as any).thought) {
									modelTurnText += part.text;
								}
							}
						}

						// Collect text from audio transcription (automatic transcript of audio)
						if (message.serverContent?.outputTranscription?.text) {
							transcriptionText += message.serverContent.outputTranscription.text;
						}

						// Check if the turn is complete
						if (message.serverContent?.turnComplete) {
							logger.info('Live API turn complete', {
								audioChunks: audioChunks.length,
								modelTurnTextLength: modelTurnText.length,
								transcriptionTextLength: transcriptionText.length,
								elapsed: `${Date.now() - startTime}ms`,
							});

							clearTimeout(timeoutHandle);
							sessionClosed = true;
							try { session?.close(); } catch (e) { /* ignore */ }

							const finalText = getBestText();

							if (audioChunks.length > 0) {
								const combinedAudioBase64 = combineBase64Chunks(audioChunks);
								const wavBase64 = pcmToWavBase64(combinedAudioBase64);
								resolve({
									text: finalText,
									audioBase64: wavBase64,
									audioMimeType: 'audio/wav',
								});
							} else if (finalText) {
								resolve({
									text: finalText,
									audioBase64: '',
									audioMimeType: 'audio/wav',
								});
							} else {
								reject(new Error('Live API returned no audio or text'));
							}
						}
					},
					onerror: (e: ErrorEvent) => {
						logger.error('Live API WebSocket error', { error: e?.message || 'unknown' });
						clearTimeout(timeoutHandle);
						if (!sessionClosed) {
							sessionClosed = true;
							try { session?.close(); } catch (err) { /* ignore */ }
							reject(new Error(`Live API error: ${e?.message || 'WebSocket error'}`));
						}
					},
					onclose: (e: CloseEvent) => {
						logger.info('Live API WebSocket closed', { code: e?.code, reason: e?.reason });
						clearTimeout(timeoutHandle);
						if (!sessionClosed) {
							sessionClosed = true;
							if (audioChunks.length > 0 || modelTurnText || transcriptionText) {
								const combinedAudioBase64 = combineBase64Chunks(audioChunks);
								const wavBase64 = pcmToWavBase64(combinedAudioBase64);
								resolve({
									text: getBestText(),
									audioBase64: wavBase64,
									audioMimeType: 'audio/wav',
								});
							} else {
								reject(new Error('Live API session closed without audio'));
							}
						}
					},
				},
			});

			session.sendClientContent({
				turns,
				turnComplete: true,
			});

			logger.info('Live API: turns sent, waiting for response...', { turnsCount: turns.length });
		} catch (err: any) {
			clearTimeout(timeoutHandle);
			if (!sessionClosed) {
				sessionClosed = true;
				reject(new Error(`Failed to connect to Live API: ${err.message}`));
			}
		}
	});
}

/**
 * Returns a ReadableStream that yields Server-Sent Events (SSE) representing
 * text and audio chunks generated by the Live API in real-time.
 */
export async function generateWithLiveAPIStream(
	systemInstruction: string,
	turns: Array<{ role: string; parts: Array<{ text: string }> }>,
	voiceName: string = 'Kore',
): Promise<ReadableStream> {
	if (!genAINew) {
		throw new Error('Gemini Live API is not configured');
	}

	logger.info('Starting Live API stream session', { model: LIVE_MODEL, turnsCount: turns.length });
	const startTime = Date.now();

	let session: any;
	let sessionClosed = false;

	let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

	return new ReadableStream({
		async start(controller) {
			const sendChunk = (type: 'audio' | 'text', data: string) => {
				if (sessionClosed) return;
				try {
					const chunk = JSON.stringify({ type, data });
					controller.enqueue(new TextEncoder().encode(`data: ${chunk}\n\n`));
				} catch {
					/* controller already closed — safe to ignore */
				}
			};

			const closeStream = () => {
				if (sessionClosed) return;
				sessionClosed = true;
				if (timeoutHandle !== undefined) { clearTimeout(timeoutHandle); timeoutHandle = undefined; }
				try { session?.close(); } catch { /* ignore */ }
				try { controller.close(); } catch { /* ignore */ }
			};

			timeoutHandle = setTimeout(() => {
				if (!sessionClosed) {
					logger.warn('Live API stream session timed out after 45s');
					closeStream();
				}
			}, 45000);

			try {
				session = await genAINew!.live.connect({
					model: LIVE_MODEL,
					config: {
						responseModalities: [Modality.AUDIO],
						speechConfig: {
							voiceConfig: {
								prebuiltVoiceConfig: { voiceName },
							},
						},
						systemInstruction: {
							parts: [{ text: systemInstruction }],
						},
						outputAudioTranscription: {},
						thinkingConfig: { thinkingBudget: 0 },
					},
					callbacks: {
						onopen: () => {
							logger.info('Live API WebSocket connected (Stream)', { elapsed: `${Date.now() - startTime}ms` });
						},
						onmessage: (message: LiveServerMessage) => {
							if (sessionClosed) return;

							const data = message.data;
							if (data) {
								sendChunk('audio', data);
							}

							if (message.serverContent?.outputTranscription?.text) {
								sendChunk('text', message.serverContent.outputTranscription.text);
							}

							if (message.serverContent?.turnComplete) {
								logger.info('Live API turn complete (Stream)', { elapsed: `${Date.now() - startTime}ms` });
								closeStream();
							}
						},
						onerror: (e: ErrorEvent) => {
							logger.error('Live API WebSocket error (Stream)', { error: e?.message || 'unknown' });
							if (!sessionClosed) {
								sessionClosed = true;
								if (timeoutHandle !== undefined) { clearTimeout(timeoutHandle); timeoutHandle = undefined; }
								try { session?.close(); } catch { /* ignore */ }
								try { controller.error(new Error(`Live API error: ${e?.message || 'WebSocket error'}`)); } catch { /* ignore */ }
							}
						},
						onclose: (e: CloseEvent) => {
							logger.info('Live API WebSocket closed (Stream)', { code: e?.code, reason: e?.reason });
							closeStream();
						},
					},
				});

				session.sendClientContent({
					turns,
					turnComplete: true,
				});

			} catch (err: any) {
				if (!sessionClosed) {
					sessionClosed = true;
					if (timeoutHandle !== undefined) { clearTimeout(timeoutHandle); timeoutHandle = undefined; }
					try { controller.error(new Error(`Failed to connect to Live API: ${err.message}`)); } catch { /* ignore */ }
				}
			}
		},
		cancel(reason) {
			if (!sessionClosed) {
				logger.info('[LiveAPIStream] stream cancelled by client', { reason: String(reason) });
				sessionClosed = true;
				if (timeoutHandle !== undefined) { clearTimeout(timeoutHandle); timeoutHandle = undefined; }
				try { session?.close(); } catch { /* ignore */ }
			}
		},
	});
}


// ─── Live API transcription helper ───────────────────────────────────────────
// Uses the same native audio model as drill practice.
// Enables inputAudioTranscription to get the user's spoken words as text.
// The model is told to remain silent so we only get the input transcription.

async function transcribeWithLiveAPI(
	audioBase64: string,
	mimeType: string = 'audio/webm',
): Promise<string> {
	if (!genAINew) {
		throw new Error('Gemini Live API is not configured');
	}

	logger.info('Starting Live API transcription session', { model: LIVE_MODEL });
	const startTime = Date.now();

	return new Promise(async (resolve, reject) => {
		let inputTranscriptionText = '';
		let sessionClosed = false;
		let timeoutHandle: NodeJS.Timeout;

		timeoutHandle = setTimeout(() => {
			if (!sessionClosed) {
				sessionClosed = true;
				logger.warn('Live API transcription timed out after 30s');
				try { session?.close(); } catch (e) { /* ignore */ }
				if (inputTranscriptionText) {
					resolve(inputTranscriptionText.trim());
				} else {
					reject(new Error('Live API transcription timed out'));
				}
			}
		}, 30000);

		let session: any;

		try {
			session = await genAINew!.live.connect({
				model: LIVE_MODEL,
				config: {
					responseModalities: [Modality.AUDIO],
					speechConfig: {
						voiceConfig: {
							prebuiltVoiceConfig: { voiceName: 'Kore' },
						},
					},
					systemInstruction: {
						parts: [{ text: 'Remain completely silent. Do not speak or produce any audio output. Just listen.' }],
					},
					// Transcribe the USER's audio input (what they spoke)
					inputAudioTranscription: {},
				},
				callbacks: {
					onopen: () => {
						logger.info('Live API transcription WS connected', { elapsed: `${Date.now() - startTime}ms` });
					},
					onmessage: (message: LiveServerMessage) => {
						// inputAudioTranscription events contain the user's spoken text
						if ((message.serverContent as any)?.inputTranscription?.text) {
							inputTranscriptionText += (message.serverContent as any).inputTranscription.text;
						}

						if (message.serverContent?.turnComplete) {
							logger.info('Live API transcription turn complete', {
								inputTextLength: inputTranscriptionText.length,
								elapsed: `${Date.now() - startTime}ms`,
							});
							// Don't close yet — wait for inputTranscription to arrive
							// (it may come after turnComplete)
							if (inputTranscriptionText.trim()) {
								clearTimeout(timeoutHandle);
								sessionClosed = true;
								try { session?.close(); } catch (e) { /* ignore */ }
								resolve(inputTranscriptionText.trim());
							}
							// If no text yet, let the timeout or close handler resolve
						}
					},
					onerror: (e: ErrorEvent) => {
						logger.error('Live API transcription WS error', { error: e?.message || 'unknown' });
						clearTimeout(timeoutHandle);
						if (!sessionClosed) {
							sessionClosed = true;
							try { session?.close(); } catch (err) { /* ignore */ }
							reject(new Error(`Live API transcription error: ${e?.message}`));
						}
					},
					onclose: (e: CloseEvent) => {
						logger.info('Live API transcription WS closed', { code: e?.code });
						clearTimeout(timeoutHandle);
						if (!sessionClosed) {
							sessionClosed = true;
							if (inputTranscriptionText.trim()) {
								resolve(inputTranscriptionText.trim());
							} else {
								reject(new Error('Live API transcription session closed without text'));
							}
						}
					},
				},
			});

			// Send audio as clientContent (required for non-PCM formats like m4a)
			session.sendClientContent({
				turns: [{ role: 'user', parts: [{ inlineData: { data: audioBase64, mimeType } }] }],
				turnComplete: true,
			});

			logger.info('Live API: audio sent for transcription');
		} catch (err: any) {
			clearTimeout(timeoutHandle);
			if (!sessionClosed) {
				sessionClosed = true;
				reject(new Error(`Failed to connect to Live API for transcription: ${err.message}`));
			}
		}
	});
}

// ─── Build drill practice system prompt ──────────────────────────────────────

function buildDrillPracticePrompt(
	drill: DrillPracticeOptions['drill'],
	pronunciationWeaknesses?: string[],
	userName?: string,
	freeTalkOverlay?: DrillFreeTalkOverlay,
	freeTalkReversed?: boolean
): string {
	if (freeTalkReversed && freeTalkOverlay?.scenarioDescription) {
		let prompt = '';
		if (userName) {
			prompt += `TUTOR / REAL USER: The person speaking to you is named "${userName}". They are your English tutor leading this practice. Address them naturally by name when appropriate.\n\n`;
		}
		prompt += `You are Alex, an English learner. The user (${userName || 'your tutor'}) leads the session as the tutor, interviewer, or partner role from the scenario below. You play the learner/candidate/applicant side — the side a student would play in this situation.\n`;
		prompt += `Behave like a genuine learner: ask questions, show curiosity, and occasionally use vocabulary imperfectly or ask the tutor to confirm a phrase. Do NOT act as the teacher, examiner, or interviewer yourself.\n\n`;
		prompt += `DRILL (from their human tutor): "${drill.title}" — type: ${drill.type}, difficulty: ${drill.difficulty || 'intermediate'}`;
		if (drill.context) {
			prompt += `\nGeneral context: ${drill.context}`;
		}
		prompt += `\n\nFOCUSED ROLEPLAY SESSION (stay in this world):\n${freeTalkOverlay.scenarioDescription}`;
		if (freeTalkOverlay.referenceScript?.trim()) {
			prompt += `\n\nREFERENCE SCRIPT (shows how the scenario flows — use it to stay on-topic; you speak as the learner side, not as every line verbatim):\n${freeTalkOverlay.referenceScript.trim()}`;
		}
		if (freeTalkOverlay.vocabularyList.length > 0) {
			const lines = freeTalkOverlay.vocabularyList.map(
				(w, i) => `  ${i + 1}. ${w}`
			).join('\n');
			prompt += `\n\nTARGET WORDS (try to use them; sometimes ask ${userName || 'the tutor'} if you used one correctly):\n${lines}`;
		}
		prompt += `\n\nGENERATION INSTRUCTION:\nStay in the same setting and premise. Build on what ${userName || 'the tutor'} says. Keep replies short (1–3 sentences) like a real learner speaking. No JSON or markdown.`;
		if (pronunciationWeaknesses && pronunciationWeaknesses.length > 0) {
			prompt += `\n\nNote: ${userName || 'The tutor'} may help you with sounds you find difficult: ${pronunciationWeaknesses.join(', ')}.`;
		}
		return prompt;
	}

	// ═══ LAYER 1 — Identity ═══
	let prompt = `You are Eklan, an AI English speaking practice partner. The student has been assigned a ${drill.type === 'roleplay' ? 'roleplay' : drill.type} drill by their human tutor.`;
	if (userName) {
		// Place name rule at the very top of the prompt so the model prioritises it.
		prompt = `STUDENT NAME: The real student speaking to you is named "${userName}". Always address them as "${userName}" — never use a roleplay character name when directly speaking to the real person.\n\n` + prompt;
	}

	// ═══ LAYER 2 — Drill Blueprint ═══
	prompt += `\n\nDRILL BLUEPRINT:\n- Title: "${drill.title}"\n- Type: ${drill.type}\n- Difficulty: ${drill.difficulty || 'intermediate'}`;
	if (drill.context) {
		prompt += `\n- Context: ${drill.context}`;
	}

	// Character information
	if (drill.student_character_name) {
		prompt += `\n- Student plays: ${drill.student_character_name}`;
	}
	const roleAiNames = resolveAiNameList(drill);
	if (roleAiNames && roleAiNames.length > 0) {
		prompt += `\n- AI plays: ${roleAiNames.join(', ')}`;
	}

	const activeOnly =
		freeTalkOverlay != null &&
		typeof freeTalkOverlay.activeSceneIndex === "number" &&
		freeTalkOverlay.activeSceneIndex >= 0 &&
		drill.roleplay_scenes &&
		drill.roleplay_scenes[freeTalkOverlay.activeSceneIndex];

	// Scene descriptions: for Free Talk with a selected scene, only the ACTIVE scene
	// (avoid mixing e.g. "Interview" + "Technical stand-up" in one session).
	if (drill.roleplay_scenes && drill.roleplay_scenes.length > 0) {
		if (activeOnly) {
			const i = freeTalkOverlay!.activeSceneIndex as number;
			const scene = drill.roleplay_scenes[i];
			const parts = [];
			if (scene.scene_name || scene.title || scene.name) {
				parts.push(scene.scene_name || scene.title || scene.name);
			}
			if (scene.context || scene.description) parts.push(scene.context || scene.description);
			if (scene.setting) parts.push(`Setting: ${scene.setting}`);
			prompt += `\n- THIS SESSION's scene only (index ${i} in the drill): ${parts.join(" — ") || JSON.stringify(scene)}`;
			if (drill.roleplay_scenes.length > 1) {
				prompt += `\n- Note: this drill has other scenes for other sessions — do not blend their content into this one unless the student explicitly changes topic.`;
			}
		} else {
			const sceneDescriptions = drill.roleplay_scenes.map((scene: any, i: number) => {
				const parts = [];
				if (scene.scene_name || scene.title || scene.name) {
					parts.push(scene.scene_name || scene.title || scene.name);
				}
				if (scene.context || scene.description) parts.push(scene.context || scene.description);
				if (scene.setting) parts.push(`Setting: ${scene.setting}`);
				return `  ${i + 1}. ${parts.join(' — ') || JSON.stringify(scene)}`;
			}).join('\n');
			prompt += `\n- The tutor created scenes about:\n${sceneDescriptions}`;
		}
	}

	// Key dialogue patterns: skip when reference script is in FOCUSED, or when a multi-scene drill
	// has an active scene selected (global `roleplay_dialogue` is usually all scenes at once).
	const skipGlobalDialogueBlueprint =
		!!freeTalkOverlay?.referenceScript?.trim() ||
		(!!activeOnly && (drill.roleplay_scenes?.length ?? 0) > 1);
	if (
		drill.roleplay_dialogue &&
		drill.roleplay_dialogue.length > 0 &&
		!skipGlobalDialogueBlueprint
	) {
		const dialoguePatterns = drill.roleplay_dialogue.map((d: any) => {
			if (typeof d === 'string') return `  - ${d}`;
			if (d.speaker && d.text) return `  - ${d.speaker}: "${d.text}"`;
			if (d.line) return `  - ${d.line}`;
			return `  - ${JSON.stringify(d)}`;
		}).join('\n');
		prompt += `\n- Key dialogue patterns include:\n${dialoguePatterns}`;
	}

	// Target sentences / vocabulary
	if (drill.target_sentences && drill.target_sentences.length > 0) {
		const sentences = drill.target_sentences.map((s: any, i: number) =>
			`  ${i + 1}. ${typeof s === 'string' ? s : s.text || JSON.stringify(s)}`
		).join('\n');
		prompt += `\n- Target sentences/vocabulary:\n${sentences}`;
	}

	// Other drill content (matching, definitions, grammar, etc.)
	if (drill.matching_pairs && drill.matching_pairs.length > 0) {
		prompt += `\n- Vocabulary pairs to incorporate: ${drill.matching_pairs.map((p: any) => `${p.term || p.word} = ${p.definition || p.match}`).join(', ')}`;
	}
	if (drill.definition_items && drill.definition_items.length > 0) {
		prompt += `\n- Key definitions: ${drill.definition_items.map((d: any) => `${d.word || d.term}: ${d.definition}`).join('; ')}`;
	}
	if (drill.grammar_items && drill.grammar_items.length > 0) {
		prompt += `\n- Grammar focus: ${drill.grammar_items.map((g: any) => g.rule || g.pattern || JSON.stringify(g)).join('; ')}`;
	}
	if (drill.article_title && drill.article_content) {
		prompt += `\n- Related article: "${drill.article_title}" — ${drill.article_content.substring(0, 300)}...`;
	}
	if (drill.sentence_drill_word) {
		prompt += `\n- Target word: "${drill.sentence_drill_word}"`;
	}

	// Optional: Free Talk from a specific tutor scene + word list
	if (freeTalkOverlay?.scenarioDescription) {
		prompt += `\n\nFOCUSED ROLEPLAY SESSION (from tutor's material):
The tutor selected THIS setting for the student's free conversation. You MUST keep the entire session in this setting — do not switch to a different place, role, or premise unless the student explicitly asks.

SETTING:
${freeTalkOverlay.scenarioDescription}`;

		if (freeTalkOverlay.referenceScript?.trim()) {
			prompt += `\n\nREFERENCE SCRIPT (tutor-authored lines for this scene — match the same situation, tone, roles, and learning goals; improvise natural follow-ups and replies; do NOT replace with a different job, company, or scenario type):
${freeTalkOverlay.referenceScript.trim()}`;
		} else if (
			typeof freeTalkOverlay.activeSceneIndex === "number" &&
			drill.roleplay_scenes &&
			drill.roleplay_scenes.length > 1
		) {
			prompt += `\n\n(NOTE: The tutor did not provide line-by-line script for this specific scene. Stay strictly in the SETTING and scene title above. Do not blend in the tutor’s other named scenes, and do not improvise a different company, job, or interview round than described for THIS scene.)`;
		}

		if (freeTalkOverlay.vocabularyList.length > 0) {
			const lines = freeTalkOverlay.vocabularyList.map(
				(w, i) => `  ${i + 1}. ${w}`
			).join('\n');
			prompt += `\n\nTARGET WORDS (weave into dialogue; praise when the student uses one correctly; gentle corrections on misuse):
${lines}`;
		}
	}

	// ═══ LAYER 3 — Generation Instruction ═══
	if (freeTalkOverlay?.scenarioDescription) {
		prompt += `\n\nGENERATION INSTRUCTION:
Stay within the FOCUSED ROLEPLAY SESSION above — same round, same premise (e.g. same interview stage, same technical review), same role names as in the REFERENCE SCRIPT when present.
Continue naturally in the same world and roles. Weave the TARGET WORDS (if any) into the dialogue.
Do not invent a wholly new scenario on each turn; build on the ongoing conversation.
If a REFERENCE SCRIPT is provided, treat it as the canonical content for what this practice is about; extend it, don't override it with unrelated topics.`;
	} else if (drill.type === 'roleplay' || drill.type === 'scenario') {
		prompt += `\n\nGENERATION INSTRUCTION:
Create a DIFFERENT but related roleplay scenario in the same context.
Do NOT repeat the human tutor's exact scenes. Generate a fresh scenario that exercises the same skills.
Use the same themes, vocabulary, and difficulty level, but create a new situation the student hasn't practiced before.
For example, if the tutor's drill was about negotiating salary, you might create a scenario about negotiating a project deadline, discussing a promotion, or resolving a budget conflict.`;
	} else {
		prompt += `\n\nGENERATION INSTRUCTION:
Use the drill content as a foundation, but create fresh practice exercises that reinforce the same skills.
Do NOT simply repeat the exact items from the drill. Generate new examples that exercise the same patterns.
Keep the practice engaging and conversational — weave the target language into natural dialogue.`;
	}

	// ═══ LAYER 4 — Teaching Style ═══
	prompt += `\n\nTEACHING STYLE:
- Use and encourage the same vocabulary from the drill
- Give gentle inline corrections for grammar mistakes
- Praise correct usage of target language
- Keep it natural and conversational
- Match the ${drill.difficulty || 'intermediate'} difficulty level
- Keep responses concise (2-4 sentences typical)
- Be directive — you lead the practice, don't ask the student what they want to do`;

	if (pronunciationWeaknesses && pronunciationWeaknesses.length > 0) {
		prompt += `\n- The student has pronunciation weaknesses with: ${pronunciationWeaknesses.join(', ')}. Incorporate words with these sounds when appropriate.`;
	}

	return prompt;
}

// ─── Exported functions ──────────────────────────────────────────────────────

/**
 * Generate AI conversation response (non-drill, uses text model)
 */
export async function generateConversationResponse(options: ConversationOptions): Promise<string> {
	try {
		if (!genAI) {
			throw new Error('Gemini API is not configured');
		}

		const { messages, temperature = 0.9, maxTokens = 1000, systemInstruction } = options;

		const model = genAI.getGenerativeModel({
			model: CHAT_MODEL,
			generationConfig: {
				temperature,
				maxOutputTokens: maxTokens,
			},
			...(systemInstruction
				? {
						systemInstruction: {
							role: 'user' as const,
							parts: [{ text: systemInstruction }],
						},
					}
				: {}),
		});

		const historyMessages = messages.slice(0, -1);
		let firstUserIndex = -1;
		for (let i = 0; i < historyMessages.length; i++) {
			if (historyMessages[i].role === 'user') {
				firstUserIndex = i;
				break;
			}
		}

		let validHistory: Array<{ role: string; parts: Array<{ text: string }> }> = [];
		if (firstUserIndex >= 0) {
			validHistory = historyMessages.slice(firstUserIndex).map((msg) => ({
				role: msg.role === 'user' ? 'user' : 'model',
				parts: [{ text: msg.content }],
			}));

			if (validHistory.length > 0 && validHistory[0].role !== 'user') {
				logger.warn('History does not start with user message, clearing history');
				validHistory = [];
			}
		}

		logger.debug('Gemini conversation history', {
			totalMessages: messages.length,
			validHistoryCount: validHistory.length,
		});

		const chat = model.startChat({
			history: validHistory.length > 0 ? validHistory : [],
		});

		const lastMessage = messages[messages.length - 1];
		if (lastMessage.role !== 'user') {
			throw new Error('Last message must be from user');
		}

		const result = await chat.sendMessage(lastMessage.content);
		const response = result.response;
		const text = response.text();

		logger.info('Gemini conversation response generated', {
			messageCount: messages.length,
			responseLength: text.length,
		});

		return text;
	} catch (error: any) {
		logger.error('Error generating Gemini conversation', {
			error: error.message,
			stack: error.stack,
		});
		throw new Error(`Failed to generate AI response: ${error.message}`);
	}
}

/**
 * Stream AI conversation response as SSE-compatible lines:
 * `data: {"type":"text","data":"..."}\n\n` and final `data: {"type":"done","data":null}\n\n`
 */
export async function generateConversationResponseStream(
	options: ConversationOptions
): Promise<ReadableStream<Uint8Array>> {
	if (!genAI) {
		throw new Error('Gemini API is not configured');
	}

	const { messages, temperature = 0.9, maxTokens = 1000, systemInstruction } = options;

	const historyMessages = messages.slice(0, -1);
	let firstUserIndex = -1;
	for (let i = 0; i < historyMessages.length; i++) {
		if (historyMessages[i].role === 'user') {
			firstUserIndex = i;
			break;
		}
	}

	let validHistory: Array<{ role: string; parts: Array<{ text: string }> }> = [];
	if (firstUserIndex >= 0) {
		validHistory = historyMessages.slice(firstUserIndex).map((msg) => ({
			role: msg.role === 'user' ? 'user' : 'model',
			parts: [{ text: msg.content }],
		}));

		if (validHistory.length > 0 && validHistory[0].role !== 'user') {
			validHistory = [];
		}
	}

	const lastMessage = messages[messages.length - 1];
	if (lastMessage.role !== 'user') {
		throw new Error('Last message must be from user');
	}

	const model = genAI.getGenerativeModel({
		model: CHAT_MODEL,
		generationConfig: {
			temperature,
			maxOutputTokens: maxTokens,
		},
		// Disable internal reasoning to minimise time-to-first-token.
		thinkingConfig: { thinkingBudget: 0 },
		...(systemInstruction
			? {
					systemInstruction: {
						role: 'user' as const,
						parts: [{ text: systemInstruction }],
					},
				}
			: {}),
	});

	const chat = model.startChat({
		history: validHistory.length > 0 ? validHistory : [],
	});

	const encoder = new TextEncoder();

	logger.info('Gemini conversation stream starting', {
		model: CHAT_MODEL,
		messageCount: messages.length,
	});

	return new ReadableStream({
		async start(controller) {
			const send = (obj: { type: string; data: unknown }) => {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
			};

			try {
				const streamResult = await chat.sendMessageStream(lastMessage.content);
				for await (const chunk of streamResult.stream) {
					const piece = chunk.text();
					if (piece) {
						send({ type: 'text', data: piece });
					}
				}
				send({ type: 'done', data: null });
				controller.close();
			} catch (error: any) {
				logger.error('Error in Gemini conversation stream', {
					error: error.message,
					stack: error.stack,
				});
				send({
					type: 'error',
					data: { message: error.message || 'Stream failed' },
				});
				controller.close();
			}
		},
	});
}


// ─── Transcription (generateContent — fast + reliable) ──────────────────────

/**
 * Transcribe audio using Gemini generateContent API.
 * Uses gemini-2.0-flash (DEFAULT_MODEL) with inline audio data.
 * Fast, cheap, and reliable — no WebSocket overhead.
 */
export async function transcribeAudio(
	audioBuffer: Buffer,
	mimeType: string = 'audio/webm'
): Promise<string> {
	try {
		if (!genAI) {
			throw new Error('Gemini API is not configured');
		}

		logger.info('Transcribing audio', { size: audioBuffer.length, mimeType });

		const model = genAI.getGenerativeModel({
			model: DEFAULT_MODEL,
			generationConfig: {
				temperature: 0.1,
				maxOutputTokens: 2000,
			},
		});

		const base64Audio = audioBuffer.toString('base64');

		const result = await model.generateContent([
			'Transcribe this audio recording exactly as spoken. Return ONLY the transcription text, nothing else. Do not add commentary, punctuation corrections beyond what is spoken, or explanations. If the audio is empty or inaudible, return an empty string.',
			{
				inlineData: {
					data: base64Audio,
					mimeType,
				},
			},
		]);

		const text = result.response.text().trim();
		logger.info('Audio transcribed', { textLength: text.length, preview: text.substring(0, 80) });
		return text;
	} catch (error: any) {
		logger.error('Error transcribing audio', { error: error.message });
		throw new Error(`Failed to transcribe audio: ${error.message}`);
	}
}

/**
 * Analyze pronunciation from audio using Gemini
 */
export async function analyzePronunciationAudio(
	audioBuffer: Buffer,
	expectedText: string,
	options: { language?: string; provideFeedback?: boolean } = {}
): Promise<{
	transcription: string;
	accuracy: number;
	feedback: string;
	wordErrors: Array<{ word: string; expected: string; issue: string }>;
}> {
	try {
		if (!genAI) {
			throw new Error('Gemini API is not configured');
		}

		const model = genAI.getGenerativeModel({
			model: DEFAULT_MODEL,
			generationConfig: {
				temperature: 0.2,
				maxOutputTokens: 1000,
			},
		});

		const base64Audio = audioBuffer.toString('base64');
		const mimeType = 'audio/m4a';

		const prompt = `You are an English pronunciation expert. Listen to this audio and analyze the pronunciation.

Expected text: "${expectedText}"

Respond in this exact JSON format:
{
  "transcription": "what was actually said",
  "accuracy": 85,
  "feedback": "overall feedback about pronunciation",
  "wordErrors": [
    {"word": "actual word said", "expected": "expected word", "issue": "description of the pronunciation issue"}
  ]
}

Be strict but fair in your analysis. Focus on:
1. Whether the words match the expected text
2. Pronunciation clarity
3. Specific sound errors (like 'r' sounding like 'l', etc.)
4. Stress and intonation patterns`;

		const result = await model.generateContent([
			prompt,
			{
				inlineData: {
					data: base64Audio,
					mimeType,
				},
			},
		]);

		const responseText = result.response.text();
		const jsonMatch = responseText.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error('Failed to parse pronunciation analysis response');
		}

		return JSON.parse(jsonMatch[0]);
	} catch (error: any) {
		logger.error('Error analyzing pronunciation', { error: error.message });
		throw new Error(`Failed to analyze pronunciation: ${error.message}`);
	}
}

// ─── Voice message processing (uses text model) ─────────────────────────────

/**
 * Process voice message for conversation
 */
export async function processVoiceMessage(
	audioBuffer: Buffer,
	conversationHistory: ConversationMessage[] = [],
	contextPrompt?: string
): Promise<{
	transcription: string;
	response: string;
	pronunciationFeedback?: string;
}> {
	try {
		if (!genAI) {
			throw new Error('Gemini API is not configured');
		}

		const model = genAI.getGenerativeModel({
			model: DEFAULT_MODEL,
			generationConfig: {
				temperature: 0.7,
				maxOutputTokens: 1000,
			},
		});

		const base64Audio = audioBuffer.toString('base64');
		const mimeType = 'audio/m4a';

		const systemPrompt = contextPrompt || 'You are a helpful English conversation partner. Listen to the audio message and respond naturally.';

		const historyText = conversationHistory.length > 0
			? '\n\nConversation so far:\n' + conversationHistory.map((m) => `${m.role}: ${m.content}`).join('\n')
			: '';

		const prompt = `${systemPrompt}${historyText}

Listen to the audio and respond in this JSON format:
{
  "transcription": "what the user said",
  "response": "your natural conversational response",
  "pronunciationFeedback": "brief feedback on pronunciation if any issues noticed, or null"
}`;

		const result = await model.generateContent([
			prompt,
			{
				inlineData: {
					data: base64Audio,
					mimeType,
				},
			},
		]);

		const responseText = result.response.text();
		const jsonMatch = responseText.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error('Failed to parse voice message response');
		}

		return JSON.parse(jsonMatch[0]);
	} catch (error: any) {
		logger.error('Error processing voice message', { error: error.message });
		throw new Error(`Failed to process voice message: ${error.message}`);
	}
}

// ─── Live Session Cache ─────────────────────────────────────────────────────
// Keeps Gemini Live WebSocket connections alive between voice turns so each
// turn only pays the FFmpeg + model-inference cost, not the ~1-2s reconnect.
//
// Cache key: `freetalk_<userId>` or `drill_<userId>_<drillId>`.
// Sessions are evicted 3 minutes after their last turn completes.
// On WS error/close the entry is removed; the next request opens a fresh one.

interface LiveSessionEntry {
	session: any;
	status: 'connecting' | 'ready' | 'busy' | 'closed';
	idleTimer: ReturnType<typeof setTimeout> | null;
	// Mutable per-turn handlers — swapped in at the start of each turn and
	// cleared the moment the turn's SSE stream closes so the socket stays silent.
	onTurnMessage: ((msg: LiveServerMessage) => void) | null;
	onTurnError: ((e: ErrorEvent) => void) | null;
	onTurnClose: ((e: CloseEvent) => void) | null;
}

const LIVE_SESSION_IDLE_MS = 3 * 60 * 1000;
const liveSessionCache = new Map<string, LiveSessionEntry>();

/**
 * Live responses usually expose PCM as top-level `data`; some SDK / wire shapes
 * only attach the same bytes under `serverContent.modelTurn.parts[].inlineData`.
 */
function getLivePcmDataFromMessage(message: LiveServerMessage): string | undefined {
	if (message.data) return message.data;
	const parts = message.serverContent?.modelTurn?.parts;
	if (!Array.isArray(parts)) return undefined;
	for (const part of parts) {
		const p = part as { inlineData?: { data?: string; mimeType?: string }; thought?: boolean };
		if (p.thought) continue;
		const id = p.inlineData;
		if (id?.data) {
			const m = (id.mimeType || "").toLowerCase();
			// e.g. audio/pcm; rate=16000, audio/ogg+pcm, etc.
			if (m.includes("audio") || m.includes("pcm") || m.includes("ogg")) {
				return id.data;
			}
		}
	}
	return undefined;
}

/** Close WebSocket and drop cache entry. Used after each Free Talk turn — reused sessions
 *  often never emit audio on the next turn (runtime: turn 2 → timeout_no_response, 0 chunks). */
function evictLiveSessionByKey(key: string) {
	const entry = liveSessionCache.get(key);
	if (!entry) return;
	if (entry.idleTimer) {
		clearTimeout(entry.idleTimer);
		entry.idleTimer = null;
	}
	entry.onTurnMessage = null;
	entry.onTurnError = null;
	entry.onTurnClose = null;
	try {
		entry.session?.close?.();
	} catch {
		/* ignore */
	}
	liveSessionCache.delete(key);
}

function resetSessionIdleTimer(key: string, entry: LiveSessionEntry) {
	if (entry.idleTimer) clearTimeout(entry.idleTimer);
	entry.idleTimer = setTimeout(() => {
		logger.info('[SessionCache] idle evict', { key });
		try { entry.session?.close?.(); } catch { /* ignore */ }
		liveSessionCache.delete(key);
	}, LIVE_SESSION_IDLE_MS);
}

async function getOrCreateLiveSession(
	key: string,
	model: string,
	sessionConfig: any,
): Promise<LiveSessionEntry> {
	const existing = liveSessionCache.get(key);
	if (existing) {
		if (existing.status === 'closed') {
			liveSessionCache.delete(key);
		} else if (existing.status === 'connecting') {
			// Another request is mid-connect — wait up to 15 s then reuse.
			const deadline = Date.now() + 15_000;
			while (existing.status === 'connecting' && Date.now() < deadline) {
				await new Promise(r => setTimeout(r, 100));
			}
			const afterWait = (existing as LiveSessionEntry).status;
			if (afterWait === 'ready' || afterWait === 'busy') {
				resetSessionIdleTimer(key, existing);
				return existing;
			}
			liveSessionCache.delete(key);
		} else {
			// 'ready' or 'busy' — reuse the live socket
			resetSessionIdleTimer(key, existing);
			logger.info('[SessionCache] ♻ reusing session', { key, status: existing.status });
			return existing;
		}
	}

	// No usable entry — create a new WebSocket session.
	const entry: LiveSessionEntry = {
		session: null,
		status: 'connecting',
		idleTimer: null,
		onTurnMessage: null,
		onTurnError: null,
		onTurnClose: null,
	};
	liveSessionCache.set(key, entry);

	const tConnect = Date.now();
	try {
		entry.session = await genAINew!.live.connect({
			model,
			config: sessionConfig,
			callbacks: {
				onopen: () => {
					logger.info('[SessionCache] 🔌 WS open (new session)', { key, ms: Date.now() - tConnect });
					entry.status = 'ready';
				},
				onmessage: (msg: LiveServerMessage) => {
					entry.onTurnMessage?.(msg);
				},
				onerror: (e: ErrorEvent) => {
					logger.error('[SessionCache] WS error', { key, error: e?.message });
					entry.status = 'closed';
					liveSessionCache.delete(key);
					entry.onTurnError?.(e);
				},
				onclose: (e: CloseEvent) => {
					logger.info('[SessionCache] WS closed', { key, code: e?.code });
					entry.status = 'closed';
					liveSessionCache.delete(key);
					entry.onTurnClose?.(e);
				},
			},
		});
		entry.status = 'ready';
	} catch (err) {
		entry.status = 'closed';
		liveSessionCache.delete(key);
		throw err;
	}

	resetSessionIdleTimer(key, entry);
	return entry;
}

// ─── Voice conversation (Live API + built-in transcription, SSE) ──────────
// Mic audio → Gemini Live WebSocket → audio + text SSE. After each turn the Live
// session is closed and evicted — reused sockets often produced no audio on
// turn 2+ (timeout_no_response). Context is re-sent via systemInstruction + history.
//
// Key design decisions (per Google Live API docs):
//   1. Audio input MUST be raw PCM 16-bit, 16 kHz, little-endian mono.
//   2. Use sendRealtimeInput({ audio }) — enables automatic VAD + transcription.
//   3. Disable thinking (thinkingBudget: 0) for lowest latency.
export async function generateVoiceConversationSSEStream(
	audioBuffer: Buffer,
	conversationHistory: ConversationMessage[] = [],
	contextPrompt?: string,
	_mimeType: string = 'audio/m4a',  // kept for API compat, format handled internally
	voiceName: string = 'Kore',
	userName?: string,
	userId?: string,               // used as the session cache key
): Promise<ReadableStream> {
	if (!genAINew) throw new Error('Gemini Live API is not configured');

	const t0 = Date.now();

	// ① FFmpeg — convert to raw PCM 16 kHz (the only format Live API accepts).
	let pcmBuffer: Buffer;
	try {
		pcmBuffer = await convertAudioToRawPcm16k(audioBuffer);
		logger.info('[FreeTalk] ① ffmpeg', { ms: Date.now() - t0, inBytes: audioBuffer.length, outBytes: pcmBuffer.length });
	} catch (e: any) {
		throw new Error(`Audio conversion failed: ${e?.message || 'ffmpeg error'}`);
	}
	const pcmBase64 = pcmBuffer.toString('base64');
	const pcmBytes  = pcmBuffer.length;

	// Build system instruction — applied on each new Live connection (we evict after each turn).
	const persona = contextPrompt ||
		'You are Eklan, a friendly AI English speaking practice partner. Your role is to have natural, encouraging conversations to help the student improve their English.';
	let systemInstruction = persona;
	if (userName) {
		systemInstruction += `\n\nThe student's real name is "${userName}". Always address them as "${userName}". This is their real name, not a roleplay character.`;
	}
	systemInstruction += '\n\nRespond naturally in spoken English. Keep replies concise (2-4 sentences). Be warm and encouraging.';
	if (conversationHistory.length > 0) {
		// Only relevant for the first turn of a fresh session.
		const recent = conversationHistory.slice(-6);
		systemInstruction += '\n\nRecent conversation:\n' +
			recent.map(m => `${m.role === 'user' ? (userName || 'Student') : 'Eklan'}: ${m.content}`).join('\n');
	}

	// ② Live session key (cache is evicted after each completed turn — see closeStream).
	const cacheKey = userId ? `freetalk_${userId}` : `freetalk_anon_${Date.now()}`;
	const tSession = Date.now();
	const entry = await getOrCreateLiveSession(cacheKey, LIVE_MODEL, {
		responseModalities: [Modality.AUDIO],
		speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
		systemInstruction: { parts: [{ text: systemInstruction }] },
		inputAudioTranscription: {},
		outputAudioTranscription: {},
		thinkingConfig: { thinkingBudget: 0 },
	});
	logger.info('[FreeTalk] ② session ready', { ms: Date.now() - tSession });

	// ③ Create the SSE stream — session is already connected; just route messages.
	// Shared state for start + cancel (client disconnect aborts the reader; timers must still clear).
	const sseCtx = {
		streamClosed: false,
		timeoutHandle: undefined as ReturnType<typeof setTimeout> | undefined,
		turnCompleteHandle: undefined as ReturnType<typeof setTimeout> | undefined,
	};

	return new ReadableStream({
		start(controller) {
			const sendChunk = (type: 'audio' | 'text' | 'metadata', data: any) => {
				if (sseCtx.streamClosed) return;
				try {
					controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type, data })}\n\n`));
				} catch (e: unknown) {
					const err = e as { code?: string };
					if (err?.code !== 'ERR_INVALID_STATE') throw e;
				}
			};

		const fullAssistantText: string[] = [];
		let fullUserText = '';
		let metadataSent = false;
		let tFirstChunk   = 0;
		let tFirstModelActivity = 0;
		let firstModelProducing = false;

		const releaseSession = () => {
			entry.onTurnMessage = null;
			entry.onTurnError   = null;
			entry.onTurnClose   = null;
			if (entry.status === 'busy') entry.status = 'ready';
		};

		const clearTimers = () => {
			if (sseCtx.timeoutHandle !== undefined) {
				clearTimeout(sseCtx.timeoutHandle);
				sseCtx.timeoutHandle = undefined;
			}
			if (sseCtx.turnCompleteHandle !== undefined) {
				clearTimeout(sseCtx.turnCompleteHandle);
				sseCtx.turnCompleteHandle = undefined;
			}
		};

		const closeStream = (reason?: string) => {
			if (sseCtx.streamClosed) return;
			sseCtx.streamClosed = true;
			clearTimers();
			releaseSession();
			evictLiveSessionByKey(cacheKey);
			if (reason) logger.info('[FreeTalk] stream closed', { reason });
			try {
				controller.close();
			} catch (e: unknown) {
				const err = e as { code?: string };
				if (err?.code !== 'ERR_INVALID_STATE') throw e;
			}
		};

		// Two-stage timeout: 45 s for first *model* output (transcription and/or audio), then 90 s to complete.
		// `outputTranscription` may arrive before top-level `data` — treat it as the first chunk for timeout purposes.
		const scheduleFirstChunkTimeout = () => {
			sseCtx.timeoutHandle = setTimeout(() => {
				sseCtx.timeoutHandle = undefined;
				if (!metadataSent) { metadataSent = true; sendChunk('metadata', { fullText: '', inputText: '', error: 'timeout_no_response' }); }
				closeStream('timeout_no_response');
			}, 45_000);
		};
		const resetToStreamCompleteTimeout = () => {
			if (sseCtx.timeoutHandle !== undefined) { clearTimeout(sseCtx.timeoutHandle); }
			sseCtx.timeoutHandle = setTimeout(() => {
				sseCtx.timeoutHandle = undefined;
				if (!metadataSent) { metadataSent = true; sendChunk('metadata', { fullText: fullAssistantText.join('').trim(), inputText: fullUserText.trim(), error: 'timeout_stream_too_long' }); }
				closeStream('timeout_stream_too_long');
			}, 90_000);
		};

		const noteFirstModelProducing = () => {
			if (firstModelProducing) return;
			firstModelProducing = true;
			tFirstModelActivity = Date.now();
			resetToStreamCompleteTimeout();
		};

		entry.onTurnMessage = (message: LiveServerMessage) => {
			const outputText = message.serverContent?.outputTranscription?.text;
			if (outputText) {
				noteFirstModelProducing();
				fullAssistantText.push(outputText);
				sendChunk('text', outputText);
			}

			const inputText = (message.serverContent as any)?.inputTranscription?.text;
			if (inputText) fullUserText += inputText;

			const pcm = getLivePcmDataFromMessage(message);
			if (pcm) {
				noteFirstModelProducing();
				if (!tFirstChunk) {
					tFirstChunk = Date.now();
					logger.info('[FreeTalk] ③ first PCM routed to SSE', { ms: tFirstChunk - tSession });
				}
				sendChunk('audio', pcm);
			}

			if (message.serverContent?.turnComplete && !metadataSent) {
				metadataSent = true;
				sseCtx.turnCompleteHandle = setTimeout(() => {
					sseCtx.turnCompleteHandle = undefined;
					if (sseCtx.streamClosed) return;
					logger.info('[FreeTalk] ④ turn complete', {
						totalMs: Date.now() - t0,
						ffmpegMs: tSession - t0,
						firstModelOutputMs: tFirstModelActivity ? tFirstModelActivity - tSession : null,
						firstPcmChunkMs: tFirstChunk ? tFirstChunk - tSession : null,
					});
					sendChunk('metadata', { fullText: fullAssistantText.join('').trim(), inputText: fullUserText.trim() });
					closeStream('turnComplete');
				}, 150);
			}
		};

		entry.onTurnError = (e: ErrorEvent) => {
			logger.error('[FreeTalk] WS error on turn', { error: e?.message });
			if (!metadataSent) { metadataSent = true; sendChunk('metadata', { fullText: fullAssistantText.join('').trim(), inputText: fullUserText.trim(), error: e?.message || 'unknown' }); }
			closeStream('error');
		};

		entry.onTurnClose = (e: CloseEvent) => {
			if (!metadataSent) { metadataSent = true; sendChunk('metadata', { fullText: fullAssistantText.join('').trim(), inputText: fullUserText.trim(), error: e?.reason || `ws_closed_${e?.code ?? 'unknown'}` }); }
			closeStream('onclose');
		};

		scheduleFirstChunkTimeout();

		// Send audio — session is already open
		entry.status = 'busy';
		entry.session.sendRealtimeInput({ audio: { data: pcmBase64, mimeType: 'audio/pcm;rate=16000' } });
		entry.session.sendRealtimeInput({ audioStreamEnd: true });
		logger.info('[FreeTalk] ②→③ audio sent', { pcmBytes, msSinceStart: Date.now() - t0 });
		},
		cancel(reason) {
			if (sseCtx.streamClosed) return;
			sseCtx.streamClosed = true;
			if (sseCtx.timeoutHandle !== undefined) {
				clearTimeout(sseCtx.timeoutHandle);
				sseCtx.timeoutHandle = undefined;
			}
			if (sseCtx.turnCompleteHandle !== undefined) {
				clearTimeout(sseCtx.turnCompleteHandle);
				sseCtx.turnCompleteHandle = undefined;
			}
			evictLiveSessionByKey(cacheKey);
			logger.info('[FreeTalk] stream cancelled', { reason: String(reason) });
		},
	});
}

// ─── Drill voice conversation (Live API + built-in transcription, SSE) ─
// Same pipeline as generateVoiceConversationSSEStream but with drill-aware
// system prompt. Converts audio to raw PCM 16kHz before sending.
export async function generateDrillPracticeVoiceResponseStream(
	options: {
		drill: DrillPracticeOptions['drill'];
		audioBuffer: Buffer;
		conversationHistory?: ConversationMessage[];
		pronunciationWeaknesses?: string[];
		mimeType?: string;   // kept for API compat, format handled internally
		voiceName?: string;
		userName?: string;
		userId?: string;     // used as part of the session cache key
		drillId?: string;    // used as part of the session cache key
		freeTalkOverlay?: DrillFreeTalkOverlay;
		/** User practises as tutor; model plays learner (Alex). */
		freeTalkReversed?: boolean;
	}
): Promise<ReadableStream> {
	const {
		drill,
		audioBuffer,
		conversationHistory = [],
		pronunciationWeaknesses,
		voiceName = 'Kore',
		userName,
		userId,
		drillId,
		freeTalkOverlay,
		freeTalkReversed,
	} = options;

	if (!genAINew) throw new Error('Gemini Live API is not configured');

	const t0 = Date.now();

	// Build system instruction before kicking off parallel work (sync, no I/O).
	let systemInstruction = buildDrillPracticePrompt(
		drill,
		pronunciationWeaknesses,
		userName,
		freeTalkOverlay,
		freeTalkReversed
	);
	if (conversationHistory.length > 0) {
		const recent = conversationHistory.slice(-4);
		systemInstruction += '\n\nRecent conversation:\n' +
			recent.map(m => `${m.role === 'user' ? (userName || 'Student') : 'Eklan'}: ${m.content}`).join('\n');
	}
	systemInstruction += '\n\nIMPORTANT: The user is speaking via voice. Listen carefully, respond in spoken English. Keep responses concise (2-4 sentences). No JSON or markdown.';

	const overlayKey = freeTalkOverlay?.scenarioDescription
		? `_ft_${Buffer.from(freeTalkOverlay.scenarioDescription)
			.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '')
			.slice(0, 48)}${freeTalkReversed ? '_rev' : ''}`
		: '';
	const cacheKey = (userId && drillId) ? `drill_${userId}_${drillId}${overlayKey}` : `drill_anon_${Date.now()}`;

	// ①+② Run FFmpeg conversion and Live session connect in parallel — session
	// creation (~500-970 ms) dominates; overlapping FFmpeg (~50-280 ms) hides it.
	const tSession = Date.now();
	let pcmBuffer: Buffer;
	let entry: LiveSessionEntry;
	try {
		[pcmBuffer, entry] = await Promise.all([
			convertAudioToRawPcm16k(audioBuffer).catch((e: any) => {
				throw new Error(`Drill audio conversion failed: ${e?.message || 'ffmpeg error'}`);
			}),
			getOrCreateLiveSession(cacheKey, LIVE_MODEL, {
				responseModalities: [Modality.AUDIO],
				speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
				systemInstruction: { parts: [{ text: systemInstruction }] },
				inputAudioTranscription: {},
				outputAudioTranscription: {},
				thinkingConfig: { thinkingBudget: 0 },
			}),
		]);
	} catch (e: any) {
		throw e;
	}
	logger.info('[Drill] ①+② ffmpeg+session ready (parallel)', {
		totalMs: Date.now() - t0,
		inBytes: audioBuffer.length,
		outBytes: pcmBuffer.length,
	});
	const pcmBase64 = pcmBuffer.toString('base64');
	const pcmBytes  = pcmBuffer.length;

	// ③ Create the SSE stream — session is already connected; just route messages.
	const sseCtx = {
		streamClosed: false,
		timeoutHandle: undefined as ReturnType<typeof setTimeout> | undefined,
		turnCompleteHandle: undefined as ReturnType<typeof setTimeout> | undefined,
	};

	return new ReadableStream({
		start(controller) {
			const sendChunk = (type: 'audio' | 'text' | 'metadata', data: any) => {
				if (sseCtx.streamClosed) return;
				try {
					controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type, data })}\n\n`));
				} catch (e: unknown) {
					const err = e as { code?: string };
					if (err?.code !== 'ERR_INVALID_STATE') throw e;
				}
			};

		const fullAssistantText: string[] = [];
		let fullUserText = '';
		let metadataSent = false;
		let tFirstChunk   = 0;
		let tFirstModelActivity = 0;
		let firstModelProducing = false;

		const releaseSession = () => {
			entry.onTurnMessage = null;
			entry.onTurnError   = null;
			entry.onTurnClose   = null;
			if (entry.status === 'busy') entry.status = 'ready';
		};

		const clearTimers = () => {
			if (sseCtx.timeoutHandle !== undefined) {
				clearTimeout(sseCtx.timeoutHandle);
				sseCtx.timeoutHandle = undefined;
			}
			if (sseCtx.turnCompleteHandle !== undefined) {
				clearTimeout(sseCtx.turnCompleteHandle);
				sseCtx.turnCompleteHandle = undefined;
			}
		};

		const closeStream = (reason?: string) => {
			if (sseCtx.streamClosed) return;
			sseCtx.streamClosed = true;
			clearTimers();
			releaseSession();
			// Must evict the Live socket every turn (same as Free Talk) — reusing the cached
			// session often produced zero audio on subsequent turns (timeout_no_response).
			evictLiveSessionByKey(cacheKey);
			if (reason) logger.info('[Drill] stream closed', { reason });
			try {
				controller.close();
			} catch (e: unknown) {
				const err = e as { code?: string };
				if (err?.code !== 'ERR_INVALID_STATE') throw e;
			}
		};

		// Two-stage timeout: 45 s for first *model* output, then 90 s to complete.
		const scheduleFirstChunkTimeout = () => {
			sseCtx.timeoutHandle = setTimeout(() => {
				sseCtx.timeoutHandle = undefined;
				if (!metadataSent) { metadataSent = true; sendChunk('metadata', { fullText: '', inputText: '', drillType: drill.type, drillTitle: drill.title, error: 'timeout_no_response' }); }
				closeStream('timeout_no_response');
			}, 45_000);
		};
		const resetToStreamCompleteTimeout = () => {
			if (sseCtx.timeoutHandle !== undefined) { clearTimeout(sseCtx.timeoutHandle); }
			sseCtx.timeoutHandle = setTimeout(() => {
				sseCtx.timeoutHandle = undefined;
				if (!metadataSent) { metadataSent = true; sendChunk('metadata', { fullText: fullAssistantText.join('').trim(), inputText: fullUserText.trim(), drillType: drill.type, drillTitle: drill.title, error: 'timeout_stream_too_long' }); }
				closeStream('timeout_stream_too_long');
			}, 90_000);
		};

		const noteFirstModelProducing = () => {
			if (firstModelProducing) return;
			firstModelProducing = true;
			tFirstModelActivity = Date.now();
			resetToStreamCompleteTimeout();
		};

		entry.onTurnMessage = (message: LiveServerMessage) => {
			const outputText = message.serverContent?.outputTranscription?.text;
			if (outputText) {
				noteFirstModelProducing();
				fullAssistantText.push(outputText);
				sendChunk('text', outputText);
			}

			const inputText = (message.serverContent as any)?.inputTranscription?.text;
			if (inputText) fullUserText += inputText;

			const pcm = getLivePcmDataFromMessage(message);
			if (pcm) {
				noteFirstModelProducing();
				if (!tFirstChunk) {
					tFirstChunk = Date.now();
					logger.info('[Drill] ③ first PCM routed to SSE', { ms: tFirstChunk - tSession });
				}
				sendChunk('audio', pcm);
			}

		if (message.serverContent?.turnComplete && !metadataSent) {
			metadataSent = true;
			sseCtx.turnCompleteHandle = setTimeout(() => {
				sseCtx.turnCompleteHandle = undefined;
				if (sseCtx.streamClosed) return;
				logger.info('[Drill] ④ turn complete', {
					totalMs: Date.now() - t0,
					ffmpegMs: tSession - t0,
					firstModelOutputMs: tFirstModelActivity ? tFirstModelActivity - tSession : null,
					firstPcmChunkMs: tFirstChunk ? tFirstChunk - tSession : null,
				});
				sendChunk('metadata', {
					fullText:   fullAssistantText.join('').trim(),
					inputText:  fullUserText.trim(),
					drillType:  drill.type,
					drillTitle: drill.title,
				});
				closeStream('turnComplete');
			}, 150);
			}
		};

		entry.onTurnError = (e: ErrorEvent) => {
			logger.error('[Drill] WS error on turn', { error: e?.message });
			if (!metadataSent) { metadataSent = true; sendChunk('metadata', { fullText: fullAssistantText.join('').trim(), inputText: fullUserText.trim(), error: e?.message || 'unknown' }); }
			closeStream('error');
		};

		entry.onTurnClose = (e: CloseEvent) => {
			if (!metadataSent) { metadataSent = true; sendChunk('metadata', { fullText: fullAssistantText.join('').trim(), inputText: fullUserText.trim(), error: e?.reason || `ws_closed_${e?.code ?? 'unknown'}` }); }
			closeStream('onclose');
		};

		scheduleFirstChunkTimeout();

		// Send audio — session is already open
		entry.status = 'busy';
		entry.session.sendRealtimeInput({ audio: { data: pcmBase64, mimeType: 'audio/pcm;rate=16000' } });
		entry.session.sendRealtimeInput({ audioStreamEnd: true });
		logger.info('[Drill] ②→③ audio sent', { pcmBytes, msSinceStart: Date.now() - t0 });
		},
		cancel(reason) {
			if (sseCtx.streamClosed) return;
			sseCtx.streamClosed = true;
			if (sseCtx.timeoutHandle !== undefined) {
				clearTimeout(sseCtx.timeoutHandle);
				sseCtx.timeoutHandle = undefined;
			}
			if (sseCtx.turnCompleteHandle !== undefined) {
				clearTimeout(sseCtx.turnCompleteHandle);
				sseCtx.turnCompleteHandle = undefined;
			}
			entry.onTurnMessage = null;
			entry.onTurnError   = null;
			entry.onTurnClose   = null;
			if (entry.status === 'busy') entry.status = 'ready';
			evictLiveSessionByKey(cacheKey);
			logger.info('[Drill] stream cancelled', { reason: String(reason) });
		},
	});
}

// ─── Listening comprehension (uses text model) ──────────────────────────────

/**
 * Analyze listening comprehension from audio
 */
export async function analyzeListeningComprehension(
	audioBuffer: Buffer,
	questions: Array<{ question: string; correctAnswer: string }>
): Promise<{
	answers: Array<{ question: string; answer: string; isCorrect: boolean }>;
	overallScore: number;
	feedback: string;
}> {
	try {
		if (!genAI) {
			throw new Error('Gemini API is not configured');
		}

		const model = genAI.getGenerativeModel({
			model: DEFAULT_MODEL,
			generationConfig: {
				temperature: 0.2,
				maxOutputTokens: 1000,
			},
		});

		const base64Audio = audioBuffer.toString('base64');
		const mimeType = 'audio/m4a';

		const prompt = `Listen to this audio recording and answer the following comprehension questions.

Questions:
${questions.map((q, i) => `${i + 1}. ${q.question} (Expected: ${q.correctAnswer})`).join('\n')}

Respond in this exact JSON format:
{
  "answers": [
    {"question": "the question", "answer": "the answer from the audio", "isCorrect": true/false}
  ],
  "overallScore": 85,
  "feedback": "overall feedback about comprehension"
}`;

		const result = await model.generateContent([
			prompt,
			{
				inlineData: {
					data: base64Audio,
					mimeType,
				},
			},
		]);

		const responseText = result.response.text();
		const jsonMatch = responseText.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error('Failed to parse listening comprehension response');
		}

		return JSON.parse(jsonMatch[0]);
	} catch (error: any) {
		logger.error('Error analyzing listening comprehension', { error: error.message });
		throw new Error(`Failed to analyze listening comprehension: ${error.message}`);
	}
}

// ─── Drill practice (Live API only — no gemini-2.5-flash) ───────────────────

/**
 * Generate drill-aware conversation response with native audio.
 * Uses ONLY the Live API — single model for both text + audio.
 */
export async function generateDrillPracticeResponseStream(options: DrillPracticeOptions): Promise<ReadableStream> {
	try {
		if (!config.GEMINI_API_KEY) {
			throw new Error('Gemini API is not configured');
		}

		const { drill, userMessage, conversationHistory = [], pronunciationWeaknesses, userName, freeTalkOverlay, freeTalkReversed } = options;

		const systemPrompt = buildDrillPracticePrompt(drill, pronunciationWeaknesses, userName, freeTalkOverlay, freeTalkReversed);

		// Build conversation history for Live API turns
		let validHistory = conversationHistory;
		if (validHistory.length > 0 && validHistory[0].role === 'model') {
			const firstUserIndex = validHistory.findIndex((msg) => msg.role === 'user');
			if (firstUserIndex > 0) {
				validHistory = validHistory.slice(firstUserIndex);
			} else if (firstUserIndex === -1) {
				validHistory = [];
			}
		}

		const history = validHistory.map((msg) => ({
			role: msg.role === 'user' ? 'user' : 'model',
			parts: [{ text: msg.content }],
		}));

		const turns = [
			...history,
			{
				role: 'user',
				parts: [{ text: userMessage }],
			},
		];

		logger.info('Generating drill practice response via Live API (Stream)...', {
			drillType: drill.type,
			model: LIVE_MODEL,
			turnsCount: turns.length,
		});

		const liveStream = await generateWithLiveAPIStream(systemPrompt, turns);
		
		// Create a transform stream to inject the drill metadata as the very first chunk
		const transformStream = new TransformStream({
			start(controller) {
				const metadataChunk = JSON.stringify({
					type: 'metadata',
					data: {
						drillType: drill.type,
						drillTitle: drill.title,
					}
				});
				controller.enqueue(new TextEncoder().encode(`data: ${metadataChunk}\n\n`));
			}
		});

		return liveStream.pipeThrough(transformStream);

	} catch (error: any) {
		logger.error('Error generating drill practice response (Stream)', {
			error: error.message,
			stack: error.stack,
			drillType: options.drill.type,
		});
		throw new Error(`Failed to generate drill practice response: ${error.message}`);
	}
}

export async function generateDrillPracticeGreetingStream(
	drill: DrillPracticeOptions['drill'],
	userName?: string,
	freeTalkOverlay?: DrillFreeTalkOverlay,
	freeTalkReversed?: boolean
): Promise<ReadableStream> {
	try {
		if (!config.GEMINI_API_KEY) {
			throw new Error('Gemini API is not configured');
		}

		const typeLabel: Record<string, string> = {
			roleplay: 'roleplay practice',
			vocabulary: 'vocabulary practice',
			grammar: 'grammar practice',
			matching: 'word matching practice',
			definition: 'definition practice',
			sentence_writing: 'sentence building practice',
			fill_blank: 'fill-in-the-blank practice',
			summary: 'reading discussion',
			listening: 'listening comprehension chat',
			sentence: 'sentence practice',
		};

		const label = typeLabel[drill.type] || 'English practice';

		let systemPrompt = `You are Eklan, an AI English speaking practice partner. The student has been assigned a ${label} drill by their human tutor.`;
		if (userName) {
			systemPrompt += `\n\nThe student's name is ${userName}. Address them by their name occasionally.`;
		}

		if (freeTalkOverlay?.scenarioDescription && freeTalkReversed) {
			const vocabLine =
				freeTalkOverlay.vocabularyList.length > 0
					? `\n\nTARGET WORDS you may try to use (and sometimes ask about): ${freeTalkOverlay.vocabularyList.join(', ')}.`
					: '';
			const scriptBlock =
				freeTalkOverlay.referenceScript?.trim()
					? `\n\nREFERENCE SCRIPT (context for the situation — you play the learner side, not every speaker):\n${freeTalkOverlay.referenceScript.trim()}`
					: '';
			systemPrompt = `${userName ? `Your tutor is named "${userName}". Address them naturally; they lead this practice while you play the learner role.\n\n` : ''}You are Alex, an English learner. You are practising in the scenario below; the user is your tutor or partner in the situation and leads the conversation while you respond as the learner/candidate side.

DRILL: "${drill.title}" (${drill.difficulty || 'intermediate'} level)${drill.context ? `\nGeneral context: ${drill.context}` : ''}

FOCUSED FREE TALK SETTING (stay in this exact situation):
${freeTalkOverlay.scenarioDescription}${scriptBlock}${vocabLine}

Your opening (2 short sentences max):
1. Greet as Alex, eager or a little nervous to practise in this setting
2. Invite ${userName || 'them'} to start, or ask one small opening question as the learner would

CRITICAL: You are NOT the interviewer or teacher. Do NOT ask "What would you like to practice?".`;
		} else if (freeTalkOverlay?.scenarioDescription) {
			const vocabLine =
				freeTalkOverlay.vocabularyList.length > 0
					? `\n\nTARGET WORDS to feature in this session: ${freeTalkOverlay.vocabularyList.join(', ')}.`
					: '';
			const scriptBlock =
				freeTalkOverlay.referenceScript?.trim()
					? `\n\nTUTOR SCRIPT (this is what the drill is about — start in-character consistent with it; same interview/technical/role as the lines below):\n${freeTalkOverlay.referenceScript.trim()}`
					: "";
			systemPrompt += `\n\nDRILL: "${drill.title}" (${drill.difficulty || 'intermediate'} level)${drill.context ? `\nGeneral context: ${drill.context}` : ''}

FOCUSED FREE TALK SETTING (use this exact situation — do not invent a different scene):
${freeTalkOverlay.scenarioDescription}${scriptBlock}${vocabLine}

Your opening should be brief and directive (2-3 sentences max):
1. Acknowledge you're continuing practice tied to their tutor's material
2. Drop them straight into THIS setting in character and give one clear first thing to say or do

CRITICAL: Do NOT ask "What would you like to practice?" — YOU lead. Stay in the setting above.`;
		} else {
		systemPrompt += `\n\nDRILL: "${drill.title}" (${drill.difficulty || 'intermediate'} level)${drill.context ? `\nContext: ${drill.context}` : ''}

Your opening should be brief and directive (2-3 sentences max):
1. Tell the student what today's session is about
2. Create a FRESH scenario related to the drill topic (don't repeat the tutor's exact scenes)
3. Immediately set the scene and give them their FIRST task

CRITICAL: Do NOT ask "What would you like to practice?" — YOU lead the session. Jump right into a new scenario.
Example tone: "Alright! Today we're working on office negotiation. I'm going to set up a scenario for you — you're an employee asking your manager for a deadline extension. Let's begin. I'll be your manager. Go ahead and start the conversation."`;
		}

		const turns = [
			{
				role: 'user',
				parts: [{ text: 'Start the practice session.' }],
			},
		];

		logger.info('Generating greeting via Live API (Stream)...', { drillType: drill.type, model: LIVE_MODEL });

		const liveStream = await generateWithLiveAPIStream(systemPrompt, turns);

		// Create a transform stream to inject the drill metadata as the very first chunk
		const transformStream = new TransformStream({
			start(controller) {
				const metadataChunk = JSON.stringify({
					type: 'metadata',
					data: {
						drillType: drill.type,
						drillTitle: drill.title,
					}
				});
				controller.enqueue(new TextEncoder().encode(`data: ${metadataChunk}\n\n`));
			}
		});

		return liveStream.pipeThrough(transformStream);
		
	} catch (error: any) {
		logger.error('Error generating drill practice greeting (Stream)', {
			error: error.message,
			drillType: drill.type,
		});
		
		// Fallback stream
		return new ReadableStream({
			start(controller) {
				const metadataChunk = JSON.stringify({
					type: 'metadata',
					data: { drillType: drill.type, drillTitle: drill.title }
				});
				const textChunk = JSON.stringify({
					type: 'text',
					data: `Alright! Today we're working on "${drill.title}". I've got some exercises ready for you. Let's jump right in!`
				});
				
				controller.enqueue(new TextEncoder().encode(`data: ${metadataChunk}\n\n`));
				controller.enqueue(new TextEncoder().encode(`data: ${textChunk}\n\n`));
				controller.close();
			}
		});
	}
}

// ─── Topic practice (Live API stream for mobile app) ─────────────────────────

export async function generateTopicPracticeGreetingStream(topic: string = 'daily-life', userName?: string): Promise<ReadableStream> {
	try {
		if (!config.GEMINI_API_KEY) {
			throw new Error('Gemini API is not configured');
		}

		const topicContexts: Record<string, string> = {
			'daily-life': 'everyday life and casual conversations',
			'work-school': 'professional work environments and academic scenarios',
			'on-mind': 'whatever the student wants to talk about',
			'surprise': 'a fun, unexpected, or creative scenario',
		};

		const contextLabel = topicContexts[topic] || topicContexts['daily-life'];

		let systemPrompt = `You are Eklan, an AI English speaking practice partner. The student wants to practice English related to ${contextLabel}.`;
		if (userName) {
			systemPrompt += `\n\nThe student's name is ${userName}. Address them by their name occasionally.`;
		}

		systemPrompt += `\n\nYour opening should be brief, friendly, and directive (2-3 sentences max):
1. Acknowledge what kind of conversation you'll be having based on the topic.
2. If it's a specific topic like daily-life or work, set up a quick roleplay scenario right away.
3. If it's "on-mind", ask an engaging open-ended question to get them talking.

Example tone: "Hello! Since we're practicing work conversations today, let's pretend I'm your colleague and we're discussing a new project. What's our main goal for this week?"`;

		const turns = [
			{
				role: 'user',
				parts: [{ text: 'Start the practice session.' }],
			},
		];

		logger.info('Generating topic greeting via Live API (Stream)...', { topic, model: LIVE_MODEL });

		return await generateWithLiveAPIStream(systemPrompt, turns);
	} catch (error: any) {
		logger.error('Error generating topic practice greeting (Stream)', { error: error.message, topic });
		throw new Error(`Failed to generate topic practice greeting: ${error.message}`);
	}
}

export async function generateTopicPracticeResponseStream(
	userMessage: string,
	conversationHistory: Array<{ role: 'user' | 'model'; content: string }> = [],
	topic: string = 'daily-life',
	userName?: string
): Promise<ReadableStream> {
	try {
		if (!config.GEMINI_API_KEY) {
			throw new Error('Gemini API is not configured');
		}

		const topicContexts: Record<string, string> = {
			'daily-life': 'You are Eklan, a friendly AI English tutor. Help the student practice everyday English conversations. Be natural, encouraging, and conversational.',
			'work-school': 'You are Eklan, a friendly AI English tutor. Help the student practice English for work and school situations. Focus on professional and academic language.',
			'on-mind': 'You are Eklan, a friendly AI English tutor. The student wants to talk about something on their mind. Be supportive, listen actively, and help them express themselves in English.',
			'surprise': 'You are Eklan, a friendly AI English tutor. Have a fun, engaging conversation with the student. Be creative and keep things interesting!',
		};

		let systemPrompt = topicContexts[topic] || topicContexts['daily-life'];
		if (userName) {
			systemPrompt += `\n\nThe student's name is ${userName}. Address them by their name occasionally to be friendly.`;
		}

		// Build conversation history for Live API turns
		let validHistory = conversationHistory;
		if (validHistory.length > 0 && validHistory[0].role === 'model') {
			const firstUserIndex = validHistory.findIndex((msg) => msg.role === 'user');
			if (firstUserIndex > 0) {
				validHistory = validHistory.slice(firstUserIndex);
			} else if (firstUserIndex === -1) {
				validHistory = [];
			}
		}

		const history = validHistory.map((msg) => ({
			role: msg.role === 'user' ? 'user' : 'model',
			parts: [{ text: msg.content }],
		}));

		const turns = [
			...history,
			{
				role: 'user',
				parts: [{ text: userMessage }],
			},
		];

		logger.info('Generating topic practice response via Live API (Stream)...', {
			topic,
			model: LIVE_MODEL,
			turnsCount: turns.length,
		});

		return await generateWithLiveAPIStream(systemPrompt, turns);

	} catch (error: any) {
		logger.error('Error generating topic practice response (Stream)', {
			error: error.message,
			stack: error.stack,
			topic,
		});
		throw new Error(`Failed to generate topic practice response: ${error.message}`);
	}
}

// ─── Gemini TTS (text-to-speech via generateContent) ─────────────────────────
// Native TTS returns PCM in inlineData (see https://ai.google.dev/gemini-api/docs/speech-generation).
// TTS model ids: see `config.GEMINI_TTS_MODEL_*` (default: try lighter 2.5 first, 3.1 as fallback).

/**
 * Per Gemini TTS docs, vague inputs can be rejected; 3.1 also occasionally returns
 * text tokens instead of audio. A short preamble reduces classifier / empty-part failures.
 */
function buildTtsPrompt(plain: string): string {
	const t = plain.trim();
	if (!t) return t;
	// Preamble: instruct synthesis; body is the line to read (not stage directions).
	return `Read the following line aloud in a clear, natural speaking voice. Read only the words in the quote, do not read these instructions.\n\n"""${t}"""`;
}

function extractPcmBase64FromTtsResponse(response: {
	candidates?: Array<{
		content?: { parts?: Array<{ inlineData?: { data?: string }; text?: string }> };
		finishReason?: string;
	}>;
}): { pcmBase64: string | null; finishReason?: string; partsLen: number } {
	const c0 = response.candidates?.[0];
	const parts = c0?.content?.parts;
	const n = parts?.length ?? 0;
	if (!parts?.length) {
		return { pcmBase64: null, finishReason: c0?.finishReason, partsLen: n };
	}
	for (const p of parts) {
		const d = p?.inlineData?.data;
		if (d) return { pcmBase64: d, finishReason: c0?.finishReason, partsLen: n };
	}
	return { pcmBase64: null, finishReason: c0?.finishReason, partsLen: n };
}

async function generateTtsWithModel(
	model: string,
	text: string,
	voiceName: string,
): Promise<Buffer> {
	const response = await genAINew!.models.generateContent({
		model,
		contents: [{ parts: [{ text: buildTtsPrompt(text) }] }],
		config: {
			responseModalities: [Modality.AUDIO],
			speechConfig: {
				voiceConfig: {
					prebuiltVoiceConfig: { voiceName },
				},
			},
		},
	});
	const { pcmBase64, finishReason, partsLen } = extractPcmBase64FromTtsResponse(
		response as {
			candidates?: Array<{
				content?: { parts?: Array<{ inlineData?: { data?: string }; text?: string }> };
				finishReason?: string;
			}>;
		},
	);
	if (pcmBase64) {
		const wavBase64 = pcmToWavBase64(pcmBase64, 24000);
		return Buffer.from(wavBase64, 'base64');
	}
	const block = response.candidates?.[0] as { finishReason?: string; content?: unknown } | undefined;
	logger.error('Gemini TTS: no inline audio in response', {
		model,
		finishReason: block?.finishReason ?? finishReason,
		partsCount: partsLen,
		attempt: model,
	});
	throw new Error('Gemini TTS returned no audio data');
}

/**
 * Generate TTS audio using Gemini's native TTS model.
 * Returns a WAV audio Buffer (raw PCM wrapped in a RIFF/WAV header at 24 kHz).
 */
export async function generateGeminiTTSAudio(
	text: string,
	voiceName: string = 'Kore',
): Promise<Buffer> {
	if (!genAINew) {
		throw new Error('Gemini API is not configured');
	}
	try {
		return await generateTtsWithModel(config.GEMINI_TTS_MODEL_PRIMARY, text, voiceName);
	} catch (e) {
		logger.warn('Gemini TTS primary model failed, trying fallback', {
			primary: config.GEMINI_TTS_MODEL_PRIMARY,
			fallback: config.GEMINI_TTS_MODEL_FALLBACK,
			message: (e as Error)?.message,
		});
		return await generateTtsWithModel(config.GEMINI_TTS_MODEL_FALLBACK, text, voiceName);
	}
}
