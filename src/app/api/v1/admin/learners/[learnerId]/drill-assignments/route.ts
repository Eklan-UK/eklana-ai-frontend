import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import DrillAssignment from '@/models/drill-assignment';
import DrillAttempt from '@/models/drill-attempt';
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

		// Parse pagination parameters
		const { searchParams } = new URL(req.url);
		const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Max 100 per page
		const offset = parseInt(searchParams.get('offset') || '0');

		// Get total count for pagination (using aggregation for better performance)
		const totalCount = await DrillAssignment.countDocuments({
			learnerId: new Types.ObjectId(learnerId),
		});

		// Get paginated drill assignments for this learner
		const assignments = await DrillAssignment.find({
			learnerId: new Types.ObjectId(learnerId),
		})
			.select('_id drillId assignedBy status assignedAt dueDate completedAt score')
			.populate('drillId', 'title type difficulty')
			.populate('assignedBy', 'firstName lastName email')
			.sort({ assignedAt: -1 })
			.limit(limit)
			.skip(offset)
			.lean()
			.exec();

		// Get attempts only for the current page of assignments (optimized)
		const assignmentIds = assignments.map((a) => a._id);
		const attempts = assignmentIds.length > 0 ? await DrillAttempt.find({
			drillAssignmentId: { $in: assignmentIds },
		})
			.select('drillAssignmentId score completedAt startedAt timeSpent requiresReview')
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
		const enrichedAssignments = assignments.map((assignment: any) => {
			const assignmentAttempts = attemptsByAssignment.get(assignment._id.toString()) || [];
			const latestAttempt = assignmentAttempts.length > 0 ? assignmentAttempts[0] : null;
			const bestAttempt = [...assignmentAttempts].sort((a, b) => (b.score || 0) - (a.score || 0))[0] || null;

			return {
				_id: assignment._id,
				drillId: assignment.drillId?._id || assignment.drillId,
				drill: assignment.drillId,
				status: assignment.status,
				assignedAt: assignment.assignedAt,
				dueDate: assignment.dueDate,
				completedAt: assignment.completedAt,
				assignedBy: assignment.assignedBy,
				attemptsCount: assignmentAttempts.length,
				latestAttempt: latestAttempt ? {
					score: latestAttempt.score,
					completedAt: latestAttempt.completedAt,
					startedAt: latestAttempt.startedAt,
					timeSpent: latestAttempt.timeSpent,
				} : null,
				bestScore: bestAttempt?.score || assignment.score || null,
				requiresReview: assignmentAttempts.some((a: any) => a.requiresReview),
			};
		});

		// Calculate statistics using aggregation for better performance (across all assignments, not just current page)
		const statsAggregation = await DrillAssignment.aggregate([
			{ $match: { learnerId: new Types.ObjectId(learnerId) } },
			{
				$group: {
					_id: '$status',
					count: { $sum: 1 },
				},
			},
		]);

		const statusCounts = statsAggregation.reduce((acc, item) => {
			acc[item._id] = item.count;
			return acc;
		}, {} as Record<string, number>);

		const totalAssignments = totalCount;
		const completedAssignments = statusCounts['completed'] || 0;
		const inProgressAssignments = statusCounts['in-progress'] || 0;
		const pendingAssignments = statusCounts['pending'] || 0;
		const overdueAssignments = statusCounts['overdue'] || 0;

		// Calculate average score for completed assignments (using aggregation)
		const avgScoreResult = await DrillAssignment.aggregate([
			{ $match: { learnerId: new Types.ObjectId(learnerId), status: 'completed' } },
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
						limit,
						offset,
						hasMore: offset + limit < totalCount,
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

