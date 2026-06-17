// GET /api/v1/pronunciations/learner/[learnerId]/analytics
// Get pronunciation analytics for a learner
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import PronunciationAssignment from '@/models/pronunciation-assignment';
import LearnerPronunciationProgress from '@/models/learner-pronunciation-progress';
import PronunciationAttempt from '@/models/pronunciation-attempt';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { resolveLearnerIdToUserIdString } from '@/lib/api/staff-learner-access';
import { getLearnerAttemptFallbackWordStats } from '@/domain/pronunciations/pronunciation-analytics.service';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { learnerId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const rawLearnerId = params.learnerId;

		// Check permissions: Admin/Tutor or the learner themselves
		if (
			context.userRole !== 'admin' &&
			context.userRole !== 'tutor' &&
			context.userId.toString() !== rawLearnerId
		) {
			return NextResponse.json(
				{
					code: 'Forbidden',
					message: "You don't have permission to access these analytics",
				},
				{ status: 403 }
			);
		}

	// Resolve profile IDs to User IDs (same pattern as fill-blank / grammar routes)
	const learnerId = await resolveLearnerIdToUserIdString(rawLearnerId);
	const learnerOid = new Types.ObjectId(learnerId);

		// Find user
		const user = await User.findById(learnerOid)
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

		// Get assignments with pagination (legacy path, kept for backward compat)
		const { searchParams } = new URL(req.url);
		const limit = parseInt(searchParams.get('limit') || '100');
		const offset = parseInt(searchParams.get('offset') || '0');

		// ── Legacy assignment stats ──────────────────────────────────────────────
		const overallStats = await PronunciationAssignment.aggregate([
			{ $match: { learnerId: learnerOid } },
			{
				$group: {
					_id: '$status',
					count: { $sum: 1 },
				},
			},
		]);

		const statusCounts = overallStats.reduce((acc, item) => {
			acc[item._id] = item.count;
			return acc;
		}, {} as Record<string, number>);

		const completedAssignments = statusCounts['completed'] || 0;
		const inProgressAssignments = statusCounts['in-progress'] || 0;
		const pendingAssignments = statusCounts['pending'] || 0;
		const totalAssignments =
			completedAssignments +
			inProgressAssignments +
			pendingAssignments +
			(statusCounts['overdue'] || 0) +
			(statusCounts['skipped'] || 0);

		// ── Attempt-level stats ──────────────────────────────────────────────────
		const attemptStats = await PronunciationAttempt.aggregate([
			{ $match: { learnerId: learnerOid } },
			{
				$group: {
					_id: null,
					averageScore: { $avg: '$textScore' },
					totalAttempts: { $sum: 1 },
					passedCount: {
						$sum: { $cond: [{ $eq: ['$passed', true] }, 1, 0] },
					},
				},
			},
		]);

		const stats = attemptStats[0] || { averageScore: 0, totalAttempts: 0, passedCount: 0 };
		const averageScore = stats.averageScore || 0;
		const passRate =
			stats.totalAttempts > 0
				? (stats.passedCount / stats.totalAttempts) * 100
				: 0;

		// ── Problem areas ────────────────────────────────────────────────────────
		const [topIncorrectLettersAgg, topIncorrectPhonemesAgg] = await Promise.all([
			PronunciationAttempt.aggregate([
				{ $match: { learnerId: learnerOid } },
				{ $unwind: { path: '$incorrectLetters', preserveNullAndEmptyArrays: true } },
				{ $match: { incorrectLetters: { $ne: null } } },
				{ $group: { _id: '$incorrectLetters', count: { $sum: 1 } } },
				{ $sort: { count: -1 } },
				{ $limit: 10 },
				{ $project: { _id: 0, letter: '$_id', count: 1 } },
			]),
			PronunciationAttempt.aggregate([
				{ $match: { learnerId: learnerOid } },
				{ $unwind: { path: '$incorrectPhonemes', preserveNullAndEmptyArrays: true } },
				{ $match: { incorrectPhonemes: { $ne: null } } },
				{ $group: { _id: '$incorrectPhonemes', count: { $sum: 1 } } },
				{ $sort: { count: -1 } },
				{ $limit: 10 },
				{ $project: { _id: 0, phoneme: '$_id', count: 1 } },
			]),
		]);

		// ── Accuracy trend (last 30 days) ────────────────────────────────────────
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const accuracyTrendAgg = await PronunciationAttempt.aggregate([
			{
				$match: {
					learnerId: learnerOid,
					createdAt: { $gte: thirtyDaysAgo },
				},
			},
			{
				$group: {
					_id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
					averageScore: { $avg: '$textScore' },
					attempts: { $sum: 1 },
				},
			},
			{ $sort: { _id: 1 } },
			{
				$project: {
					_id: 0,
					date: '$_id',
					averageScore: { $round: ['$averageScore', 2] },
					attempts: 1,
				},
			},
		]);

		// ── Word-level stats: primary source = LearnerPronunciationProgress ──────
		// This is where modern pronunciation practice (pronunciation-words flow) writes.
		const progressWordStats = await LearnerPronunciationProgress.aggregate([
			{ $match: { learnerId: learnerOid } },
			{
				$lookup: {
					from: 'pronunciation_words',
					localField: 'wordId',
					foreignField: '_id',
					as: 'word',
				},
			},
			{ $unwind: { path: '$word', preserveNullAndEmptyArrays: true } },
			{
				$project: {
					_id: 0,
					wordId: '$wordId',
					title: { $ifNull: ['$word.word', ''] },
					text: { $ifNull: ['$word.word', ''] },
					difficulty: { $ifNull: ['$word.difficulty', ''] },
					attempts: 1,
					bestScore: { $ifNull: ['$bestScore', 0] },
					averageScore: { $ifNull: ['$averageScore', 0] },
					isChallenging: 1,
					status: {
						$cond: ['$passed', 'completed', 'in-progress'],
					},
					completedAt: '$passedAt',
					lastAttemptAt: 1,
				},
			},
			{ $sort: { lastAttemptAt: -1 } },
		]);

		// ── Legacy assignment wordStats (kept for any still on old flow) ──────────
		const legacyWordStatsAgg = await PronunciationAssignment.aggregate([
			{ $match: { learnerId: learnerOid } },
			{
				$lookup: {
					from: 'pronunciations',
					localField: 'pronunciationId',
					foreignField: '_id',
					as: 'pronunciation',
				},
			},
			{ $unwind: { path: '$pronunciation', preserveNullAndEmptyArrays: true } },
			{
				$lookup: {
					from: 'pronunciation_attempts',
					localField: '_id',
					foreignField: 'pronunciationAssignmentId',
					as: 'attemptsArr',
				},
			},
			{
				$project: {
					_id: 0,
					pronunciationId: '$pronunciation._id',
					title: '$pronunciation.title',
					text: '$pronunciation.text',
					difficulty: '$pronunciation.difficulty',
					attempts: { $size: '$attemptsArr' },
					bestScore: { $ifNull: ['$bestScore', 0] },
					averageScore: { $literal: 0 },
					isChallenging: { $literal: false },
					status: 1,
					completedAt: 1,
					lastAttemptAt: 1,
				},
			},
			{ $sort: { assignedAt: -1 } },
			{ $skip: offset },
			{ $limit: limit },
		]);

		// Merge: progress-based records take priority; legacy fills in the rest
		// using pronunciation title as a dedup key.
		const progressTitles = new Set(
			progressWordStats.map((w: any) => (w.title || '').toLowerCase())
		);
		const legacyOnly = legacyWordStatsAgg.filter(
			(w: any) => w.title && !progressTitles.has((w.title || '').toLowerCase())
		);

		let wordStats = [...progressWordStats, ...legacyOnly];

		// Fallback: if both modern and legacy sources are empty, build word stats
		// from PronunciationAttempt.wordScores (Speechace evaluation results).
		// This covers learners whose attempts have no wordId / pronunciationAssignmentId
		// (e.g. from a mobile flow) but still carry per-word Speechace scores.
		if (wordStats.length === 0) {
			wordStats = await getLearnerAttemptFallbackWordStats(learnerOid);
		}

		// ── Legacy assignments list (used by assignment-detail views) ─────────────
		const assignmentsAggregation = await PronunciationAssignment.aggregate([
			{ $match: { learnerId: learnerOid } },
			{
				$lookup: {
					from: 'pronunciations',
					localField: 'pronunciationId',
					foreignField: '_id',
					as: 'pronunciation',
				},
			},
			{ $unwind: { path: '$pronunciation', preserveNullAndEmptyArrays: true } },
			{
				$project: {
					_id: 1,
					pronunciationId: 1,
					status: 1,
					bestScore: 1,
					completedAt: 1,
					lastAttemptAt: 1,
					assignedAt: 1,
					title: '$pronunciation.title',
					text: '$pronunciation.text',
					difficulty: '$pronunciation.difficulty',
				},
			},
			{ $sort: { assignedAt: -1 } },
			{ $skip: offset },
			{ $limit: limit },
		]);

		const assignments = assignmentsAggregation.map((a: any) => ({
			_id: a._id,
			pronunciationId: a.pronunciationId,
			title: a.title,
			text: a.text,
			difficulty: a.difficulty,
			status: a.status,
			bestScore: a.bestScore,
			completedAt: a.completedAt,
			lastAttemptAt: a.lastAttemptAt,
		}));

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Analytics retrieved successfully',
				data: {
					learner: {
						_id: user._id,
						user,
					},
					overall: {
						totalAssignments,
						completedAssignments,
						inProgressAssignments,
						pendingAssignments,
						totalAttempts: stats.totalAttempts || 0,
						averageScore: Math.round(averageScore * 100) / 100,
						passRate: Math.round(passRate * 100) / 100,
					},
					problemAreas: {
						topIncorrectLetters: topIncorrectLettersAgg,
						topIncorrectPhonemes: topIncorrectPhonemesAgg,
					},
					accuracyTrend: accuracyTrendAgg,
					wordStats,
					assignments,
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
	return withAuth((req, context) =>
		handler(req, context, resolvedParams)
	)(req);
}
