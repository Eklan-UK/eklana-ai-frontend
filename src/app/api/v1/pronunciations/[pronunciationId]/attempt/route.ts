// POST /api/v1/pronunciations/[pronunciationId]/attempt
// Submit a pronunciation attempt
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { Types } from 'mongoose';
import { z } from 'zod';
import { parseRequestBody } from '@/lib/api/request-parser';
import { validateRequest } from '@/lib/api/validation';
import { apiResponse } from '@/lib/api/response';
import { PronunciationService } from '@/domain/pronunciations/pronunciation.service';
import { PronunciationRepository } from '@/domain/pronunciations/pronunciation.repository';
import { PronunciationAssignmentRepository } from '@/domain/pronunciations/pronunciation-assignment.repository';
import { PronunciationAttemptRepository } from '@/domain/pronunciations/pronunciation-attempt.repository';

const attemptSchema = z.object({
	assignmentId: z.string().refine((id) => Types.ObjectId.isValid(id), {
		message: 'Assignment ID must be a valid MongoDB ObjectId',
	}).optional(),
	audioBase64: z.string().min(1, 'Audio recording is required'),
	passingThreshold: z.number().min(0).max(100).optional().default(70),
});

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { pronunciationId: string }
) {
	await connectToDatabase();

	const { pronunciationId } = params;
	const body = await parseRequestBody(req);
	const validated = validateRequest(attemptSchema, body);

	const pronunciationRepo = new PronunciationRepository();
	const assignmentRepo = new PronunciationAssignmentRepository();
	const attemptRepo = new PronunciationAttemptRepository();
	const pronunciationService = new PronunciationService(pronunciationRepo, assignmentRepo, attemptRepo);

	const result = await pronunciationService.submitAttempt({
		pronunciationId,
		learnerId: context.userId.toString(),
		assignmentId: validated.assignmentId,
		audioBase64: validated.audioBase64,
		passingThreshold: validated.passingThreshold,
	});

	return apiResponse.success(
		{
			attempt: result.attempt,
			assignment: {
				status: result.assignment?.status,
				attemptsCount: result.assignment?.attemptsCount,
				bestScore: result.assignment?.bestScore,
				completedAt: result.assignment?.completedAt,
			},
		},
		201
	);
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ pronunciationId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['user'], withErrorHandler((req, context) =>
		handler(req, context, resolvedParams)
	))(req);
}
