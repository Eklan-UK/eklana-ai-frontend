// GET /api/v1/pronunciations/learner/[learnerId]/analytics
// Get pronunciation analytics for a learner
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import PronunciationAssignment from '@/models/pronunciation-assignment';
import PronunciationAttempt from '@/models/pronunciation-attempt';
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

		// Check permissions: Admin/Tutor or the learner themselves
		if (
			context.userRole !== 'admin' &&
			context.userRole !== 'tutor' &&
			context.userId.toString() !== learnerId
		) {
			return NextResponse.json(
				{
					code: 'Forbidden',
					message: "You don't have permission to access these analytics",
				},
				{ status: 403 }
			);
		}

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

		// Get assignments with pagination to prevent memory issues
		const { searchParams } = new URL(req.url);
		const limit = parseInt(searchParams.get('limit') || '100');
		const offset = parseInt(searchParams.get('offset') || '0');

		// Use aggregation to get assignments with statistics in one query
		const assignmentsAggregation = await PronunciationAssignment.aggregate([
			{ $match: { learnerId: new Types.ObjectId(learnerId) } },
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
					'title': '$pronunciation.title',
					'text': '$pronunciation.text',
					'difficulty': '$pronunciation.difficulty',
				},
			},
			{ $sort: { assignedAt: -1 } },
			{ $skip: offset },
			{ $limit: limit },
		]);

		// Get overall statistics using aggregation (more efficient)
		const overallStats = await PronunciationAssignment.aggregate([
			{ $match: { learnerId: new Types.ObjectId(learnerId) } },
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

		const totalAssignments = statusCounts['completed'] + statusCounts['in-progress'] + statusCounts['pending'] + (statusCounts['overdue'] || 0) + (statusCounts['skipped'] || 0);
		const completedAssignments = statusCounts['completed'] || 0;
		const inProgressAssignments = statusCounts['in-progress'] || 0;
		const pendingAssignments = statusCounts['pending'] || 0;

		// Calculate average score and pass rate using aggregation (much more efficient)
		const attemptStats = await PronunciationAttempt.aggregate([
			{ $match: { learnerId: new Types.ObjectId(learnerId) } },
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
		const passRate = stats.totalAttempts > 0
			? (stats.passedCount / stats.totalAttempts) * 100
			: 0;

		// Get most problematic letters/phonemes using aggregation (much faster)
		const topIncorrectLettersAgg = await PronunciationAttempt.aggregate([
			{ $match: { learnerId: new Types.ObjectId(learnerId) } },
			{ $unwind: { path: '$incorrectLetters', preserveNullAndEmptyArrays: true } },
			{ $match: { incorrectLetters: { $ne: null } } },
			{
				$group: {
					_id: '$incorrectLetters',
					count: { $sum: 1 },
				},
			},
			{ $sort: { count: -1 } },
			{ $limit: 10 },
			{
				$project: {
					_id: 0,
					letter: '$_id',
					count: 1,
				},
			},
		]);

		const topIncorrectPhonemesAgg = await PronunciationAttempt.aggregate([
			{ $match: { learnerId: new Types.ObjectId(learnerId) } },
			{ $unwind: { path: '$incorrectPhonemes', preserveNullAndEmptyArrays: true } },
			{ $match: { incorrectPhonemes: { $ne: null } } },
			{
				$group: {
					_id: '$incorrectPhonemes',
					count: { $sum: 1 },
				},
			},
			{ $sort: { count: -1 } },
			{ $limit: 10 },
			{
				$project: {
					_id: 0,
					phoneme: '$_id',
					count: 1,
				},
			},
		]);

		// Calculate progress over time (last 30 days) using aggregation
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const accuracyTrendAgg = await PronunciationAttempt.aggregate([
			{
				$match: {
					learnerId: new Types.ObjectId(learnerId),
					createdAt: { $gte: thirtyDaysAgo },
				},
			},
			{
				$group: {
					_id: {
						$dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
					},
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

		// Get word-level statistics using aggregation
		const wordStatsAgg = await PronunciationAssignment.aggregate([
			{ $match: { learnerId: new Types.ObjectId(learnerId) } },
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
					as: 'attempts',
				},
			},
			{
				$project: {
					pronunciationId: '$pronunciation._id',
					title: '$pronunciation.title',
					text: '$pronunciation.text',
					difficulty: '$pronunciation.difficulty',
					attempts: { $size: '$attempts' },
					bestScore: { $ifNull: ['$bestScore', 0] },
					status: 1,
					completedAt: 1,
					lastAttemptAt: 1,
				},
			},
			{ $sort: { assignedAt: -1 } },
			{ $limit: limit },
		]);

		// Format assignments for response
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

		const wordStats = wordStatsAgg;
		const topIncorrectLetters = topIncorrectLettersAgg;
		const topIncorrectPhonemes = topIncorrectPhonemesAgg;
		const accuracyTrend = accuracyTrendAgg;

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Analytics retrieved successfully',
				data: {
					learner: {
						_id: user._id,
						user: user,
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
	return withAuth((req, context) =>
		handler(req, context, resolvedParams)
	)(req);
}

