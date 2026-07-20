import OpenAI from 'openai';
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';

let openaiClient: OpenAI | null = null;

if (config.OPENAI_API_KEY) {
	openaiClient = new OpenAI({ apiKey: config.OPENAI_API_KEY });
} else {
	logger.warn('OpenAI API key not configured. Challenge generation will not work.');
}

const CHALLENGE_MODEL = process.env.OPENAI_CHALLENGE_MODEL?.trim() || 'gpt-5.5';

interface ChallengeCompletionOptions {
	systemInstruction?: string;
	prompt: string;
	maxCompletionTokens?: number;
}

/**
 * Generate structured JSON content for the weekly challenge using GPT-5.5.
 * Returns the raw response text (always valid JSON when response_format is json_object).
 */
export async function generateChallengeCompletion(
	options: ChallengeCompletionOptions,
): Promise<string> {
	if (!openaiClient) {
		throw new Error('OpenAI API is not configured');
	}

	const { systemInstruction, prompt, maxCompletionTokens = 10000 } = options;

	const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
	if (systemInstruction) {
		messages.push({ role: 'system', content: systemInstruction });
	}
	messages.push({ role: 'user', content: prompt });

	const client = openaiClient;

	const requestCompletion = async () => {
		const response = await client.chat.completions.create({
			model: CHALLENGE_MODEL,
			messages,
			max_completion_tokens: maxCompletionTokens,
			response_format: { type: 'json_object' },
		});

		return {
			text: response.choices[0]?.message?.content,
			promptTokens: response.usage?.prompt_tokens,
			completionTokens: response.usage?.completion_tokens,
			finishReason: response.choices[0]?.finish_reason,
		};
	};

	let result = await requestCompletion();

	if (!result.text) {
		logger.warn('OpenAI returned an empty response, retrying once', {
			model: CHALLENGE_MODEL,
		});
		await new Promise((resolve) => setTimeout(resolve, 2000));
		result = await requestCompletion();
	}

	if (!result.text) {
		throw new Error('OpenAI returned empty response after retry');
	}

	logger.info('OpenAI challenge completion generated', {
		model: CHALLENGE_MODEL,
		promptTokens: result.promptTokens,
		completionTokens: result.completionTokens,
		finishReason: result.finishReason,
	});

	return result.text;
}
