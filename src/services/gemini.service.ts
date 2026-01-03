import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';

// Initialize Gemini AI
let genAI: GoogleGenerativeAI | null = null;

if (config.GEMINI_API_KEY) {
	genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
} else {
	logger.warn('Gemini API key not configured. AI features will not work.');
}

// Default model - using Gemini 2.5 Flash for faster responses
const DEFAULT_MODEL = 'gemini-2.5-flash';

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

/**
 * Generate AI conversation response
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

		// Build conversation history for Gemini
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
 * Generate scenario-based conversation response
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

		// Natural, conversational prompts for English learning
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

		// Build conversation history
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

		// Start chat with system prompt and history
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

		// Send user message
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
 * Generate initial greeting for a scenario
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
		// Natural fallback greetings
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
