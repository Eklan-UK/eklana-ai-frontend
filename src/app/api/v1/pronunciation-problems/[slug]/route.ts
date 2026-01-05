// GET /api/v1/pronunciation-problems/[slug] - Get problem with words and learner progress
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import PronunciationProblem from '@/models/pronunciation-problem';
import PronunciationWord from '@/models/pronunciation-word';
import LearnerPronunciationProgress from '@/models/learner-pronunciation-progress';
import Learner from '@/models/leaner';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { slug: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { slug } = params;

		// Find problem
		const problem = await PronunciationProblem.findOne({ slug, isActive: true })
			.populate('createdBy', 'email firstName lastName')
			.lean()
			.exec();

		if (!problem) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Pronunciation problem not found',
				},
				{ status: 404 }
			);
		}

		// Get all words for this problem (ordered)
		const words = await PronunciationWord.find({
			problemId: problem._id,
			isActive: true,
		})
			.sort({ order: 1 })
			.lean()
			.exec();

		// Get learner progress for this problem
		let progress = null;
		let nextWord = null;

		if (context.userRole === 'learner') {
			const learner = await Learner.findOne({ userId: context.userId }).lean().exec();
			if (learner) {
				// Get all progress records for this problem
				const progressRecords = await LearnerPronunciationProgress.find({
					learnerId: learner._id,
					problemId: problem._id,
				})
					.populate('wordId', 'word ipa phonemes audioUrl useTTS')
					.lean()
					.exec();

				// Find the first uncompleted word
				const completedWordIds = new Set(
					progressRecords.filter((p) => p.passed).map((p) => p.wordId.toString())
				);

				nextWord = words.find((word) => !completedWordIds.has(word._id.toString()));

				// Create progress map
				const progressMap = new Map();
				progressRecords.forEach((p) => {
					progressMap.set(p.wordId.toString(), {
						passed: p.passed,
						attempts: p.attempts,
						bestScore: p.bestScore,
						averageScore: p.averageScore,
						isChallenging: p.isChallenging,
						challengeLevel: p.challengeLevel,
						weakPhonemes: p.weakPhonemes,
						lastAttemptAt: p.lastAttemptAt,
					});
				});

				progress = {
					totalWords: words.length,
					completedWords: completedWordIds.size,
					progressPercentage: words.length > 0 ? (completedWordIds.size / words.length) * 100 : 0,
					wordProgress: progressMap,
					nextWord: nextWord ? {
						_id: nextWord._id,
						word: nextWord.word,
						ipa: nextWord.ipa,
						order: nextWord.order,
					} : null,
				};
			}
		}

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Pronunciation problem retrieved successfully',
				data: {
					problem,
					words,
					progress, // Only for learners
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching pronunciation problem', {
			error: error.message,
			stack: error.stack,
			slug: params.slug,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to fetch pronunciation problem',
			},
			{ status: 500 }
		);
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ slug: string }> }
) {
	const resolvedParams = await params;
	return withAuth((req, context) =>
		handler(req, context, resolvedParams)
	)(req);
}

