import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI, Modality, type LiveServerMessage } from '@google/genai';
import { spawn } from "child_process";
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';
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

// Text model (for non-drill functions — cheaper, no "thinking" overhead)
const DEFAULT_MODEL = 'gemini-2.5-flash';

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
 * Convert any audio format (m4a, webm, ogg, mp3, etc.) to raw PCM signed-16-bit
 * little-endian at 16 kHz mono — the exact format Gemini Live API expects for
 * `sendRealtimeInput`.  The output contains NO container header; it is raw
 * sample data.  Caller must use mimeType `audio/pcm;rate=16000`.
 *
 * Gemini Live docs: https://ai.google.dev/gemini-api/docs/live-guide#sending-audio
 * "Audio needs to be sent as raw PCM data (raw 16-bit PCM audio, 16kHz, little-endian)."
 */
async function convertAudioToRawPcm16k(audioBuffer: Buffer): Promise<Buffer> {
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

	return new ReadableStream({
		async start(controller) {
			// Helper to enqueue properly formatted JSON strings for SSE
			const sendChunk = (type: 'audio' | 'text', data: string) => {
				const chunk = JSON.stringify({ type, data });
				controller.enqueue(new TextEncoder().encode(`data: ${chunk}\n\n`));
			};

			const timeoutHandle = setTimeout(() => {
				if (!sessionClosed) {
					sessionClosed = true;
					logger.warn('Live API stream session timed out after 45s');
					try { session?.close(); } catch (e) { /* ignore */ }
					controller.close();
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
					},
					callbacks: {
						onopen: () => {
							logger.info('Live API WebSocket connected (Stream)', { elapsed: `${Date.now() - startTime}ms` });
						},
						onmessage: (message: LiveServerMessage) => {
							// 1. Send Audio Chunks IMMEDIATELY
							const data = message.data;
							if (data) {
								sendChunk('audio', data); // This is base64 PCM data
							}

							// 2. Send Output Transcription Text Chunks IMMEDIATELY
							if (message.serverContent?.outputTranscription?.text) {
								sendChunk('text', message.serverContent.outputTranscription.text);
							}

							// 3. Handle Turn Complete
							if (message.serverContent?.turnComplete) {
								logger.info('Live API turn complete (Stream)', { elapsed: `${Date.now() - startTime}ms` });
								clearTimeout(timeoutHandle);
								sessionClosed = true;
								try { session?.close(); } catch (e) { /* ignore */ }
								controller.close();
							}
						},
						onerror: (e: ErrorEvent) => {
							logger.error('Live API WebSocket error (Stream)', { error: e?.message || 'unknown' });
							clearTimeout(timeoutHandle);
							if (!sessionClosed) {
								sessionClosed = true;
								try { session?.close(); } catch (err) { /* ignore */ }
								controller.error(new Error(`Live API error: ${e?.message || 'WebSocket error'}`));
							}
						},
						onclose: (e: CloseEvent) => {
							logger.info('Live API WebSocket closed (Stream)', { code: e?.code, reason: e?.reason });
							clearTimeout(timeoutHandle);
							if (!sessionClosed) {
								sessionClosed = true;
								controller.close();
							}
						},
					},
				});

				session.sendClientContent({
					turns,
					turnComplete: true,
				});

			} catch (err: any) {
				clearTimeout(timeoutHandle);
				if (!sessionClosed) {
					sessionClosed = true;
					controller.error(new Error(`Failed to connect to Live API: ${err.message}`));
				}
			}
		}
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

function buildDrillPracticePrompt(drill: DrillPracticeOptions['drill'], pronunciationWeaknesses?: string[], userName?: string): string {
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
	if (drill.ai_character_names && drill.ai_character_names.length > 0) {
		prompt += `\n- AI plays: ${drill.ai_character_names.join(', ')}`;
	}

	// Scene descriptions (human-readable, not raw JSON)
	if (drill.roleplay_scenes && drill.roleplay_scenes.length > 0) {
		const sceneDescriptions = drill.roleplay_scenes.map((scene: any, i: number) => {
			const parts = [];
			if (scene.title || scene.name) parts.push(scene.title || scene.name);
			if (scene.description || scene.context) parts.push(scene.description || scene.context);
			if (scene.setting) parts.push(`Setting: ${scene.setting}`);
			return `  ${i + 1}. ${parts.join(' — ') || JSON.stringify(scene)}`;
		}).join('\n');
		prompt += `\n- The tutor created scenes about:\n${sceneDescriptions}`;
	}

	// Key dialogue patterns
	if (drill.roleplay_dialogue && drill.roleplay_dialogue.length > 0) {
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

	// ═══ LAYER 3 — Generation Instruction ═══
	if (drill.type === 'roleplay' || drill.type === 'scenario') {
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

		const { messages, temperature = 0.9, maxTokens = 1000 } = options;

		const model = genAI.getGenerativeModel({
			model: DEFAULT_MODEL,
			generationConfig: {
				temperature,
				maxOutputTokens: maxTokens,
			},
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
// Persistent-socket voice pipeline: mic audio → reused Gemini Live socket
// → audio + text SSE.  Each turn reuses the cached WS, saving ~1-2 s per turn.
//
// Key design decisions (per Google Live API docs):
//   1. Audio input MUST be raw PCM 16-bit, 16 kHz, little-endian mono.
//   2. Use sendRealtimeInput({ audio }) — enables automatic VAD + transcription.
//   3. Disable thinking (thinkingBudget: 0) for lowest latency.
//   4. Conversation context is maintained naturally by the live session.
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

	// Build system instruction — only used when a NEW session is opened.
	// On reused sessions the model already holds conversation context.
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

	// ② Get or create a cached WebSocket session (saves ~1-2 s per turn after the first).
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
	return new ReadableStream({
		start(controller) {
			const sendChunk = (type: 'audio' | 'text' | 'metadata', data: any) =>
				controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type, data })}\n\n`));

			const fullAssistantText: string[] = [];
			let fullUserText = '';
			let metadataSent = false;
			let streamClosed  = false;
			let tFirstChunk   = 0;
			let timeoutHandle: ReturnType<typeof setTimeout>;

			const closeStream = (reason?: string) => {
				if (streamClosed) return;
				streamClosed = true;
				clearTimeout(timeoutHandle);
				// Release the session back to the pool — do NOT close the WebSocket.
				entry.onTurnMessage = null;
				entry.onTurnError   = null;
				entry.onTurnClose   = null;
				if (entry.status === 'busy') entry.status = 'ready';
				if (reason) logger.info('[FreeTalk] stream closed', { reason });
				controller.close();
			};

			// Per-turn message handler
			entry.onTurnMessage = (message: LiveServerMessage) => {
				if (message.data) {
					if (!tFirstChunk) {
						tFirstChunk = Date.now();
						logger.info('[FreeTalk] ③ first audio chunk', { ms: tFirstChunk - tSession });
					}
					sendChunk('audio', message.data);
				}
				const inputText = (message.serverContent as any)?.inputTranscription?.text;
				if (inputText) fullUserText += inputText;

				const outputText = message.serverContent?.outputTranscription?.text;
				if (outputText) { fullAssistantText.push(outputText); sendChunk('text', outputText); }

				if (message.serverContent?.turnComplete && !metadataSent) {
					metadataSent = true;
					setTimeout(() => {
						if (streamClosed) return;
						logger.info('[FreeTalk] ④ turn complete', {
							totalMs:      Date.now() - t0,
							ffmpegMs:     tSession - t0,
							sessionMs:    tFirstChunk ? tFirstChunk - tSession : null,
							firstChunkMs: tFirstChunk ? tFirstChunk - tSession : null,
						});
						sendChunk('metadata', { fullText: fullAssistantText.join('').trim(), inputText: fullUserText.trim() });
						closeStream('turnComplete');
					}, 800);
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

			timeoutHandle = setTimeout(() => {
				if (!metadataSent) { metadataSent = true; sendChunk('metadata', { fullText: fullAssistantText.join('').trim(), inputText: fullUserText.trim(), error: 'timeout' }); }
				closeStream('timeout');
			}, 55000);

			// Send audio — session is already open
			entry.status = 'busy';
			entry.session.sendRealtimeInput({ audio: { data: pcmBase64, mimeType: 'audio/pcm;rate=16000' } });
			entry.session.sendRealtimeInput({ audioStreamEnd: true });
			logger.info('[FreeTalk] ②→③ audio sent', { pcmBytes, msSinceStart: Date.now() - t0 });
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
	} = options;

	if (!genAINew) throw new Error('Gemini Live API is not configured');

	const t0 = Date.now();

	// ① FFmpeg — convert to raw PCM 16 kHz.
	let pcmBuffer: Buffer;
	try {
		pcmBuffer = await convertAudioToRawPcm16k(audioBuffer);
		logger.info('[Drill] ① ffmpeg', { ms: Date.now() - t0, inBytes: audioBuffer.length, outBytes: pcmBuffer.length });
	} catch (e: any) {
		throw new Error(`Drill audio conversion failed: ${e?.message || 'ffmpeg error'}`);
	}
	const pcmBase64 = pcmBuffer.toString('base64');
	const pcmBytes  = pcmBuffer.length;

	// Build system instruction — only used when a NEW session is opened.
	let systemInstruction = buildDrillPracticePrompt(drill, pronunciationWeaknesses, userName);
	if (conversationHistory.length > 0) {
		const recent = conversationHistory.slice(-6);
		systemInstruction += '\n\nRecent conversation:\n' +
			recent.map(m => `${m.role === 'user' ? (userName || 'Student') : 'Eklan'}: ${m.content}`).join('\n');
	}
	systemInstruction += '\n\nIMPORTANT: The user is speaking via voice. Listen carefully, respond in spoken English. Keep responses concise (2-4 sentences). No JSON or markdown.';

	// ② Get or create a cached WebSocket session per user+drill.
	const cacheKey = (userId && drillId) ? `drill_${userId}_${drillId}` : `drill_anon_${Date.now()}`;
	const tSession = Date.now();
	const entry = await getOrCreateLiveSession(cacheKey, LIVE_MODEL, {
		responseModalities: [Modality.AUDIO],
		speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
		systemInstruction: { parts: [{ text: systemInstruction }] },
		inputAudioTranscription: {},
		outputAudioTranscription: {},
		thinkingConfig: { thinkingBudget: 0 },
	});
	logger.info('[Drill] ② session ready', { ms: Date.now() - tSession });

	// ③ Create the SSE stream — session is already connected; just route messages.
	return new ReadableStream({
		start(controller) {
			const sendChunk = (type: 'audio' | 'text' | 'metadata', data: any) =>
				controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type, data })}\n\n`));

			const fullAssistantText: string[] = [];
			let fullUserText = '';
			let metadataSent = false;
			let streamClosed  = false;
			let tFirstChunk   = 0;
			let timeoutHandle: ReturnType<typeof setTimeout>;

			const closeStream = (reason?: string) => {
				if (streamClosed) return;
				streamClosed = true;
				clearTimeout(timeoutHandle);
				// Release the session back to the pool — do NOT close the WebSocket.
				entry.onTurnMessage = null;
				entry.onTurnError   = null;
				entry.onTurnClose   = null;
				if (entry.status === 'busy') entry.status = 'ready';
				if (reason) logger.info('[Drill] stream closed', { reason });
				controller.close();
			};

			entry.onTurnMessage = (message: LiveServerMessage) => {
				if (message.data) {
					if (!tFirstChunk) {
						tFirstChunk = Date.now();
						logger.info('[Drill] ③ first audio chunk', { ms: tFirstChunk - tSession });
					}
					sendChunk('audio', message.data);
				}
				const inputText = (message.serverContent as any)?.inputTranscription?.text;
				if (inputText) fullUserText += inputText;

				const outputText = message.serverContent?.outputTranscription?.text;
				if (outputText) { fullAssistantText.push(outputText); sendChunk('text', outputText); }

				if (message.serverContent?.turnComplete && !metadataSent) {
					metadataSent = true;
					setTimeout(() => {
						if (streamClosed) return;
						logger.info('[Drill] ④ turn complete', {
							totalMs:      Date.now() - t0,
							ffmpegMs:     tSession - t0,
							sessionMs:    tFirstChunk ? tFirstChunk - tSession : null,
							firstChunkMs: tFirstChunk ? tFirstChunk - tSession : null,
						});
						sendChunk('metadata', {
							fullText:   fullAssistantText.join('').trim(),
							inputText:  fullUserText.trim(),
							drillType:  drill.type,
							drillTitle: drill.title,
						});
						closeStream('turnComplete');
					}, 800);
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

			timeoutHandle = setTimeout(() => {
				if (!metadataSent) { metadataSent = true; sendChunk('metadata', { fullText: fullAssistantText.join('').trim(), inputText: fullUserText.trim(), error: 'timeout' }); }
				closeStream('timeout');
			}, 60000);

			// Send audio — session is already open
			entry.status = 'busy';
			entry.session.sendRealtimeInput({ audio: { data: pcmBase64, mimeType: 'audio/pcm;rate=16000' } });
			entry.session.sendRealtimeInput({ audioStreamEnd: true });
			logger.info('[Drill] ②→③ audio sent', { pcmBytes, msSinceStart: Date.now() - t0 });
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

		const { drill, userMessage, conversationHistory = [], pronunciationWeaknesses, userName } = options;

		const systemPrompt = buildDrillPracticePrompt(drill, pronunciationWeaknesses, userName);

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

export async function generateDrillPracticeGreetingStream(drill: DrillPracticeOptions['drill'], userName?: string): Promise<ReadableStream> {
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

		systemPrompt += `\n\nDRILL: "${drill.title}" (${drill.difficulty || 'intermediate'} level)${drill.context ? `\nContext: ${drill.context}` : ''}

Your opening should be brief and directive (2-3 sentences max):
1. Tell the student what today's session is about
2. Create a FRESH scenario related to the drill topic (don't repeat the tutor's exact scenes)
3. Immediately set the scene and give them their FIRST task

CRITICAL: Do NOT ask "What would you like to practice?" — YOU lead the session. Jump right into a new scenario.
Example tone: "Alright! Today we're working on office negotiation. I'm going to set up a scenario for you — you're an employee asking your manager for a deadline extension. Let's begin. I'll be your manager. Go ahead and start the conversation."`;

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
