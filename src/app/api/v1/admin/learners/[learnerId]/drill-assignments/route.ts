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
import {
	computeDrillAssignmentStatistics,
	enrichDrillAssignment,
	isPopulatedDrillRef,
} from '@/domain/drills/drill-assignment-analytics.service';

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

		// limit=0 (or unset) means "fetch all" with no cap
		const { searchParams } = new URL(req.url);
		const rawLimit = searchParams.get('limit');
		const fetchAll = rawLimit === null || rawLimit === '0' || rawLimit === 'all';
		const limit = fetchAll ? 0 : Math.min(parseInt(rawLimit || '50', 10), 500);
		const offset = parseInt(searchParams.get('offset') || '0');

		const assignments = await DrillAssignment.find({
			learnerId: toUserIdQuery(canonicalLearnerId),
		})
			.select('_id drillId assignedBy status assignedAt dueDate completedAt score')
			.populate('drillId', 'title type difficulty learning_journey_part learning_journey_topic')
			.populate('assignedBy', 'firstName lastName email')
			.sort({ assignedAt: -1 })
			.lean()
			.exec();

		const validAssignments = assignments.filter((assignment) =>
			isPopulatedDrillRef(assignment.drillId)
		);

		const assignmentIds = validAssignments.map((assignment) => assignment._id);
		const attempts =
			assignmentIds.length > 0
				? await DrillAttempt.find({
						drillAssignmentId: { $in: assignmentIds },
					})
						.select(
							'drillAssignmentId score completedAt startedAt timeSpent vocabularyResults pronunciationResults roleplayResults performanceReviewSnapshot grammarResults sentenceResults summaryResults matchingResults'
						)
						.sort({ completedAt: -1 })
						.lean()
						.exec()
				: [];

		const attemptsByAssignment = new Map<string, typeof attempts>();
		attempts.forEach((attempt) => {
			const assignmentId = attempt.drillAssignmentId?.toString();
			if (!assignmentId) {
				return;
			}
			if (!attemptsByAssignment.has(assignmentId)) {
				attemptsByAssignment.set(assignmentId, []);
			}
			attemptsByAssignment.get(assignmentId)!.push(attempt);
		});

		const enrichedAssignments = validAssignments.map((assignment) =>
			enrichDrillAssignment(
				assignment,
				attemptsByAssignment.get(assignment._id.toString()) || []
			)
		);

		const statistics = computeDrillAssignmentStatistics(enrichedAssignments);
		const totalValid = enrichedAssignments.length;
		const paginatedAssignments = fetchAll
			? enrichedAssignments
			: enrichedAssignments.slice(offset, offset + limit);

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Drill assignments retrieved successfully',
				data: {
					assignments: paginatedAssignments,
					pagination: {
						total: totalValid,
						limit: fetchAll ? totalValid : limit,
						offset: fetchAll ? 0 : offset,
						hasMore: fetchAll ? false : offset + limit < totalValid,
					},
					statistics,
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
