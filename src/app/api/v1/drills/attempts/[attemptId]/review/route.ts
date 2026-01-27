// POST /api/v1/drills/attempts/[attemptId]/review
// Review a sentence drill attempt (tutor/admin only)
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { Types } from 'mongoose';
import { z } from 'zod';
import { parseRequestBody } from '@/lib/api/request-parser';
import { validateRequest } from '@/lib/api/validation';
import { apiResponse, ValidationError } from '@/lib/api/response';
import { AttemptReviewService } from '@/domain/attempts/attempt-review.service';
import { AttemptRepository } from '@/domain/attempts/attempt.repository';
import { DrillRepository } from '@/domain/drills/drill.repository';
import { AssignmentRepository } from '@/domain/assignments/assignment.repository';

const reviewSchema = z.object({
	sentenceReviews: z.array(z.object({
		sentenceIndex: z.number().int().min(0),
		isCorrect: z.boolean(),
		correctedText: z.string().optional(),
	})).min(1),
});

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { attemptId: string }
) {
	await connectToDatabase();

	const { attemptId } = params;

	if (!Types.ObjectId.isValid(attemptId)) {
		throw new ValidationError('Invalid or missing attempt ID');
	}

	const body = await parseRequestBody(req);
	const validated = validateRequest(reviewSchema, body);

	// Initialize services
	const attemptRepo = new AttemptRepository();
	const drillRepo = new DrillRepository();
	const assignmentRepo = new AssignmentRepository();
	const reviewService = new AttemptReviewService(attemptRepo, drillRepo, assignmentRepo);

	// Review attempt
	const updatedAttempt = await reviewService.reviewSentenceAttempt(
		attemptId,
		context.userId.toString(),
		validated.sentenceReviews
	);

	return apiResponse.success({
		attempt: updatedAttempt,
	});
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ attemptId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['admin', 'tutor'], withErrorHandler((req, context) =>
		handler(req, context, resolvedParams)
	))(req);
}
