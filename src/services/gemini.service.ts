import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI, Modality, type LiveServerMessage } from '@google/genai';
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';

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
const DEFAULT_MODEL = 'gemini-2.0-flash';

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

			// Send audio via sendRealtimeInput
			session.sendRealtimeInput({
				audio: {
					data: audioBase64,
					mimeType,
				},
			});

			// Signal end of audio input
			session.sendClientContent({ turnComplete: true });

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

function buildDrillPracticePrompt(drill: DrillPracticeOptions['drill'], pronunciationWeaknesses?: string[]): string {
	// ═══ LAYER 1 — Identity ═══
	let prompt = `You are Eklan, an AI English speaking practice partner. The student has been assigned a ${drill.type === 'roleplay' ? 'roleplay' : drill.type} drill by their human tutor.`;

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
export async function generateDrillPracticeResponse(options: DrillPracticeOptions): Promise<{
	text: string;
	audioBase64: string | null;
	audioMimeType: string | null;
}> {
	try {
		if (!config.GEMINI_API_KEY) {
			throw new Error('Gemini API is not configured');
		}

		const { drill, userMessage, conversationHistory = [], pronunciationWeaknesses } = options;

		const systemPrompt = buildDrillPracticePrompt(drill, pronunciationWeaknesses);

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

		logger.info('Generating drill practice response via Live API...', {
			drillType: drill.type,
			model: LIVE_MODEL,
			turnsCount: turns.length,
		});

		const liveResult = await generateWithLiveAPI(systemPrompt, turns);

		logger.info('Drill practice response generated', {
			drillType: drill.type,
			drillTitle: drill.title,
			responseLength: liveResult.text.length,
			hasAudio: !!liveResult.audioBase64,
		});

		return {
			text: liveResult.text,
			audioBase64: liveResult.audioBase64 || null,
			audioMimeType: liveResult.audioMimeType || null,
		};
	} catch (error: any) {
		logger.error('Error generating drill practice response', {
			error: error.message,
			stack: error.stack,
			drillType: options.drill.type,
		});
		throw new Error(`Failed to generate drill practice response: ${error.message}`);
	}
}

/**
 * Generate initial greeting for drill-aware conversation with native audio.
 * Uses ONLY the Live API — single model for both text + audio.
 */
export async function generateDrillPracticeGreeting(drill: DrillPracticeOptions['drill']): Promise<{
	text: string;
	audioBase64: string | null;
	audioMimeType: string | null;
}> {
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

		const systemPrompt = `You are Eklan, an AI English speaking practice partner. The student has been assigned a ${label} drill by their human tutor.

DRILL: "${drill.title}" (${drill.difficulty || 'intermediate'} level)${drill.context ? `\nContext: ${drill.context}` : ''}

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

		logger.info('Generating greeting via Live API...', { drillType: drill.type, model: LIVE_MODEL });

		const liveResult = await generateWithLiveAPI(systemPrompt, turns);

		logger.info('Greeting generated via Live API', {
			textLength: liveResult.text.length,
			hasAudio: !!liveResult.audioBase64,
			textPreview: liveResult.text.substring(0, 80),
		});

		return {
			text: liveResult.text,
			audioBase64: liveResult.audioBase64 || null,
			audioMimeType: liveResult.audioMimeType || null,
		};
	} catch (error: any) {
		logger.error('Error generating drill practice greeting', {
			error: error.message,
			drillType: drill.type,
		});
		return {
			text: `Alright! Today we're working on "${drill.title}". I've got some exercises ready for you. Let's jump right in!`,
			audioBase64: null,
			audioMimeType: null,
		};
	}
}
