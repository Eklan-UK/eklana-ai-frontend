/**
 * Clinic-scoped AI generation: calls the shared drill generator where possible
 * and maps Drill-shaped output into Precision Clinic document fields.
 * Adds a dedicated listening generator (not present on the shared drill AI tools).
 */
import OpenAI from 'openai';
import { generateDrill } from '@/domain/drills/ai-drill-generator.service';
import type {
	PrecisionClinicDrillType,
	ClinicSoundGroup,
	ClinicKeyPhraseQuestion,
	ClinicMatchingPair,
	ClinicGrammarPattern,
	ClinicSentenceWritingWord,
} from './types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ClinicAiGenerateParams = {
	drillType: PrecisionClinicDrillType;
	difficulty: string;
	context: string;
	prompt: string;
	studentContext?: object;
	drillWeaknesses?: object[];
	studentName?: string;
};

export type ClinicAiGeneratedResult = {
	drillType: PrecisionClinicDrillType;
	content: Record<string, unknown>;
};

function mapPronunciation(
	raw: Record<string, unknown>
): { soundGroups: ClinicSoundGroup[] } {
	const items = (raw.pronunciation_items as Array<{
		sound?: string;
		word?: string;
		sentence?: string;
	}>) ?? [];

	const bySound = new Map<string, ClinicSoundGroup['words']>();
	for (const item of items) {
		const targetSound = (item.sound ?? '').trim() || '—';
		const word = (item.word ?? '').trim();
		const practiceSentence = (item.sentence ?? '').trim();
		if (!word && !practiceSentence) continue;
		const list = bySound.get(targetSound) ?? [];
		list.push({ word, practiceSentence });
		bySound.set(targetSound, list);
	}

	const soundGroups: ClinicSoundGroup[] = Array.from(bySound.entries()).map(
		([targetSound, words]) => ({ targetSound, words })
	);
	return { soundGroups };
}

function mapKeyPhrases(
	raw: Record<string, unknown>
): { questions: ClinicKeyPhraseQuestion[] } {
	const items = (raw.key_phrase_items as Array<{
		prompt?: string;
		respondentName?: string;
		options?: string[];
		correctAnswer?: string;
	}>) ?? [];

	const questions: ClinicKeyPhraseQuestion[] = items
		.filter((i) => (i.prompt ?? '').trim() && (i.correctAnswer ?? '').trim())
		.map((i) => ({
			respondentName: i.respondentName?.trim() || undefined,
			prompt: (i.prompt ?? '').trim(),
			options: Array.isArray(i.options)
				? i.options.map((o) => String(o).trim()).filter(Boolean)
				: [],
			correctAnswer: (i.correctAnswer ?? '').trim(),
		}));

	return { questions };
}

function mapMatching(
	raw: Record<string, unknown>
): { pairs: ClinicMatchingPair[] } {
	const items = (raw.matching_pairs as Array<{
		left?: string;
		right?: string;
		leftTranslation?: string;
		rightTranslation?: string;
	}>) ?? [];

	const pairs: ClinicMatchingPair[] = items
		.filter((i) => (i.left ?? '').trim() && (i.right ?? '').trim())
		.map((i) => ({
			left: (i.left ?? '').trim(),
			right: (i.right ?? '').trim(),
			leftTranslation: i.leftTranslation?.trim() || undefined,
			rightTranslation: i.rightTranslation?.trim() || undefined,
		}));

	return { pairs };
}

function mapGrammar(
	raw: Record<string, unknown>
): { patterns: ClinicGrammarPattern[] } {
	const items = (raw.grammar_items as Array<{
		pattern?: string;
		hint?: string;
		example?: string;
	}>) ?? [];

	const patterns: ClinicGrammarPattern[] = items
		.filter((i) => (i.pattern ?? '').trim() && (i.example ?? '').trim())
		.map((i) => ({
			pattern: (i.pattern ?? '').trim(),
			exampleSentence: (i.example ?? '').trim(),
			hint: i.hint?.trim() || undefined,
		}));

	return { patterns };
}

function mapSentenceWriting(
	raw: Record<string, unknown>
): { words: ClinicSentenceWritingWord[] } {
	const items = (raw.sentence_writing_items as Array<{
		word?: string;
		hint?: string;
	}>) ?? [];

	const words: ClinicSentenceWritingWord[] = items
		.filter((i) => (i.word ?? '').trim())
		.map((i) => ({
			word: (i.word ?? '').trim(),
			hint: i.hint?.trim() || undefined,
		}));

	return { words };
}

function mapSummary(raw: Record<string, unknown>): {
	articleTitle: string;
	articleContent: string;
} {
	return {
		articleTitle: String(raw.article_title ?? '').trim(),
		articleContent: String(raw.article_content ?? '').trim(),
	};
}

async function generateListeningContent(
	params: ClinicAiGenerateParams
): Promise<{ contentTitle: string; content: string }> {
	const context =
		params.context.length > 500 ? params.context.slice(0, 500) : params.context;
	const prompt =
		params.prompt.length > 10000 ? params.prompt.slice(0, 10000) : params.prompt;

	const response = await openai.chat.completions.create({
		model: 'gpt-5.5',
		messages: [
			{
				role: 'system',
				content:
					'Generate original, clinically appropriate listening practice content for nurses. Do not copy text verbatim from the prompt.',
			},
			{
				role: 'user',
				content: [
					`Generate listening drill content.\nDifficulty: ${params.difficulty}\nContext: ${context}\n${prompt}`,
					params.studentContext
						? `Student Context: ${JSON.stringify(params.studentContext)}`
						: null,
					params.drillWeaknesses?.length
						? `Student Weaknesses to target: ${JSON.stringify(params.drillWeaknesses)}`
						: null,
				]
					.filter(Boolean)
					.join('\n'),
			},
		],
		tools: [
			{
				type: 'function',
				function: {
					name: 'generate_listening',
					description: 'Generate listening drill content for Precision Clinic',
					parameters: {
						type: 'object',
						properties: {
							contentTitle: { type: 'string' },
							content: {
								type: 'string',
								description:
									'Markdown-friendly listening passage (dialogue or narrative)',
							},
						},
						required: ['contentTitle', 'content'],
					},
				},
			},
		],
		tool_choice: 'required',
		max_completion_tokens: 4000,
	});

	const toolCall = response.choices[0]?.message?.tool_calls?.[0];
	let parsed: Record<string, unknown> | undefined;
	if (toolCall && toolCall.type === 'function' && toolCall.function.arguments) {
		parsed = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
	} else if (response.choices[0]?.message?.content) {
		parsed = JSON.parse(response.choices[0].message.content) as Record<
			string,
			unknown
		>;
	}

	if (!parsed) {
		throw new Error('OpenAI did not return listening content');
	}

	return {
		contentTitle: String(parsed.contentTitle ?? '').trim(),
		content: String(parsed.content ?? '').trim(),
	};
}

/**
 * Generate Clinic-shaped content for one of the 7 clinic types.
 */
export async function generateClinicDrillContent(
	params: ClinicAiGenerateParams
): Promise<ClinicAiGeneratedResult> {
	const { drillType } = params;

	if (drillType === 'listening') {
		const content = await generateListeningContent(params);
		return { drillType, content };
	}

	const sharedType =
		drillType === 'pronunciation' ||
		drillType === 'key_phrases' ||
		drillType === 'matching' ||
		drillType === 'grammar' ||
		drillType === 'sentence_writing' ||
		drillType === 'summary'
			? drillType
			: null;

	if (!sharedType) {
		throw new Error(`Unsupported clinic drill type: ${drillType}`);
	}

	const raw = await generateDrill({
		drillType: sharedType as
			| 'pronunciation'
			| 'key_phrases'
			| 'matching'
			| 'grammar'
			| 'sentence_writing'
			| 'summary',
		difficulty: params.difficulty,
		context: params.context,
		prompt: params.prompt,
		studentContext: params.studentContext,
		drillWeaknesses: params.drillWeaknesses,
		studentName: params.studentName,
	});

	let content: Record<string, unknown>;
	switch (drillType) {
		case 'pronunciation':
			content = mapPronunciation(raw);
			break;
		case 'key_phrases':
			content = mapKeyPhrases(raw);
			break;
		case 'matching':
			content = mapMatching(raw);
			break;
		case 'grammar':
			content = mapGrammar(raw);
			break;
		case 'sentence_writing':
			content = mapSentenceWriting(raw);
			break;
		case 'summary':
			content = mapSummary(raw);
			break;
		default:
			content = {};
	}

	return { drillType, content };
}
