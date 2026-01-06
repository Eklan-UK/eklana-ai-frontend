// GET /api/v1/pronunciations/learner/[learnerId]/analytics
// Get pronunciation analytics for a learner
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import PronunciationAssignment from '@/models/pronunciation-assignment';
import PronunciationAttempt from '@/models/pronunciation-attempt';
import Learner from '@/models/leaner';
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

		// Find learner
		const learner = await Learner.findById(learnerId)
			.populate('userId', 'email firstName lastName')
			.lean()
			.exec();

		if (!learner) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Learner not found',
				},
				{ status: 404 }
			);
		}

		// Get all assignments for this learner
		const assignments = await PronunciationAssignment.find({
			learnerId: learner._id,
		})
			.populate('pronunciationId', 'title text difficulty')
			.sort({ assignedAt: -1 })
			.lean()
			.exec();

		// Get all attempts for this learner
		const allAttempts = await PronunciationAttempt.find({
			learnerId: learner._id,
		})
			.populate('pronunciationId', 'title text')
			.sort({ createdAt: -1 })
			.lean()
			.exec();

		// Calculate overall statistics
		const totalAssignments = assignments.length;
		const completedAssignments = assignments.filter((a) => a.status === 'completed').length;
		const inProgressAssignments = assignments.filter((a) => a.status === 'in-progress').length;
		const pendingAssignments = assignments.filter((a) => a.status === 'pending').length;

		// Calculate average scores
		const allScores = allAttempts.map((a) => a.textScore);
		const averageScore = allScores.length > 0
			? allScores.reduce((sum, score) => sum + score, 0) / allScores.length
			: 0;

		// Calculate pass rate
		const passedAttempts = allAttempts.filter((a) => a.passed).length;
		const passRate = allAttempts.length > 0
			? (passedAttempts / allAttempts.length) * 100
			: 0;

		// Get most problematic letters/phonemes
		const incorrectLettersCount: Record<string, number> = {};
		const incorrectPhonemesCount: Record<string, number> = {};

		allAttempts.forEach((attempt) => {
			attempt.incorrectLetters?.forEach((letter: string) => {
				incorrectLettersCount[letter] = (incorrectLettersCount[letter] || 0) + 1;
			});
			attempt.incorrectPhonemes?.forEach((phoneme: string) => {
				incorrectPhonemesCount[phoneme] = (incorrectPhonemesCount[phoneme] || 0) + 1;
			});
		});

		const topIncorrectLetters = Object.entries(incorrectLettersCount)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 10)
			.map(([letter, count]) => ({ letter, count }));

		const topIncorrectPhonemes = Object.entries(incorrectPhonemesCount)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 10)
			.map(([phoneme, count]) => ({ phoneme, count }));

		// Calculate progress over time (last 30 days)
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const recentAttempts = allAttempts.filter(
			(a) => new Date(a.createdAt) >= thirtyDaysAgo
		);

		// Group by date for trend analysis
		const dailyScores: Record<string, number[]> = {};
		recentAttempts.forEach((attempt) => {
			const date = new Date(attempt.createdAt).toISOString().split('T')[0];
			if (!dailyScores[date]) {
				dailyScores[date] = [];
			}
			dailyScores[date].push(attempt.textScore);
		});

		const accuracyTrend = Object.entries(dailyScores)
			.map(([date, scores]) => ({
				date,
				averageScore: scores.reduce((sum, s) => sum + s, 0) / scores.length,
				attempts: scores.length,
			}))
			.sort((a, b) => a.date.localeCompare(b.date));

		// Get word-level statistics
		const wordStats = assignments.map((assignment: any) => {
			const pronunciation = assignment.pronunciationId;
			const wordAttempts = allAttempts.filter(
				(a: any) => a.pronunciationId?._id?.toString() === pronunciation._id?.toString()
			);

			return {
				pronunciationId: pronunciation._id,
				title: pronunciation.title,
				text: pronunciation.text,
				difficulty: pronunciation.difficulty,
				attempts: wordAttempts.length,
				bestScore: assignment.bestScore || 0,
				status: assignment.status,
				completedAt: assignment.completedAt,
				lastAttemptAt: assignment.lastAttemptAt,
			};
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Analytics retrieved successfully',
				data: {
					learner: {
						_id: learner._id,
						user: learner.userId,
					},
					overall: {
						totalAssignments,
						completedAssignments,
						inProgressAssignments,
						pendingAssignments,
						totalAttempts: allAttempts.length,
						averageScore: Math.round(averageScore * 100) / 100,
						passRate: Math.round(passRate * 100) / 100,
					},
					problemAreas: {
						topIncorrectLetters,
						topIncorrectPhonemes,
					},
					accuracyTrend,
					wordStats,
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching learner pronunciation analytics', {
			error: error.message,
			stack: error.stack,
			learnerId: params.learnerId,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to fetch analytics',
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

