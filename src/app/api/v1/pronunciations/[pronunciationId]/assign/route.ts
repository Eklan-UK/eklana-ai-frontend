// POST /api/v1/pronunciations/[pronunciationId]/assign
// Assign pronunciation to learners
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { Types } from 'mongoose';
import { z } from 'zod';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { parseRequestBody } from '@/lib/api/request-parser';
import { validateRequest } from '@/lib/api/validation';
import { apiResponse } from '@/lib/api/response';
import { PronunciationService } from '@/domain/pronunciations/pronunciation.service';
import { PronunciationRepository } from '@/domain/pronunciations/pronunciation.repository';
import { PronunciationAssignmentRepository } from '@/domain/pronunciations/pronunciation-assignment.repository';
import { PronunciationAttemptRepository } from '@/domain/pronunciations/pronunciation-attempt.repository';

const assignSchema = z.object({
	learnerIds: z.array(z.string().refine((id) => Types.ObjectId.isValid(id), {
		message: 'Each user ID must be a valid MongoDB ObjectId',
	})).min(1),
	dueDate: z.string().datetime().optional(),
});

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { pronunciationId: string }
) {
	await connectToDatabase();

	const { pronunciationId } = params;
	const body = await parseRequestBody(req);
	const validated = validateRequest(assignSchema, body);

	const pronunciationRepo = new PronunciationRepository();
	const assignmentRepo = new PronunciationAssignmentRepository();
	const attemptRepo = new PronunciationAttemptRepository();
	const pronunciationService = new PronunciationService(pronunciationRepo, assignmentRepo, attemptRepo);

	const result = await pronunciationService.assignPronunciation({
		pronunciationId,
		learnerIds: validated.learnerIds,
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
			skippedAssignments: result.skipped,
			totalAssigned: result.total,
		},
		201
	);
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ pronunciationId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['tutor', 'admin'], withErrorHandler((req, context) =>
		handler(req, context, resolvedParams)
	))(req);
}
