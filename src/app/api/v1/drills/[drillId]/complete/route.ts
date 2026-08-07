// POST /api/v1/drills/[drillId]/complete
// Complete a drill and create an attempt record
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { Types } from 'mongoose';
import { z } from 'zod';
import { parseRequestBody } from '@/lib/api/request-parser';
import { validateRequest } from '@/lib/api/validation';
import { apiResponse, ValidationError } from '@/lib/api/response';
import { DrillService } from '@/domain/drills/drill.service';
import { DrillRepository } from '@/domain/drills/drill.repository';
import { AssignmentRepository } from '@/domain/assignments/assignment.repository';
import { AttemptRepository } from '@/domain/attempts/attempt.repository';
import { computeConfidenceMetrics } from '@/domain/confidence/confidence.service';
import { computePronunciationMetrics } from '@/domain/pronunciation/pronunciation.service';
import { computeProgressScorecard } from '@/domain/progress/progress-scorecard.service';
import { StreakService } from '@/services/streak.service';
import { persistPhonemesFromDrillSnapshot } from '@/domain/pronunciations/drill-phoneme-persistence.service';
import {
	buildDrillCompletionEffects,
	resolveDrillPassed,
} from '@/lib/drill/celebration-effects';

const completeSchema = z.object({
	drillAssignmentId: z.string().refine((id) => Types.ObjectId.isValid(id), {
		message: 'Drill assignment ID must be a valid MongoDB ObjectId',
	}),
	score: z.number().min(0).max(100),
	timeSpent: z.number().min(0),
	vocabularyResults: z.object({
		wordScores: z.array(z.object({
			word: z.string(),
			score: z.number(),
			attempts: z.number(),
			pronunciationScore: z.number().optional(),
		})),
	}).optional(),
	pronunciationResults: z.object({
		wordScores: z.array(z.object({
			word: z.string(),
			score: z.number(),
			attempts: z.number(),
			pronunciationScore: z.number().optional(),
		})),
	}).optional(),
	roleplayResults: z.object({
		sceneScores: z.array(z.object({
			sceneName: z.string(),
			score: z.number(),
			fluencyScore: z.number().optional(),
			pronunciationScore: z.number().optional(),
		})),
	}).optional(),
	matchingResults: z.object({
		pairsMatched: z.number(),
		totalPairs: z.number(),
		accuracy: z.number(),
		incorrectPairs: z.array(z.object({
			left: z.string(),
			right: z.string(),
			attemptedMatch: z.string(),
		})).optional(),
		pairMatchEvents: z.array(z.object({
			durationSec: z.number(),
			left: z.string(),
			right: z.string(),
		})).optional(),
	}).optional(),
	definitionResults: z.object({
		wordsDefined: z.number(),
		totalWords: z.number(),
		accuracy: z.number(),
		wordScores: z.array(z.object({
			word: z.string(),
			score: z.number(),
			attempts: z.number(),
		})),
	}).optional(),
	grammarResults: z.union([
		z.object({
			patternsPracticed: z.number(),
			totalPatterns: z.number(),
			accuracy: z.number(),
			patternScores: z.array(z.object({
				pattern: z.string(),
				score: z.number(),
				attempts: z.number(),
			})),
		}),
		z.object({
			patterns: z.array(z.object({
				pattern: z.string(),
				example: z.string(),
				hint: z.string().optional(),
				sentences: z.array(z.object({
					text: z.string(),
					index: z.number(),
				})),
			})),
			reviewStatus: z.enum(['pending', 'reviewed']).default('pending'),
		}),
	]).optional(),
	sentenceWritingResults: z.object({
		sentencesWritten: z.number(),
		totalSentences: z.number(),
		accuracy: z.number(),
		wordScores: z.array(z.object({
			word: z.string(),
			score: z.number(),
			attempts: z.number(),
		})),
	}).optional(),
	sentenceResults: z.object({
		word: z.string(),
		definition: z.string(),
		sentences: z.array(z.object({
			text: z.string(),
			index: z.number(),
		})),
		words: z.array(z.object({
			word: z.string(),
			definition: z.string(),
			sentences: z.array(z.object({
				text: z.string(),
				index: z.number(),
			})),
		})).optional(),
		reviewStatus: z.enum(['pending', 'reviewed']).default('pending'),
	}).optional(),
	summaryResults: z.object({
		summaryProvided: z.boolean(),
		articleTitle: z.string().optional(),
		articleContent: z.string().optional(),
		summary: z.string().optional(),
		wordCount: z.number().optional(),
		score: z.number().optional(),
		qualityScore: z.number().optional(),
		reviewStatus: z.enum(['pending', 'reviewed']).default('pending'),
	}).optional(),
	listeningResults: z.object({
		completed: z.boolean(),
		timeSpent: z.number(),
	}).optional(),
	fillBlankResults: z.object({
		items: z.array(
			z.object({
				sentence: z.string(),
				blanks: z.array(
					z.object({
						position: z.number(),
						selectedAnswer: z.string(),
						correctAnswer: z.string(),
						isCorrect: z.boolean(),
					})
				),
			})
		).optional(),
		totalBlanks: z.number().optional(),
		correctBlanks: z.number().optional(),
		score: z.number().optional(),
	}).optional(),
	keyPhrasesResults: z.object({
		items: z.array(
			z.object({
				prompt: z.string(),
				selectedAnswer: z.string(),
				correctAnswer: z.string(),
				isCorrect: z.boolean(),
				pronunciationScore: z.number().optional(),
				textScore: z.record(z.string(), z.unknown()).optional(),
				attempts: z.number(),
			})
		),
		totalItems: z.number(),
		correctItems: z.number(),
		score: z.number(),
	}).optional(),
	deviceInfo: z.string().optional(),
	platform: z.enum(['web', 'ios', 'android']).optional(),
	performanceReviewSnapshot: z
		.object({
			version: z.literal(1),
			ui: z.enum(['drillPerformance', 'roleplay']),
			avgScore: z.number(),
			statsLine: z.string(),
			passThreshold: z.number(),
			sectionHeading: z.string(),
			groups: z.array(z.any()),
		})
		.passthrough()
		.optional(),
});

async function handler(
	req: NextRequest,
	context: { userId: string; userRole: string },
	params: { drillId: string }
) {
	await connectToDatabase();

	const { drillId } = params;

	if (!Types.ObjectId.isValid(drillId)) {
		throw new ValidationError('Invalid drill ID format');
	}

	const body = await parseRequestBody(req);
	const validated = validateRequest(completeSchema, body);

	// Initialize services
	const drillRepo = new DrillRepository();
	const assignmentRepo = new AssignmentRepository();
	const attemptRepo = new AttemptRepository();
	const drillService = new DrillService(drillRepo, assignmentRepo, attemptRepo);

	// Complete drill
	const result = await drillService.completeDrill(drillId, {
		drillId,
		drillAssignmentId: validated.drillAssignmentId,
		learnerId: context.userId.toString(),
		score: validated.score,
		timeSpent: validated.timeSpent,
		results: {
			vocabularyResults: validated.vocabularyResults,
			pronunciationResults: validated.pronunciationResults,
			roleplayResults: validated.roleplayResults,
			matchingResults: validated.matchingResults,
			definitionResults: validated.definitionResults,
			grammarResults: validated.grammarResults,
			sentenceWritingResults: validated.sentenceWritingResults,
			sentenceResults: validated.sentenceResults,
			summaryResults: validated.summaryResults,
			listeningResults: validated.listeningResults,
			fillBlankResults: validated.fillBlankResults,
			keyPhrasesResults: validated.keyPhrasesResults,
			performanceReviewSnapshot: validated.performanceReviewSnapshot,
			deviceInfo: validated.deviceInfo,
			platform: validated.platform,
		},
	});


	if (validated.performanceReviewSnapshot) {
		const passThreshold = validated.performanceReviewSnapshot.passThreshold ?? 70;
		void persistPhonemesFromDrillSnapshot({
			learnerId: context.userId.toString(),
			drillAttemptId: result.attempt._id.toString(),
			drillId,
			snapshot: validated.performanceReviewSnapshot,
			passThreshold,
			drillType: result.attempt.drillType,
		}).catch(() => {});
	}

	// Fire-and-forget: recompute metrics and streak in background
	// Do not await — this must not block or throw to the user
	const userId = context.userId.toString();
	const userScore = validated.score;
	setImmediate(() => {
		void Promise.all([
			computeConfidenceMetrics(userId).catch(() => {}),
			computePronunciationMetrics(userId).catch(() => {}),
			computeProgressScorecard(userId).catch(() => {}),
			context.userRole === 'user'
				? StreakService.recordDrillCompletion(userId, userScore).catch(() => {})
				: Promise.resolve(),
		]);
	});

	let badgesUnlocked: import('@/lib/badges/badge-unlock').BadgeUnlockCelebration[] = [];
	if (context.userRole === 'user') {
		try {
			const { triggerBadgeEvaluation } = await import('@/services/streak.service');
			badgesUnlocked = await triggerBadgeEvaluation(userId);
		} catch {
			badgesUnlocked = [];
		}
	}

	const passed = resolveDrillPassed(validated.score, validated);
	const effects = buildDrillCompletionEffects(passed, validated.score);

	return apiResponse.success({
		drillId,
		passed,
		attempt: {
			id: result.attempt._id.toString(),
			score: result.attempt.score,
			timeSpent: result.attempt.timeSpent,
			completedAt: result.attempt.completedAt?.toISOString(),
		},
		badgesUnlocked,
		...(effects ? { effects } : {}),
	});
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ drillId: string }> }
) {
	const resolvedParams = await params;
	return withAuth(withErrorHandler((req, context) =>
		handler(req, context, resolvedParams)
	))(req);
}
