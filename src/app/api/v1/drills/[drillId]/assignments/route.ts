// GET /api/v1/drills/[drillId]/assignments - Get all assignments for a drill
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { Types } from 'mongoose';
import { parseQueryParams } from '@/lib/api/query-parser';
import { apiResponse, ValidationError } from '@/lib/api/response';
import { AssignmentRepository } from '@/domain/assignments/assignment.repository';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { drillId: string }
) {
	await connectToDatabase();

	const { drillId } = params;

	if (!Types.ObjectId.isValid(drillId)) {
		throw new ValidationError('Invalid drill ID format');
	}

	const queryParams = parseQueryParams(req);
	const assignmentRepo = new AssignmentRepository();

	// Get assignments for drill
	const result = await assignmentRepo.findByDrillId(drillId, {
		limit: queryParams.limit,
		offset: queryParams.offset,
	});

	return apiResponse.success({
		assignments: result.assignments.map((a: any) => ({
			_id: a._id,
			assignmentId: a._id,
			userId: a.learnerId,
			user: a.learnerId,
			learnerId: a.learnerId,
			assignedBy: a.assignedBy,
			assignedAt: a.assignedAt,
			dueDate: a.dueDate,
			status: a.status,
			completedAt: a.completedAt,
			score: a.score,
			timeSpent: a.timeSpent,
		})),
		pagination: {
			total: result.total,
			limit: queryParams.limit,
			offset: queryParams.offset,
			hasMore: queryParams.offset + result.assignments.length < result.total,
		},
	});
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ drillId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['admin', 'tutor'], withErrorHandler((req, context) =>
		handler(req, context, resolvedParams)
	))(req);
}
