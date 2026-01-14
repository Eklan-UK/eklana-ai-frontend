// POST /api/v1/drills/attempts/[attemptId]/review
// Review a sentence drill attempt (tutor/admin only)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import DrillAttempt from '@/models/drill-attempt';
import Drill from '@/models/drill';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';
import { sendDrillReviewNotification } from '@/lib/api/email.service';

const reviewSchema = z.object({
	sentenceReviews: z.array(z.object({
		sentenceIndex: z.number().int().min(0), // 0, 1, 2, etc.
		isCorrect: z.boolean(),
		correctedText: z.string().optional(),
	})).min(1), // Must have at least 1 review
});

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string; params?: { attemptId?: string } }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		// Ensure models are registered before populate
		void Drill.modelName;
		void User.modelName;

		// Extract attemptId from URL path
		const url = new URL(req.url);
		const pathParts = url.pathname.split('/');
		const attemptIdIndex = pathParts.indexOf('attempts') + 1;
		const attemptId = pathParts[attemptIdIndex] || context.params?.attemptId;

		// Validate attempt ID
		if (!attemptId || !Types.ObjectId.isValid(attemptId)) {
			return NextResponse.json(
				{
					code: 'InvalidRequest',
					message: 'Invalid or missing attempt ID',
				},
				{ status: 400 }
			);
		}

		const body = await req.json();
		const validated = reviewSchema.parse(body);

		// Find the attempt
		const attempt = await DrillAttempt.findById(attemptId)
			.populate('drillId', 'type')
			.exec();

		if (!attempt) {
			return NextResponse.json(
				{
					code: 'NotFound',
					message: 'Attempt not found',
				},
				{ status: 404 }
			);
		}

		// Verify it's a sentence drill (sentence or sentence_writing type)
		const drillType = attempt.drillId && (attempt.drillId as any).type;
		if (drillType && drillType !== 'sentence' && drillType !== 'sentence_writing') {
			return NextResponse.json(
				{
					code: 'InvalidRequest',
					message: 'This endpoint is only for sentence drills',
				},
				{ status: 400 }
			);
		}

		// Verify it has sentenceResults
		if (!attempt.sentenceResults) {
			return NextResponse.json(
				{
					code: 'InvalidRequest',
					message: 'This attempt does not have sentence results',
				},
				{ status: 400 }
			);
		}

		// Update the attempt with reviews
		const sentenceReviews = validated.sentenceReviews.map((review) => ({
			sentenceIndex: review.sentenceIndex,
			isCorrect: review.isCorrect,
			correctedText: review.isCorrect ? undefined : review.correctedText,
			reviewedAt: new Date(),
			reviewedBy: context.userId,
		}));

		// Calculate score based on correct sentences
		const correctCount = validated.sentenceReviews.filter((r) => r.isCorrect).length;
		const totalSentences = validated.sentenceReviews.length;
		const score = Math.round((correctCount / totalSentences) * 100);

		attempt.sentenceResults.reviewStatus = 'reviewed';
		attempt.sentenceResults.sentenceReviews = sentenceReviews;
		attempt.score = score;
		attempt.updatedAt = new Date();

		await attempt.save();

		logger.info('Sentence drill reviewed', {
			attemptId: attempt._id.toString(),
			reviewerId: context.userId.toString(),
			score,
		});

		// Get the updated attempt with populated fields for the response
		const updatedAttempt = await DrillAttempt.findById(attemptId)
			.populate('drillId', 'title type')
			.populate('learnerId', 'firstName lastName email')
			.lean()
			.exec();

		// Send notification to student (async, don't block response)
		if (updatedAttempt) {
			const reviewer = await User.findById(context.userId).select('firstName lastName email').lean().exec();
			const learner = updatedAttempt.learnerId as any;
			const drill = updatedAttempt.drillId as any;
			
			if (learner?.email && drill) {
				sendDrillReviewNotification({
					studentEmail: learner.email,
					studentName: learner.firstName || 'Student',
					drillTitle: drill.title,
					drillType: drill.type,
					tutorName: reviewer?.firstName || reviewer?.email || 'Your tutor',
					score,
					correctCount,
					totalCount: totalSentences,
				}).catch((err) => {
					logger.error('Failed to send review notification', { error: err.message });
				});
			}
		}

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Review submitted successfully',
				data: {
					attempt: updatedAttempt,
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Invalid request data',
					errors: error.issues,
				},
				{ status: 400 }
			);
		}

		logger.error('Error reviewing sentence drill', {
			error: error.message,
			stack: error.stack,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message: 'Internal Server Error',
				error: error.message,
			},
			{ status: 500 }
		);
	}
}

export const POST = withRole(['admin', 'tutor'], handler);


