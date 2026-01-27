// GET /api/v1/drills/assignments/[assignmentId]/attempts
// Get all attempts for a specific drill assignment
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { Types } from 'mongoose';
import { parseQueryParams } from '@/lib/api/query-parser';
import { apiResponse, ValidationError, NotFoundError, ForbiddenError } from '@/lib/api/response';
import { AssignmentRepository } from '@/domain/assignments/assignment.repository';
import { AttemptRepository } from '@/domain/attempts/attempt.repository';

async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId },
	params: { assignmentId: string }
): Promise<any> {
	await connectToDatabase();

	const { assignmentId } = params;

	if (!Types.ObjectId.isValid(assignmentId)) {
		throw new ValidationError('Invalid assignment ID');
	}

	const queryParams = parseQueryParams(req);
	const assignmentRepo = new AssignmentRepository();
	const attemptRepo = new AttemptRepository();

	// Verify the assignment exists and belongs to the user
	const assignment = await assignmentRepo.findById(assignmentId);
	if (!assignment) {
		throw new NotFoundError('Assignment');
	}

	// Check if the assignment belongs to the current user
	if (assignment.learnerId.toString() !== context.userId.toString()) {
		throw new ForbiddenError('You do not have permission to view this assignment');
	}

	// Get attempts
	const attempts = await attemptRepo.findByAssignmentId(assignmentId);
	const totalAttempts = attempts.length;

	// Get the latest completed attempt
	const latestAttempt = attempts.find((a: any) => a.completedAt) || attempts[0] || null;

	return apiResponse.success({
		assignment,
		attempts: attempts.slice(queryParams.offset, queryParams.offset + queryParams.limit),
		latestAttempt,
		totalAttempts,
		pagination: {
			total: totalAttempts,
			limit: queryParams.limit,
			offset: queryParams.offset,
			hasMore: queryParams.offset + queryParams.limit < totalAttempts,
		},
	});
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ assignmentId: string }> }
) {
	const resolvedParams = await params;
	return withAuth(withErrorHandler((req, context) =>
		getHandler(req, context, resolvedParams)
	))(req);
}
