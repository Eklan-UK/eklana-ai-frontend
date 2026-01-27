// GET /api/v1/pronunciations/[pronunciationId]/attempts
// Get pronunciation attempts for a learner
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { Types } from 'mongoose';
import { parseQueryParams } from '@/lib/api/query-parser';
import { apiResponse, ValidationError, NotFoundError, ForbiddenError } from '@/lib/api/response';
import { userService } from '@/lib/api/user.service';
import { PronunciationAssignmentRepository } from '@/domain/pronunciations/pronunciation-assignment.repository';
import { PronunciationAttemptRepository } from '@/domain/pronunciations/pronunciation-attempt.repository';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { pronunciationId: string }
) {
	await connectToDatabase();

	const { pronunciationId } = params;
	const { searchParams } = new URL(req.url);
	const learnerIdParam = searchParams.get('learnerId');

	// Determine which user's attempts to fetch
	let targetUserId: Types.ObjectId;
	if (learnerIdParam && (context.userRole === 'admin' || context.userRole === 'tutor')) {
		// Admin/tutor can view any user's attempts
		if (!Types.ObjectId.isValid(learnerIdParam)) {
			throw new ValidationError('Invalid learner ID format');
		}
		targetUserId = new Types.ObjectId(learnerIdParam);
	} else {
		// User can only view their own attempts
		targetUserId = context.userId;
	}

	// Verify user exists
	const user = await userService.findById(targetUserId.toString());
	if (!user) {
		throw new NotFoundError('User');
	}

	const assignmentRepo = new PronunciationAssignmentRepository();
	const attemptRepo = new PronunciationAttemptRepository();

	// Find assignment
	const assignment = await assignmentRepo.findByPronunciationAndLearner(
		pronunciationId,
		targetUserId.toString()
	);

	if (!assignment) {
		throw new NotFoundError('Pronunciation assignment');
	}

	// Get attempts
	const queryParams = parseQueryParams(req);
	const result = await attemptRepo.findByAssignmentId(assignment._id.toString(), {
		limit: queryParams.limit,
		offset: queryParams.offset,
	});

	return apiResponse.success({
		assignment: {
			_id: assignment._id,
			status: assignment.status,
			attemptsCount: assignment.attemptsCount,
			bestScore: assignment.bestScore,
			completedAt: assignment.completedAt,
		},
		attempts: result.attempts,
		pagination: {
			total: result.total,
			limit: queryParams.limit,
			offset: queryParams.offset,
			hasMore: queryParams.offset + result.attempts.length < result.total,
		},
	});
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ pronunciationId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['admin', 'tutor', 'user'], withErrorHandler((req, context) =>
		handler(req, context, resolvedParams)
	))(req);
}
