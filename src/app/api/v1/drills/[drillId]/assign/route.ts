// POST /api/v1/drills/[drillId]/assign
// Assign drill to users with email and push notification
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { Types } from 'mongoose';
import { z } from 'zod';
import { parseRequestBody } from '@/lib/api/request-parser';
import { validateRequest } from '@/lib/api/validation';
import { apiResponse } from '@/lib/api/response';
import { DrillService } from '@/domain/drills/drill.service';
import { DrillRepository } from '@/domain/drills/drill.repository';
import { AssignmentRepository } from '@/domain/assignments/assignment.repository';
import { AttemptRepository } from '@/domain/attempts/attempt.repository';

const assignSchema = z.object({
	userIds: z.array(z.string().refine((id) => Types.ObjectId.isValid(id), {
		message: 'Each user ID must be a valid MongoDB ObjectId',
	})).min(1),
	dueDate: z.string().datetime().optional(),
});

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { drillId: string }
) {
	await connectToDatabase();

	const { drillId } = params;
	
	// Parse and validate request body
	const body = await parseRequestBody(req);
	const validated = validateRequest(assignSchema, body);

	// Initialize services
	const drillRepo = new DrillRepository();
	const assignmentRepo = new AssignmentRepository();
	const attemptRepo = new AttemptRepository();
	const drillService = new DrillService(drillRepo, assignmentRepo, attemptRepo);

	// Assign drill using service
	const result = await drillService.assignDrill({
		drillId,
		userIds: validated.userIds,
		assignedBy: context.userId.toString(),
		dueDate: validated.dueDate ? new Date(validated.dueDate) : undefined,
	});

	return apiResponse.success(
		{
			assignments: result.assignments.map((a: any) => ({
				id: a._id,
				userId: a.learnerId,
				status: a.status,
				dueDate: a.dueDate,
			})),
			skipped: result.skipped,
			total: result.total,
		},
		201
	);
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ drillId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['tutor', 'admin'], withErrorHandler((req, context) => 
		handler(req, context, resolvedParams)
	))(req);
}

