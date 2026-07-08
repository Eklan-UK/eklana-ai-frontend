import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import DrillAssignment from '@/models/drill-assignment';
import DrillAttempt from '@/models/drill-attempt';
import '@/models/drill';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import {
	assertStaffCanReadLearner,
	resolveLearnerIdToUserIdString,
} from '@/lib/api/staff-learner-access';
import { toUserIdQuery } from '@/lib/api/user-id';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { learnerId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { learnerId } = params;

		const canonicalLearnerId = await resolveLearnerIdToUserIdString(learnerId);
		const access = await assertStaffCanReadLearner(context, canonicalLearnerId);
		if (access === 'forbidden') {
			return NextResponse.json(
				{ code: 'NotFound', message: 'Learner not found or access denied' },
				{ status: 404 }
			);
		}

		// Parse pagination parameters
		// limit=0 (or unset) means "fetch all" with no cap
		const { searchParams } = new URL(req.url);
		const rawLimit = searchParams.get('limit');
		const fetchAll = rawLimit === null || rawLimit === '0' || rawLimit === 'all';
		const limit = fetchAll ? 0 : Math.min(parseInt(rawLimit || '50', 10), 500);
		const offset = parseInt(searchParams.get('offset') || '0');

		// Get total count for pagination (using aggregation for better performance)
		const totalCount = await DrillAssignment.countDocuments({
			learnerId: toUserIdQuery(canonicalLearnerId),
		});

		// Get drill assignments for this learner (all, or paginated)
		const baseQuery = DrillAssignment.find({
			learnerId: toUserIdQuery(canonicalLearnerId),
		})
			.select('_id drillId assignedBy status assignedAt dueDate completedAt score')
			.populate('drillId', 'title type difficulty learning_journey_part learning_journey_topic')
			.populate('assignedBy', 'firstName lastName email')
			.sort({ assignedAt: -1 });

		if (!fetchAll) {
			baseQuery.limit(limit).skip(offset);
		}

		const assignments = await baseQuery.lean().exec();

		// Exclude assignments whose drill was deleted (populate returns null for missing refs)
		const validAssignments = assignments.filter(
			(a: any) => a.drillId && typeof a.drillId === 'object'
		);

		// Get attempts only for the current page of assignments (optimized)
		const assignmentIds = validAssignments.map((a) => a._id);
		const attempts = assignmentIds.length > 0 ? await DrillAttempt.find({
			drillAssignmentId: { $in: assignmentIds },
		})
			.select(
				'drillAssignmentId score completedAt startedAt timeSpent requiresReview vocabularyResults pronunciationResults roleplayResults performanceReviewSnapshot'
			)
			.sort({ completedAt: -1 })
			.lean()
			.exec() : [];

		// Group attempts by assignment ID
		const attemptsByAssignment = new Map<string, any[]>();
		attempts.forEach((attempt) => {
			const assignmentId = attempt.drillAssignmentId?.toString();
			if (assignmentId) {
				if (!attemptsByAssignment.has(assignmentId)) {
					attemptsByAssignment.set(assignmentId, []);
				}
				attemptsByAssignment.get(assignmentId)!.push(attempt);
			}
		});

		// Enrich assignments with attempt data
		const enrichedAssignments = validAssignments.map((assignment: any) => {
			const assignmentAttempts = attemptsByAssignment.get(assignment._id.toString()) || [];
			const latestAttempt = assignmentAttempts.length > 0 ? assignmentAttempts[0] : null;
			const bestAttempt = [...assignmentAttempts].sort((a, b) => (b.score || 0) - (a.score || 0))[0] || null;

			return {
				_id: assignment._id,
				drillId: assignment.drillId?._id || assignment.drillId,
				drill: assignment.drillId,
				status:
					assignment.status === 'completed' || assignment.completedAt || latestAttempt?.completedAt
						? 'completed'
						: assignment.status,
				assignedAt: assignment.assignedAt,
				dueDate: assignment.dueDate,
				completedAt: assignment.completedAt,
				assignedBy: assignment.assignedBy,
				attemptsCount: assignmentAttempts.length,
				latestAttempt: latestAttempt
					? {
							score: latestAttempt.score,
							completedAt: latestAttempt.completedAt,
							startedAt: latestAttempt.startedAt,
							timeSpent: latestAttempt.timeSpent,
							vocabularyResults: latestAttempt.vocabularyResults,
							pronunciationResults: latestAttempt.pronunciationResults,
							roleplayResults: latestAttempt.roleplayResults,
							performanceReviewSnapshot: latestAttempt.performanceReviewSnapshot,
						}
					: null,
				bestScore: bestAttempt?.score || assignment.score || null,
				requiresReview: assignmentAttempts.some((a: any) => a.requiresReview),
			};
		});

		// Re-derive statistics from enrichedAssignments so that effective-status
		// corrections (completedAt on assignment or latestAttempt) are reflected.
		const effectiveStatusCounts = enrichedAssignments.reduce((acc, a) => {
			const s = (a as any).status as string;
			acc[s] = (acc[s] || 0) + 1;
			return acc;
		}, {} as Record<string, number>);

		const totalAssignments = totalCount;
		const completedAssignments = effectiveStatusCounts['completed'] || 0;
		const inProgressAssignments = effectiveStatusCounts['in-progress'] || 0;
		const pendingAssignments = effectiveStatusCounts['pending'] || 0;
		const overdueAssignments = effectiveStatusCounts['overdue'] || 0;

		// Calculate average score for completed assignments (using aggregation)
		const avgScoreResult = await DrillAssignment.aggregate([
			{ $match: { learnerId: toUserIdQuery(canonicalLearnerId), status: 'completed' } },
			{
				$lookup: {
					from: 'drill_attempts',
					localField: '_id',
					foreignField: 'drillAssignmentId',
					as: 'attempts',
				},
			},
			{ $unwind: { path: '$attempts', preserveNullAndEmptyArrays: true } },
			{
				$group: {
					_id: null,
					avgScore: { $avg: '$attempts.score' },
					count: { $sum: 1 },
				},
			},
		]);

		const averageScore = avgScoreResult.length > 0 && avgScoreResult[0].count > 0
			? avgScoreResult[0].avgScore || 0
			: 0;

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Drill assignments retrieved successfully',
				data: {
					assignments: enrichedAssignments,
				pagination: {
					total: totalCount,
					limit: fetchAll ? totalCount : limit,
					offset: fetchAll ? 0 : offset,
					hasMore: fetchAll ? false : offset + limit < totalCount,
				},
					statistics: {
						total: totalAssignments,
						completed: completedAssignments,
						inProgress: inProgressAssignments,
						pending: pendingAssignments,
						overdue: overdueAssignments,
						averageScore: Math.round(averageScore * 100) / 100,
						completionRate: totalAssignments > 0
							? Math.round((completedAssignments / totalAssignments) * 100 * 100) / 100
							: 0,
					},
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching learner drill assignments', {
			error: error.message,
			stack: error.stack,
			learnerId: params.learnerId,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to fetch drill assignments',
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
	return withRole(['admin', 'tutor'], (req, context) => {
		return handler(req, context, resolvedParams);
	})(req);
}

