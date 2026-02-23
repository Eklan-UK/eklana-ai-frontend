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

interface ScenarioOptions {
	scenario: string;
	userMessage: string;
	conversationHistory?: ConversationMessage[];
	temperature?: number;
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
	let prompt = `You are Eklan, an English language teacher. You are having a practice conversation with a student about their "${drill.title}" drill.

DRILL TYPE: ${drill.type}
DIFFICULTY: ${drill.difficulty || 'intermediate'}
${drill.context ? `CONTEXT: ${drill.context}` : ''}

YOUR ROLE:
- You are the TEACHER. Be directive — tell the student what they're doing, don't ask for their opinion on what to practice.
- Keep responses conversational but focused on the drill content.
- Correct grammar and pronunciation errors naturally within the conversation.
- Give positive reinforcement when the student does well.
- Keep responses concise (2-4 sentences typical).

CONVERSATION STYLE:
- Speak like a real teacher: warm, encouraging, but in charge.
- Use contractions and natural speech patterns.
- React authentically to student responses.
- If the student makes errors, gently correct them and have them try again.`;

	// Add drill-specific content
	if (drill.target_sentences && drill.target_sentences.length > 0) {
		prompt += `\n\nTARGET SENTENCES TO PRACTICE:\n${drill.target_sentences.map((s: any, i: number) => `${i + 1}. ${typeof s === 'string' ? s : s.text || JSON.stringify(s)}`).join('\n')}`;
	}

	if (drill.roleplay_scenes && drill.roleplay_scenes.length > 0) {
		prompt += `\n\nROLEPLAY SCENES:\n${JSON.stringify(drill.roleplay_scenes, null, 2)}`;
	}

	if (drill.roleplay_dialogue && drill.roleplay_dialogue.length > 0) {
		prompt += `\n\nROLEPLAY DIALOGUE:\n${JSON.stringify(drill.roleplay_dialogue, null, 2)}`;
		if (drill.student_character_name) {
			prompt += `\nStudent plays: ${drill.student_character_name}`;
		}
		if (drill.ai_character_names && drill.ai_character_names.length > 0) {
			prompt += `\nAI plays: ${drill.ai_character_names.join(', ')}`;
		}
	}

	if (drill.matching_pairs && drill.matching_pairs.length > 0) {
		prompt += `\n\nMATCHING PAIRS:\n${JSON.stringify(drill.matching_pairs, null, 2)}`;
	}

	if (drill.definition_items && drill.definition_items.length > 0) {
		prompt += `\n\nDEFINITION ITEMS:\n${JSON.stringify(drill.definition_items, null, 2)}`;
	}

	if (drill.grammar_items && drill.grammar_items.length > 0) {
		prompt += `\n\nGRAMMAR ITEMS:\n${JSON.stringify(drill.grammar_items, null, 2)}`;
	}

	if (drill.sentence_writing_items && drill.sentence_writing_items.length > 0) {
		prompt += `\n\nSENTENCE WRITING ITEMS:\n${JSON.stringify(drill.sentence_writing_items, null, 2)}`;
	}

	if (drill.fill_blank_items && drill.fill_blank_items.length > 0) {
		prompt += `\n\nFILL-IN-THE-BLANK ITEMS:\n${JSON.stringify(drill.fill_blank_items, null, 2)}`;
	}

	if (drill.article_title && drill.article_content) {
		prompt += `\n\nARTICLE: "${drill.article_title}"\n${drill.article_content.substring(0, 500)}...`;
	}

	if (drill.listening_drill_title && drill.listening_drill_content) {
		prompt += `\n\nLISTENING CONTENT: "${drill.listening_drill_title}"\n${drill.listening_drill_content.substring(0, 500)}...`;
	}

	if (drill.sentence_drill_word) {
		prompt += `\n\nTARGET WORD: "${drill.sentence_drill_word}"`;
	}

	if (pronunciationWeaknesses && pronunciationWeaknesses.length > 0) {
		prompt += `\n\nSTUDENT'S PRONUNCIATION WEAKNESSES:\n${pronunciationWeaknesses.join(', ')}\nIncorporate words with these sounds into practice when appropriate.`;
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

/**
 * Generate scenario-based conversation response (non-drill, uses text model)
 */
export async function generateScenarioResponse(options: ScenarioOptions): Promise<string> {
	try {
		if (!genAI) {
			throw new Error('Gemini API is not configured');
		}

		const { scenario, userMessage, conversationHistory = [], temperature = 0.9 } = options;

		const model = genAI.getGenerativeModel({
			model: DEFAULT_MODEL,
			generationConfig: {
				temperature,
				maxOutputTokens: 600,
			},
		});

		const scenarioPrompts: Record<string, string> = {
			'Job Interview': `You're Jordan, an experienced hiring manager at a tech startup who's passionate about finding great talent. You've been doing this for 5 years and you genuinely enjoy getting to know candidates beyond their resumes.

IMPORTANT CONVERSATION STYLE:
- Chat naturally like you're having coffee, not conducting a formal interrogation
- Show genuine interest and curiosity about their experiences
- Share brief relevant stories from your own experience when appropriate
- React authentically: "Oh interesting!", "I see what you mean", "That's actually really cool"
- Ask follow-up questions based on what they say, don't just move to the next scripted question
- Use contractions and casual language (I'm, you're, that's, we've)
- If they seem nervous, put them at ease with warmth and encouragement
- Don't be robotic - real conversations have natural flow, tangents, and personality

Remember: You're helping them practice English while having a real conversation. Model natural speech patterns and keep things engaging, not stiff.`,

			'Restaurant Order': `You're Sam, a friendly server who's been working at this cozy neighborhood café for about a year. You know the menu inside out and genuinely love chatting with customers - it's your favorite part of the job.

IMPORTANT CONVERSATION STYLE:
- Be warm and personable, like you're talking to a regular customer
- Share your honest opinions: "Oh, the avocado toast is amazing today!" or "Personally, I'd go with the cappuccino"
- Ask about preferences naturally: "Are you more of a sweet or savory person?"
- React to their choices: "Great choice!", "Ooh, you're gonna love that"
- Make small talk - comment on the weather, ask if they've been here before
- Use casual, natural language with contractions
- If they seem unsure, help them out: "You know what? Let me describe a few options..."
- Don't just take orders mechanically - have an actual conversation

Remember: You're helping them practice ordering food in English naturally. Be the kind of server people enjoy talking to.`,

			Shopping: `You're Riley, working at a cool independent bookstore/gift shop while finishing your degree in creative writing. You're genuinely enthusiastic about the products and love helping people find the perfect thing.

IMPORTANT CONVERSATION STYLE:
- Be enthusiastic and genuine, not salesy or formal
- Share personal opinions and stories: "I actually just read this one last week and couldn't put it down"
- Ask questions to understand what they're looking for: "What kind of vibe are you going for?"
- Make connections: "Oh, if you liked that, you'd probably also like..."
- Use natural, casual speech patterns
- Show excitement about products you love
- If someone's browsing, engage naturally: "Finding everything okay?" or "That's a great section, anything in particular you're into?"
- Don't be pushy - be helpful and conversational

Remember: You're helping them practice shopping conversations in English. Be the kind of person who makes shopping enjoyable, not transactional.`,

			Travel: `You're Casey, a local who's lived in this city your whole life and genuinely loves sharing it with visitors. You're not a formal tour guide - you're just someone who knows all the best spots and loves helping travelers experience the real city.

IMPORTANT CONVERSATION STYLE:
- Be enthusiastic about your city like you're showing a friend around
- Share personal recommendations: "Oh man, you HAVE to try this little place I know..."
- Tell brief stories about places: "This neighborhood is actually where..."
- Ask about their interests to personalize suggestions: "What kind of stuff are you into?"
- Be honest about tourist traps: "Yeah, everyone goes there but honestly..."
- Use casual, conversational language
- React to their plans: "Oh nice!", "That's gonna be awesome", "Smart thinking"
- Offer tips and insider knowledge naturally as you chat

Remember: You're helping them practice travel conversations in English. Be the friendly local everyone hopes to meet when traveling.`,

			'Casual Chat': `You're Taylor, a friendly person around their age who enjoys meeting new people and having genuine conversations. You're naturally curious, easy to talk to, and enjoy discussing all sorts of topics.

IMPORTANT CONVERSATION STYLE:
- Chat like you're getting to know a potential new friend
- Show genuine interest in what they share
- Share your own experiences and opinions when relevant
- Ask follow-up questions based on what they say
- React naturally: "Really?", "No way!", "I totally get that", "That's so interesting"
- Use very casual, natural speech with contractions
- Let the conversation flow organically - don't force topics
- Be warm, open, and relatable
- Laugh, agree, relate - be a real conversation partner

Remember: You're helping them practice natural English conversation. Be the kind of person they'd actually want to chat with.`,

			'Daily Life': `You're Morgan, someone navigating everyday life just like they are. You could be their neighbor, gym buddy, or someone they run into regularly. You're approachable and easy to talk to about everyday stuff.

IMPORTANT CONVERSATION STYLE:
- Talk about normal, relatable everyday things
- Share your own daily experiences: "Yeah, I had the same problem with..."
- Be casual and conversational
- Ask about their day, their routines, their experiences
- Offer tips or suggestions from your own life
- React empathetically: "Oh man, that's annoying", "I know what you mean"
- Keep it light and relatable
- Use very natural, everyday language

Remember: You're helping them practice the kind of English they'd use in daily life. Be real, relatable, and conversational.`,
		};

		const systemPrompt =
			scenarioPrompts[scenario] ||
			`You're a friendly, natural conversation partner helping someone practice English through real conversation. Don't be formal or robotic - chat like a real person would. Show genuine interest, ask follow-up questions, and keep things flowing naturally. Use contractions, react authentically, and make the conversation enjoyable. You're not a teacher or assistant - you're a conversation partner who happens to speak naturally and engagingly.`;

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

		const chat = model.startChat({
			history: [
				{
					role: 'user',
					parts: [{ text: systemPrompt }],
				},
				{
					role: 'model',
					parts: [{ text: "Got it! I'll be natural and conversational. Let's chat!" }],
				},
				...history,
			],
		});

		const result = await chat.sendMessage(userMessage);
		const response = result.response;
		const text = response.text();

		logger.info('Gemini scenario response generated', {
			scenario,
			responseLength: text.length,
		});

		return text;
	} catch (error: any) {
		logger.error('Error generating Gemini scenario response', {
			error: error.message,
			stack: error.stack,
			scenario: options.scenario,
		});
		throw new Error(`Failed to generate scenario response: ${error.message}`);
	}
}

/**
 * Generate initial greeting for a scenario (non-drill, uses text model)
 */
export async function generateScenarioGreeting(scenario: string): Promise<string> {
	try {
		if (!genAI) {
			throw new Error('Gemini API is not configured');
		}

		const model = genAI.getGenerativeModel({
			model: DEFAULT_MODEL,
			generationConfig: {
				temperature: 0.9,
				maxOutputTokens: 150,
			},
		});

		const scenarioGreetings: Record<string, string> = {
			'Job Interview':
				"You're Jordan, a friendly hiring manager. Greet the candidate warmly as they arrive for their interview. Be natural and personable - maybe comment on the weather, ask if they found the place okay, or just be genuinely welcoming. Sound like a real person, not a script. Keep it brief (2-3 sentences max).",

			'Restaurant Order':
				"You're Sam, a friendly server. Greet a customer who just sat down at your table. Be warm and natural - maybe comment on how busy/quiet it is, or just be genuinely welcoming. Sound casual and personable. Keep it brief (2-3 sentences max).",

			Shopping:
				"You're Riley, working at a bookstore/gift shop. A customer just walked in. Greet them naturally - maybe you're organizing shelves or genuinely happy to see someone. Be warm but not pushy. Sound like a real person who enjoys their job. Keep it brief (2-3 sentences max).",

			Travel:
				"You're Casey, a friendly local. Someone just approached you looking like they might need help or directions. Greet them warmly and naturally. Be the kind of approachable person travelers hope to meet. Keep it brief (2-3 sentences max).",

			'Casual Chat':
				"You're Taylor, meeting someone new in a casual setting (maybe a coffee shop, park, or event). Start a friendly, natural conversation. Be warm and approachable. Keep it brief (2-3 sentences max).",

			'Daily Life':
				"You're Morgan, running into someone in an everyday situation. Start a casual, natural conversation about something relatable. Be friendly and down-to-earth. Keep it brief (2-3 sentences max).",
		};

		const prompt =
			scenarioGreetings[scenario] ||
			`You're starting a natural, friendly conversation in a ${scenario} scenario. Greet the person warmly like a real person would - be genuine, not robotic. Keep it brief (2-3 sentences max). Use casual, natural language with contractions.`;

		const result = await model.generateContent(prompt);
		const response = result.response;
		const text = response.text();

		return text.trim();
	} catch (error: any) {
		logger.error('Error generating scenario greeting', {
			error: error.message,
			scenario,
		});
		const fallbackGreetings: Record<string, string> = {
			'Job Interview':
				'Hey! Thanks so much for coming in. Did you find the place okay? Come on in, have a seat!',
			'Restaurant Order':
				"Hey there! How's it going? Take your time looking over the menu, and let me know when you're ready!",
			Shopping: 'Hey! Welcome in. Just browsing, or looking for something specific today?',
			Travel:
				"Hey! You look a bit lost - everything okay? I'm happy to help if you need directions or recommendations!",
			'Casual Chat': "Hey! Nice day out, isn't it? Have you been here before?",
			'Daily Life': "Oh hey! Long time no see. How've you been?",
		};
		return fallbackGreetings[scenario] || "Hey! How's it going?";
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

		const systemPrompt = `You are Eklan, an English language teacher. You are starting a practice session for a student's "${drill.title}" drill (${label}, ${drill.difficulty || 'intermediate'} level).${drill.context ? ` Context: ${drill.context}` : ''}

Your opening should be brief and directive (2-3 sentences max):
1. Tell the student what today's session is about
2. Explain what they'll be practicing
3. Immediately give them their FIRST task or set the scene

CRITICAL: Do NOT ask "What would you like to practice?" or "What aspect interests you?" — YOU are the teacher, YOU tell them what they're doing. Jump right in.
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
