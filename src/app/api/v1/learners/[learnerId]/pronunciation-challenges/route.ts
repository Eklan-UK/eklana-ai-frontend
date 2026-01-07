// GET /api/v1/learners/[learnerId]/pronunciation-challenges
// Get challenging words for a learner (admin/tutor)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import LearnerPronunciationProgress from '@/models/learner-pronunciation-progress';
import PronunciationWord from '@/models/pronunciation-word';
import PronunciationProblem from '@/models/pronunciation-problem';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { learnerId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { learnerId } = params;

		// Find user (learnerId is now userId)
		const user = await User.findById(learnerId)
			.select('email firstName lastName')
			.lean()
			.exec();

		if (!user) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'User not found',
				},
				{ status: 404 }
			);
		}

		// Get challenging words with limit to prevent memory issues
		const { searchParams } = new URL(req.url);
		const limit = parseInt(searchParams.get('limit') || '100');

		const challengingProgress = await LearnerPronunciationProgress.find({
			learnerId: new Types.ObjectId(learnerId),
			isChallenging: true,
			passed: false,
		})
			.populate('wordId', 'word ipa phonemes')
			.populate('problemId', 'title slug')
			.sort({ attempts: -1, averageScore: 1 })
			.limit(limit)
			.lean()
			.exec();

		// Group by challenge level
		const byLevel = {
			high: challengingProgress.filter((p) => p.challengeLevel === 'high'),
			medium: challengingProgress.filter((p) => p.challengeLevel === 'medium'),
			low: challengingProgress.filter((p) => p.challengeLevel === 'low'),
		};

		// Aggregate weak phonemes across all challenges
		const allWeakPhonemes = new Set<string>();
		challengingProgress.forEach((p) => {
			p.weakPhonemes?.forEach((phoneme: string) => allWeakPhonemes.add(phoneme));
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Challenging words retrieved successfully',
				data: {
					learner: {
						_id: user._id,
						user: user,
					},
					challenges: {
						total: challengingProgress.length,
						byLevel,
					},
					words: challengingProgress.map((p) => ({
						word: p.wordId,
						problem: p.problemId,
						attempts: p.attempts,
						averageScore: p.averageScore,
						bestScore: p.bestScore,
						challengeLevel: p.challengeLevel,
						weakPhonemes: p.weakPhonemes,
						incorrectLetters: p.incorrectLetters,
						lastAttemptAt: p.lastAttemptAt,
					})),
					weakPhonemes: Array.from(allWeakPhonemes),
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching pronunciation challenges', {
			error: error.message,
			stack: error.stack,
			learnerId: params.learnerId,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to fetch challenges',
			},
			{ status: 500 }
		);
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ learnerId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['admin', 'tutor'], (req, context) =>
		handler(req, context, resolvedParams)
	)(req);
}

