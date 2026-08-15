import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI, Modality, type LiveServerMessage } from '@google/genai';
import { spawn } from "child_process";
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';
import type { FreeTalkScenarioType } from '@/models/free-talk-scenario.shared';
import { GRADING_RUBRICS, type GradingBehaviour } from '@/domain/free-talk/free-talk-grading-rubrics';
// Bundled static binary — works in serverless environments where ffmpeg is not on PATH.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegBin: string = require('ffmpeg-static');

// Initialize old SDK (for non-drill functions that still use generateContent)
export let genAI: GoogleGenerativeAI | null = null;

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
export const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

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


// ─── PCM to WAV conversion ───────────────────────────────────────────────────
// Live API returns raw PCM L16 audio (24kHz, 16-bit, mono).
// Browsers can't play raw PCM, so we wrap it in a WAV header.

export function pcmToWavBase64(pcmBase64: string, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): string {
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

export function combineBase64Chunks(chunks: string[]): string {
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
	tools?: Array<{ name: string; description: string; parameters?: object }>,
	onToolCall?: (name: string, args: any) => void | Promise<void>,
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

			let receivedAnyChunk = false;
			let hasRetried = false;

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
						...(tools && tools.length > 0 ? { tools: [{ functionDeclarations: tools }] } : {}),
					},
					callbacks: {
						onopen: () => {
							logger.info('Live API WebSocket connected (Stream)', { elapsed: `${Date.now() - startTime}ms` });
						},
						onmessage: async (message: LiveServerMessage) => {
							if (sessionClosed) return;

							const data = message.data;
							if (data) {
								sendChunk('audio', data);
								receivedAnyChunk = true;
							}

							if (message.serverContent?.outputTranscription?.text) {
								sendChunk('text', message.serverContent.outputTranscription.text);
								receivedAnyChunk = true;
							}

							if (message.toolCall?.functionCalls?.length) {
								for (const call of message.toolCall.functionCalls) {
									try {
										if (onToolCall) {
											await onToolCall(call.name ?? '', call.args);
										} else {
											logger.info('Live API tool call received with no onToolCall handler (Stream)', {
												name: call.name,
											});
										}
									} catch (toolErr: any) {
										logger.error('Live API onToolCall handler threw (Stream)', {
											name: call.name,
											error: toolErr?.message,
										});
									}
									try {
										session.sendToolResponse({
											functionResponses: {
												id: call.id,
												name: call.name,
												response: { output: 'ok' },
											},
										});
									} catch { /* ignore */ }
								}
							}

							if (message.serverContent?.turnComplete) {
								if (!receivedAnyChunk && !hasRetried) {
									hasRetried = true;
									logger.warn('Live API turn complete with no chunks received, retrying once (Stream)', { elapsed: `${Date.now() - startTime}ms` });
									session.sendClientContent({ turns, turnComplete: true });
									return;
								}

								if (!receivedAnyChunk && hasRetried) {
									logger.error('Live API retry also returned an empty turn (Stream)', { elapsed: `${Date.now() - startTime}ms` });
								}

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

export class TranscriptionRejectedError extends Error {
	constructor(message: string = 'Transcription refused or failed') {
		super(message);
		this.name = 'TranscriptionRejectedError';
	}
}

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

		if (isFailedTranscription(text)) {
			logger.warn('Transcription refused or failed validation', { preview: text.substring(0, 80) });
			throw new TranscriptionRejectedError();
		}

		return text;
	} catch (error: any) {
		if (error instanceof TranscriptionRejectedError) {
			throw error;
		}
		logger.error('Error transcribing audio', { error: error.message });
		throw new Error(`Failed to transcribe audio: ${error.message}`);
	}
}

const REFUSAL_PATTERNS = [
	/^i'?m sorry,? but i (cannot|can'?t)/i,
	/^i cannot provide/i,
	/^i'?m unable to/i,
	/^i can'?t (transcribe|assist|help)/i,
	/^as an ai/i,
];

/**
 * Detects transcription output that is actually a model refusal or a
 * garbled/pathologically repetitive result rather than real spoken content.
 */
function isFailedTranscription(text: string): boolean {
	if (REFUSAL_PATTERNS.some((pattern) => pattern.test(text.trim()))) {
		return true;
	}

	const words = text.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return false;

	// Pathological repetition: same short phrase (3-8 words) repeating >4 times consecutively.
	for (let phraseLen = 3; phraseLen <= 8; phraseLen++) {
		let runLength = 1;
		for (let i = phraseLen; i + phraseLen <= words.length; i += phraseLen) {
			const prev = words.slice(i - phraseLen, i).join(' ').toLowerCase();
			const curr = words.slice(i, i + phraseLen).join(' ').toLowerCase();
			if (prev === curr) {
				runLength++;
				if (runLength > 4) return true;
			} else {
				runLength = 1;
			}
		}
	}

	// Low unique-word ratio on longer texts suggests a garbled/looping transcription.
	if (words.length > 100) {
		const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
		if (uniqueWords.size / words.length < 0.15) {
			return true;
		}
	}

	return false;
}

export type ListeningAnalyzeQuestion = Record<string, unknown>;

export interface ListeningComprehensionAnswer {
	questionId?: string | number;
	questionText: string;
	userAnswer: string;
	isCorrect: boolean;
	score: number;
	feedback?: string;
}

export interface ListeningComprehensionResult {
	transcription: string;
	overallScore: number;
	answers: ListeningComprehensionAnswer[];
	summary?: string;
}

function normalizeListeningQuestions(raw: unknown[]): Array<{
	id: string | number;
	prompt: string;
	correctAnswer?: string;
	options?: string[];
}> {
	return raw.map((q, index) => {
		if (typeof q === 'string') {
			return { id: index, prompt: q };
		}
		if (q && typeof q === 'object') {
			const o = q as Record<string, unknown>;
			const prompt = String(o.question ?? o.text ?? o.prompt ?? '');
			const ca = o.correctAnswer ?? o.answer ?? o.expected;
			const options = Array.isArray(o.options) ? (o.options as unknown[]).map(String) : undefined;
			return {
				id: (o.id as string | number) ?? index,
				prompt,
				correctAnswer: ca != null && ca !== '' ? String(ca) : undefined,
				options,
			};
		}
		return { id: index, prompt: String(q) };
	});
}

/**
 * Score spoken answers to listening-comprehension questions using Gemini (inline audio).
 */
export async function analyzeListeningComprehension(
	audioBuffer: Buffer,
	questions: unknown[],
	options: { mimeType?: string } = {}
): Promise<ListeningComprehensionResult> {
	try {
		if (!genAI) {
			throw new Error('Gemini API is not configured');
		}
		if (!Array.isArray(questions) || questions.length === 0) {
			throw new Error('At least one question is required');
		}

		const mimeType = options.mimeType ?? 'audio/webm';
		const normalized = normalizeListeningQuestions(questions);

		logger.info('Analyzing listening comprehension', {
			audioBytes: audioBuffer.length,
			mimeType,
			questionCount: normalized.length,
		});

		const model = genAI.getGenerativeModel({
			model: DEFAULT_MODEL,
			generationConfig: {
				temperature: 0.2,
				maxOutputTokens: 3000,
			},
		});

		const base64Audio = audioBuffer.toString('base64');

		const prompt = `You are an English listening comprehension evaluator.

The student listened to instructional audio (not attached here) and recorded ONE audio clip with their spoken answers to the questions below.

Questions (JSON — use "prompt" as the question text; "correctAnswer" when present is the reference; "options" may list choices for multiple-choice style items):
${JSON.stringify(normalized, null, 2)}

Listen to the student's audio. Map their speech to each question (order or explicit references). If they only partially answered, score accordingly.

Return ONLY valid JSON with this exact shape:
{
  "transcription": "verbatim or best-effort transcript of the student's speech",
  "overallScore": <integer 0-100>,
  "answers": [
    {
      "questionId": <optional, same as id from input>,
      "questionText": <string, repeat the prompt>,
      "userAnswer": <what they said for this item>,
      "isCorrect": <boolean>,
      "score": <integer 0-100 per question>,
      "feedback": <one short sentence>
    }
  ],
  "summary": <one sentence overview>
}

Include one entry in "answers" for every input question, in the same order as the questions array.`;

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

		const parsed = JSON.parse(jsonMatch[0]) as ListeningComprehensionResult;
		if (typeof parsed.transcription !== 'string' || typeof parsed.overallScore !== 'number' || !Array.isArray(parsed.answers)) {
			throw new Error('Invalid listening comprehension response shape');
		}

		return parsed;
	} catch (error: any) {
		logger.error('Error analyzing listening comprehension', { error: error.message });
		throw new Error(`Failed to analyze listening comprehension: ${error.message}`);
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

	// Build system instruction first (sync, no I/O) so it's ready before the
	// parallel awaits below.
	const persona = contextPrompt ||
		'You are Eklan, a friendly AI English speaking practice partner. Your role is to have natural, encouraging conversations to help the student improve their English.';
	let systemInstruction = persona;
	if (userName) {
		systemInstruction += `\n\nThe student's real name is "${userName}". Always address them as "${userName}". This is their real name, not a roleplay character.`;
	}
	systemInstruction += '\n\nRespond naturally in spoken English. Keep replies concise (2-4 sentences). Be warm and encouraging.';
	if (conversationHistory.length > 0) {
		const recent = conversationHistory.slice(-6);
		systemInstruction += '\n\nRecent conversation:\n' +
			recent.map(m => `${m.role === 'user' ? (userName || 'Student') : 'Eklan'}: ${m.content}`).join('\n');
	}

	// ①+② Run FFmpeg conversion and Live session connect in parallel — mirrors the
	// drill pipeline. Session creation (~500-970 ms) overlaps with FFmpeg (~50-280 ms),
	// reducing total startup latency by up to ~970 ms.
	const cacheKey = userId ? `freetalk_${userId}` : `freetalk_anon_${Date.now()}`;
	const tSession = Date.now();
	let pcmBuffer: Buffer;
	let entry: LiveSessionEntry;
	try {
		[pcmBuffer, entry] = await Promise.all([
			convertAudioToRawPcm16k(audioBuffer).catch((e: any) => {
				throw new Error(`Audio conversion failed: ${e?.message || 'ffmpeg error'}`);
			}),
		getOrCreateLiveSession(cacheKey, LIVE_MODEL, {
			responseModalities: [Modality.AUDIO],
			speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
			systemInstruction: { parts: [{ text: systemInstruction }] },
			inputAudioTranscription: {},
			outputAudioTranscription: {},
			thinkingConfig: { thinkingBudget: 0 },
			// Disable server-side VAD so it doesn't fire on natural pauses
			// mid-recording for long inputs. We signal activity start/end manually.
			realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
		}),
	]);
} catch (e: any) {
	throw e;
}
logger.info('[FreeTalk] ①+② ffmpeg+session ready (parallel)', {
	totalMs: Date.now() - t0,
	inBytes: audioBuffer.length,
	outBytes: pcmBuffer.length,
});
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

		// Send audio bracketed by manual activity signals so the server-side VAD
		// (which is disabled in the session config) does not fire on natural pauses
		// mid-recording. activityStart → chunks → activityEnd tells Gemini exactly
		// when the pre-recorded speech starts and ends.
		entry.status = 'busy';
		entry.session.sendRealtimeInput({ activityStart: {} });
		const PCM_CHUNK_BYTES = 16_000;
		for (let offset = 0; offset < pcmBuffer.length; offset += PCM_CHUNK_BYTES) {
			const slice = pcmBuffer.subarray(offset, offset + PCM_CHUNK_BYTES);
			entry.session.sendRealtimeInput({ audio: { data: slice.toString('base64'), mimeType: 'audio/pcm;rate=16000' } });
		}
		entry.session.sendRealtimeInput({ activityEnd: {} });
		logger.info('[FreeTalk] ②→③ audio sent (manual VAD)', { pcmBytes: pcmBuffer.length, chunks: Math.ceil(pcmBuffer.length / PCM_CHUNK_BYTES), msSinceStart: Date.now() - t0 });
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

// ─── Single-turn chat model stream helper ────────────────────────────────────

/**
 * Sends a single prompt to the Gemini chat model and returns a ReadableStream
 * of SSE chunks: `data: {"type":"text","data":"..."}\n\n`.
 * Used for structured evaluation tasks (e.g. grading) that don't need Live API.
 */
async function generateWithChatModelStream(prompt: string): Promise<ReadableStream<Uint8Array>> {
	if (!genAI) throw new Error('Gemini API is not configured');

	const model = genAI.getGenerativeModel({
		model: CHAT_MODEL,
		generationConfig: { temperature: 0.4, maxOutputTokens: 1500 },
	});

	const encoder = new TextEncoder();

	return new ReadableStream({
		async start(controller) {
			const send = (obj: { type: string; data: unknown }) => {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
			};
			try {
				const result = await model.generateContentStream(prompt);
				for await (const chunk of result.stream) {
					const piece = chunk.text();
					if (piece) send({ type: 'text', data: piece });
				}
			} catch (e: any) {
				logger.error('[FreeTalk] Chat model stream error', { error: e?.message });
				send({ type: 'error', data: { message: e?.message ?? 'Stream error' } });
			} finally {
				controller.close();
			}
		},
	});
}

// ─── Eklan Free Talk (ICU scenario practice — grade-based) ───────────────────

export interface FreeTalkScenario {
	title: string;
	situation: string;
	hint: string;
	usefulPhrases: string[];
	scenarioType: FreeTalkScenarioType;
	/** Admin-defined bullets — woven into the grading prompt when present. */
	include?: string[];
}

function freeTalkBehavioursForScenario(scenario: FreeTalkScenario): GradingBehaviour[] {
	return GRADING_RUBRICS[scenario.scenarioType] ?? GRADING_RUBRICS.icu_emergency;
}

// ── Grading prompt ────────────────────────────────────────────────────────────

const GRADE_JSON_TOKEN = 'GRADE_JSON';

function buildFreeTalkGradingPrompt(
	scenario: FreeTalkScenario,
	userResponse: string,
	userName?: string,
): string {
	const behaviours = freeTalkBehavioursForScenario(scenario);
	const behaviourList = behaviours
		.map(b => `${b.id}. ${b.name}: ${b.description}`)
		.join('\n');

	const hintBlock =
		scenario.hint?.trim()
			? `\n\nInstructor hint (what good communication looks like in this scenario — use as grading context, not as a word-for-word checklist):\n${scenario.hint.trim()}`
			: '';

	const usefulPhrasesBlock =
		scenario.usefulPhrases && scenario.usefulPhrases.length > 0
			? `\n\nUseful phrases provided to the student (using these or close paraphrases should count positively toward relevant behaviours):\n${scenario.usefulPhrases.map(p => `- ${p}`).join('\n')}`
			: '';

	const includeBlock =
		scenario.include && scenario.include.length > 0
			? `\n\nAdmin scoring checklist — instructor-defined points the response should cover:\n${scenario.include.map(p => `- ${p}`).join('\n')}\nWhen a bullet is clearly addressed (exact wording, close paraphrase, or equivalent clinical meaning), treat that as strong evidence for "full" or "partial" on the rubric behaviours it supports. Missing checklist items may lower scores on relevant behaviours but do not require separate JSON fields.`
			: '';

	let p = `You are Eklan, a fair and supportive ICU clinical communication evaluator. Assess what the student actually said; give honest, personalized scores and constructive feedback.

Scenario: ${scenario.title}
Situation: ${scenario.situation}${hintBlock}${usefulPhrasesBlock}${includeBlock}

The student responded with:
"${userResponse}"

STEP 1 — RELEVANCE CHECK (do this first, silently):
For each of the 4 rubric behaviours below, decide if it is testable in THIS scenario and response:
- "relevant": expected and meaningful here
- "not_applicable": cannot reasonably be demonstrated (e.g. ICU escalation language in casual small talk). Use sparingly — only when the behaviour truly does not fit this custom scenario.

STEP 2 — SCORING RULES (relevant behaviours only):
- "full"    → clearly demonstrated OR reasonably paraphrased, including natural use of provided useful phrases or coverage of admin checklist points that map to this behaviour (1 point)
- "partial" → genuinely attempted — brief, incomplete, or future intent ("I will…", "I would…"); shows appropriate concern, clarity, or professionalism even if not perfect (0.5 points)
- "none"    → relevant but absent or off-topic for that behaviour (0 points)

For "not_applicable" behaviours: set result to "not_applicable" in the JSON (excluded from the score).

IMPORTANT:
- Future-tense statements ("I will give oxygen", "I would call the doctor") COUNT as partial for the relevant behaviour.
- Only mark ALL relevant behaviours "none" if the response is empty, incoherent, or wholly off-topic.
- Award "full" when the behaviour is clearly shown OR reasonably paraphrased — you do not need the student's exact rubric wording.
- Using provided useful phrases and covering admin checklist bullets should positively affect behaviour results where they apply.
- Do not penalize asking a question and continuing in the same turn; this is a one-way response, not live dialogue.

The 4 rubric behaviours:
${behaviourList}

Write 2–4 sentences of feedback:
- Start by acknowledging genuine strengths or partial attempts (reference their actual words).
- Then note specific gaps and one concrete model phrase or sentence they could use next time.
- Keep a balanced, encouraging tone — not purely punitive.
- Tie praise and critique to relevant behaviours, useful phrases, and checklist coverage where applicable.

Then output the exact token ${GRADE_JSON_TOKEN} on its own line, followed immediately by valid JSON in exactly this structure (example shows mixed results — yours must reflect the actual response):
{
  "behaviours": [
    { "id": 1, "result": "full" },
    { "id": 2, "result": "partial" },
    { "id": 3, "result": "not_applicable" },
    { "id": 4, "result": "partial" }
  ]
}

Use "full", "partial", "none", or "not_applicable" as the result values. Respond in English only.`;

	if (userName) {
		p += `\n\nThe trainee's name is ${userName}. You may address them by name in your feedback.`;
	}
	return p;
}

// ── Grade result stream wrapper ───────────────────────────────────────────────

const COMPETENCY_LEVELS = [
	{ min: 90, label: 'Advanced Clinical Communicator' },
	{ min: 60, label: 'Safe & Effective Communicator' },
	{ min: 0, label: 'Need Improvement' },
] as const;

function scoreToCompetencyLevel(score: number): string {
	return (COMPETENCY_LEVELS.find(l => score >= l.min) ?? COMPETENCY_LEVELS[COMPETENCY_LEVELS.length - 1]).label;
}

/**
 * Wraps a Gemini text stream (emitting `text` SSE chunks) and extracts the
 * GRADE_JSON block. Text chunks before the token are forwarded to the client.
 * The token line and JSON block are stripped from the text stream, and a
 * single `metadata` SSE chunk is emitted at the end with the structured grade.
 */
function wrapWithGradingMetadata(
	textStream: ReadableStream,
	scenario: FreeTalkScenario,
): ReadableStream {
	const encoder = new TextEncoder();
	const decoder = new TextDecoder();
	const textParts: string[] = [];
	let gradeJson = '';
	let capturingJson = false;

	const transform = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			const raw = decoder.decode(chunk);
			if (!raw.startsWith('data: ')) {
				controller.enqueue(chunk);
				return;
			}
			let parsed: { type: string; data: unknown };
			try {
				parsed = JSON.parse(raw.slice(6).trimEnd());
			} catch {
				controller.enqueue(chunk);
				return;
			}

			if (parsed.type !== 'text') {
				controller.enqueue(chunk);
				return;
			}

			const incoming = (parsed.data as string) ?? '';

			// Once we've seen GRADE_JSON token, accumulate everything into gradeJson buffer
			if (capturingJson) {
				gradeJson += incoming;
				return;
			}

			// Check if this chunk contains the token
			if (incoming.includes(GRADE_JSON_TOKEN)) {
				capturingJson = true;
				// Split text before the token (emit it) and after (buffer as json)
				const [before, after] = incoming.split(GRADE_JSON_TOKEN);
				const cleanBefore = before.trim();
				if (cleanBefore) {
					textParts.push(cleanBefore);
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify({ type: 'text', data: cleanBefore })}\n\n`),
					);
				}
				if (after) gradeJson += after;
				return;
			}

			// Normal text chunk — forward as-is
			textParts.push(incoming);
			controller.enqueue(chunk);
		},
		flush(controller) {
			const fullText = textParts.join('').trim();
			const behaviours = freeTalkBehavioursForScenario(scenario);

			// Parse grade JSON — fall back gracefully if malformed
			let parsedBehaviours: Array<{ id: number; result: string }> = [];
			try {
				const jsonStart = gradeJson.indexOf('{');
				const jsonEnd = gradeJson.lastIndexOf('}');
				if (jsonStart !== -1 && jsonEnd !== -1) {
					const obj = JSON.parse(gradeJson.slice(jsonStart, jsonEnd + 1)) as {
						behaviours?: Array<{ id: number; result: string }>;
					};
					parsedBehaviours = Array.isArray(obj.behaviours) ? obj.behaviours : [];
				}
			} catch {
				logger.warn('[FreeTalk] Failed to parse grade JSON', { gradeJson });
			}

			const SCORE_MAP: Record<string, number> = { full: 1, partial: 0.5, none: 0 };
			const gradedBehaviours = behaviours.map(b => {
				const found = parsedBehaviours.find(p => p.id === b.id);
				const result = (found?.result ?? 'none') as 'full' | 'partial' | 'none' | 'not_applicable';
				return {
					id: b.id,
					name: b.name,
					result,
					score: result === 'not_applicable' ? 0 : (SCORE_MAP[result] ?? 0),
				};
			});

			const relevantBehaviours = gradedBehaviours.filter(b => b.result !== 'not_applicable');
			const relevantCount = relevantBehaviours.length || behaviours.length;
			const rawScore = relevantBehaviours.reduce((sum, b) => sum + b.score, 0);
			const overallScore = Math.round((rawScore / relevantCount) * 100);
			const competencyLevel = scoreToCompetencyLevel(overallScore);

			// Exclude not_applicable from client/API payload (attempts schema: full | partial | none only)
			const scorableBehaviours = gradedBehaviours.filter(b => b.result !== 'not_applicable');

			const metadata = {
				fullText,
				grade: {
					overallScore,
					competencyLevel,
					behaviours: scorableBehaviours,
					rawScore,
					maxScore: relevantCount,
				},
			};

			controller.enqueue(
				encoder.encode(`data: ${JSON.stringify({ type: 'metadata', data: metadata })}\n\n`),
			);
		},
	});

	return textStream.pipeThrough(transform);
}

// ── Exported grading function ─────────────────────────────────────────────────

/**
 * Grade with a fully-resolved scenario object (from admin-configured DB documents).
 */
export async function generateFreeTalkGradingStreamFromScenario(
	userResponse: string,
	scenario: FreeTalkScenario,
	userName?: string,
): Promise<ReadableStream> {
	if (!config.GEMINI_API_KEY) throw new Error('Gemini API is not configured');

	const prompt = buildFreeTalkGradingPrompt(scenario, userResponse, userName);

	logger.info('[FreeTalk] Generating grading stream (from scenario object)', {
		scenario: scenario.title,
		scenarioType: scenario.scenarioType,
		model: CHAT_MODEL,
	});

	const textStream = await generateWithChatModelStream(prompt);
	return wrapWithGradingMetadata(textStream, scenario);
}
