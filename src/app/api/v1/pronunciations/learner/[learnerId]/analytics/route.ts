// GET /api/v1/pronunciations/learner/[learnerId]/analytics
// Get pronunciation analytics for a learner
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import PronunciationAssignment from '@/models/pronunciation-assignment';
import LearnerPronunciationProgress from '@/models/learner-pronunciation-progress';
import PronunciationAttempt from '@/models/pronunciation-attempt';
import DrillAttempt from '@/models/drill-attempt';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { resolveLearnerIdToUserIdString } from '@/lib/api/staff-learner-access';
import {
	getLearnerAttemptFallbackWordStats,
	getProblemAreasWithWords,
} from '@/domain/pronunciations/pronunciation-analytics.service';

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

		// ── Problem areas (phonemes/letters with related struggling words) ─────
		const problemAreas = await getProblemAreasWithWords(learnerOid);

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

		// ── Merge drill_attempts pronunciationResults ──────────────────────────────
		// Learning-journey pronunciation drills write results to drill_attempts
		// (not pronunciation_attempts), so we need to merge them in here.
		const drillPronAttempts = await DrillAttempt.find({
			learnerId: learnerOid,
			'pronunciationResults.wordScores.0': { $exists: true },
		}).select('pronunciationResults completedAt score').lean().exec();

		// Merge overall stats
		const drillAttemptsCount = drillPronAttempts.length;
		const drillPassedCount = drillPronAttempts.filter(
			(a) => ((a as any).score ?? 0) >= 70
		).length;
		const drillScoreSum = drillPronAttempts.reduce(
			(sum, a) => sum + ((a as any).score ?? 0), 0
		);

		const combinedTotalAttempts = (stats.totalAttempts || 0) + drillAttemptsCount;
		const combinedPassedCount = (stats.passedCount || 0) + drillPassedCount;
		const existingScoreSum = (stats.averageScore || 0) * (stats.totalAttempts || 0);
		const combinedAverageScore =
			combinedTotalAttempts > 0
				? (existingScoreSum + drillScoreSum) / combinedTotalAttempts
				: 0;
		const combinedPassRate =
			combinedTotalAttempts > 0
				? (combinedPassedCount / combinedTotalAttempts) * 100
				: 0;

		// Merge word stats from drill_attempts
		const drillWordMap = new Map<string, { word: string; scores: number[]; lastDate: Date | null }>();
		for (const attempt of drillPronAttempts) {
			const pr = (attempt as any).pronunciationResults;
			if (!pr?.wordScores) continue;
			const date = (attempt as any).completedAt as Date | null;
			for (const ws of pr.wordScores as Array<{ word?: string; score?: number }>) {
				if (!ws.word) continue;
				const key = ws.word.toLowerCase();
				if (!drillWordMap.has(key)) {
					drillWordMap.set(key, { word: ws.word, scores: [], lastDate: null });
				}
				const entry = drillWordMap.get(key)!;
				entry.scores.push(ws.score ?? 0);
				if (date && (!entry.lastDate || date > entry.lastDate)) {
					entry.lastDate = date;
				}
			}
		}

		const drillWordStats = Array.from(drillWordMap.values()).map(({ word, scores, lastDate }) => {
			const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;
			const bestScore = Math.max(...scores);
			return {
				wordId: null as Types.ObjectId | null,
				title: word,
				text: word,
				difficulty: '',
				attempts: scores.length,
				bestScore: Math.round(bestScore * 100) / 100,
				averageScore: Math.round(avgScore * 100) / 100,
				isChallenging: scores.length > 3 || avgScore < 70,
				status: bestScore >= 70 ? 'completed' : 'in-progress',
				completedAt: null as Date | null,
				lastAttemptAt: lastDate,
			};
		});

		// Existing word titles take priority; drill-only words fill the gaps
		const existingWordTitles = new Set(wordStats.map((w: any) => (w.title || '').toLowerCase()));
		const drillOnlyWords = drillWordStats.filter(
			(w) => !existingWordTitles.has(w.title.toLowerCase())
		);
		wordStats = [...wordStats, ...drillOnlyWords];

		// Merge accuracy trend from drill_attempts (group by completedAt date)
		const existingTrendMap = new Map(
			accuracyTrendAgg.map((t: any) => [t.date as string, t as { date: string; averageScore: number; attempts: number }])
		);
		for (const attempt of drillPronAttempts) {
			const date = (attempt as any).completedAt as Date | null;
			if (!date) continue;
			const dateStr = new Date(date).toISOString().slice(0, 10);
			const score = (attempt as any).score ?? 0;
			if (existingTrendMap.has(dateStr)) {
				const existing = existingTrendMap.get(dateStr)!;
				const totalAtt = existing.attempts + 1;
				const newAvg = (existing.averageScore * existing.attempts + score) / totalAtt;
				existingTrendMap.set(dateStr, {
					date: dateStr,
					averageScore: Math.round(newAvg * 100) / 100,
					attempts: totalAtt,
				});
			} else {
				existingTrendMap.set(dateStr, {
					date: dateStr,
					averageScore: Math.round(score * 100) / 100,
					attempts: 1,
				});
			}
		}
		const mergedAccuracyTrend = Array.from(existingTrendMap.values())
			.sort((a, b) => a.date.localeCompare(b.date));

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
						totalAttempts: combinedTotalAttempts,
						averageScore: Math.round(combinedAverageScore * 100) / 100,
						passRate: Math.round(combinedPassRate * 100) / 100,
					},
					problemAreas,
					accuracyTrend: mergedAccuracyTrend,
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
