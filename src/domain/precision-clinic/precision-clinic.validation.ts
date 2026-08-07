import { z } from 'zod';
import { isValidUserId } from '@/lib/api/user-id';
import {
	PRECISION_CLINIC_DRILL_TYPES,
	PRECISION_CLINIC_DIFFICULTIES,
} from '@/domain/precision-clinic/types';

const learnerIdSchema = z
	.string()
	.refine((id) => isValidUserId(id), {
		message: 'Each learner ID must be a valid ObjectId or UUID',
	});

const soundGroupSchema = z.object({
	targetSound: z.string().trim().min(1),
	words: z
		.array(
			z.object({
				word: z.string().trim().min(1),
				practiceSentence: z.string().trim().min(1),
			})
		)
		.default([]),
});

const keyPhraseQuestionSchema = z
	.object({
		respondentName: z.string().trim().optional(),
		prompt: z.string().trim().min(1),
		options: z.array(z.string().trim().min(1)).min(2),
		correctAnswer: z.string().trim().min(1),
	})
	.superRefine((data, ctx) => {
		if (!data.options.includes(data.correctAnswer)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'correctAnswer must be one of the options',
				path: ['correctAnswer'],
			});
		}
	});

const matchingPairSchema = z.object({
	left: z.string().trim().min(1),
	right: z.string().trim().min(1),
	leftTranslation: z.string().trim().optional(),
	rightTranslation: z.string().trim().optional(),
});

const grammarPatternSchema = z.object({
	pattern: z.string().trim().min(1),
	exampleSentence: z.string().trim().min(1),
	hint: z.string().trim().optional(),
});

const sentenceWritingWordSchema = z.object({
	word: z.string().trim().min(1),
	hint: z.string().trim().optional(),
});

const typeEnum = z.enum(PRECISION_CLINIC_DRILL_TYPES);
const difficultyEnum = z.enum(PRECISION_CLINIC_DIFFICULTIES);

export const createPrecisionClinicSchema = z
	.object({
		title: z.string().max(200).default(''),
		type: typeEnum,
		difficulty: difficultyEnum.optional(),
		context: z.string().optional(),
		completionDate: z
			.union([z.string().datetime(), z.null()])
			.optional(),
		durationDays: z.number().int().min(1).optional(),
		preGenerateAudio: z.boolean().optional(),
		ttsVoiceKey: z.string().nullable().optional(),
		assignedLearnerIds: z.array(learnerIdSchema).default([]),
		soundGroups: z.array(soundGroupSchema).optional(),
		questions: z.array(keyPhraseQuestionSchema).optional(),
		pairs: z.array(matchingPairSchema).optional(),
		patterns: z.array(grammarPatternSchema).optional(),
		words: z.array(sentenceWritingWordSchema).optional(),
		contentTitle: z.string().optional(),
		content: z.string().optional(),
		articleTitle: z.string().optional(),
		articleContent: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		if (data.type === 'pronunciation') {
			if (!data.soundGroups || data.soundGroups.length < 1) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Pronunciation drills require at least one sound group',
					path: ['soundGroups'],
				});
			}
		}
		if (data.type === 'key_phrases') {
			if (!data.questions || data.questions.length < 1) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Key phrases drills require at least one question',
					path: ['questions'],
				});
			}
		}
		if (data.type === 'matching') {
			if (!data.pairs || data.pairs.length < 1) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Matching drills require at least one pair',
					path: ['pairs'],
				});
			}
		}
		if (data.type === 'grammar') {
			if (!data.patterns || data.patterns.length < 1) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Grammar drills require at least one pattern',
					path: ['patterns'],
				});
			}
		}
		if (data.type === 'sentence_writing') {
			if (!data.words || data.words.length < 1) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Sentence writing drills require at least one word',
					path: ['words'],
				});
			}
		}
		if (data.type === 'listening') {
			if (!(data.contentTitle ?? '').trim() || !(data.content ?? '').trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Listening drills require contentTitle and content',
					path: ['content'],
				});
			}
		}
		if (data.type === 'summary') {
			if (
				!(data.articleTitle ?? '').trim() ||
				!(data.articleContent ?? '').trim()
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Summary drills require articleTitle and articleContent',
					path: ['articleContent'],
				});
			}
		}
	});

export const updatePrecisionClinicSchema = z.object({
	title: z.string().max(200).optional(),
	type: typeEnum.optional(),
	difficulty: difficultyEnum.optional(),
	context: z.string().optional(),
	completionDate: z.union([z.string().datetime(), z.null()]).optional(),
	durationDays: z.number().int().min(1).optional(),
	preGenerateAudio: z.boolean().optional(),
	ttsVoiceKey: z.string().nullable().optional(),
	assignedLearnerIds: z.array(learnerIdSchema).optional(),
	soundGroups: z.array(soundGroupSchema).optional(),
	questions: z.array(keyPhraseQuestionSchema).optional(),
	pairs: z.array(matchingPairSchema).optional(),
	patterns: z.array(grammarPatternSchema).optional(),
	words: z.array(sentenceWritingWordSchema).optional(),
	contentTitle: z.string().optional(),
	content: z.string().optional(),
	articleTitle: z.string().optional(),
	articleContent: z.string().optional(),
	isArchived: z.boolean().optional(),
});

export const assignPrecisionClinicSchema = z.object({
	userIds: z.array(learnerIdSchema).min(1),
});

export const aiGeneratePrecisionClinicSchema = z.object({
	students: z.array(learnerIdSchema).optional(),
	studentIds: z.array(learnerIdSchema).optional(),
	studentId: learnerIdSchema.optional(),
	title: z.string().max(200).optional(),
	drillTypes: z.array(typeEnum).min(1),
	difficulty: difficultyEnum.default('intermediate'),
	context: z.string().optional(),
	prompt: z.string().min(1),
});
