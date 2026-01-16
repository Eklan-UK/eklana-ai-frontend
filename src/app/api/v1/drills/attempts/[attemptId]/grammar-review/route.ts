// POST /api/v1/drills/attempts/[attemptId]/grammar-review
// Review a grammar drill attempt (tutor/admin only)
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
	grammarReviews: z.array(z.object({
		patternIndex: z.number().int().min(0),
		sentenceIndex: z.number().int().min(0), // 0 or 1
		isCorrect: z.boolean(),
		correctedText: z.string().optional(),
	})).min(1),
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

		// Verify it's a grammar drill
		const drillType = attempt.drillId && (attempt.drillId as any).type;
		if (drillType && drillType !== 'grammar') {
			return NextResponse.json(
				{
					code: 'InvalidRequest',
					message: 'This endpoint is only for grammar drills',
				},
				{ status: 400 }
			);
		}

		// Verify it has grammarResults with patterns
		if (!attempt.grammarResults || !attempt.grammarResults.patterns) {
			return NextResponse.json(
				{
					code: 'InvalidRequest',
					message: 'This attempt does not have grammar pattern results',
				},
				{ status: 400 }
			);
		}

		// Update the attempt with reviews
		const patternReviews = validated.grammarReviews.map((review) => ({
			patternIndex: review.patternIndex,
			sentenceIndex: review.sentenceIndex,
			isCorrect: review.isCorrect,
			correctedText: review.isCorrect ? undefined : review.correctedText,
			reviewedAt: new Date(),
			reviewedBy: context.userId,
		}));

		// Calculate score based on correct sentences
		const correctCount = validated.grammarReviews.filter((r) => r.isCorrect).length;
		const totalSentences = validated.grammarReviews.length;
		const score = Math.round((correctCount / totalSentences) * 100);

		attempt.grammarResults.reviewStatus = 'reviewed';
		attempt.grammarResults.patternReviews = patternReviews;
		attempt.score = score;
		attempt.updatedAt = new Date();

		await attempt.save();

		logger.info('Grammar drill reviewed', {
			attemptId: attempt._id.toString(),
			reviewerId: context.userId.toString(),
			score,
		});

		// Get the updated attempt with populated fields
		const updatedAttempt = await DrillAttempt.findById(attemptId)
			.populate('drillId', 'title type')
			.populate('learnerId', 'firstName lastName email')
			.lean()
			.exec();

		// Send notification to student (async, don't block response)
		if (updatedAttempt) {
			const reviewer = await User.findById(context.userId).select('firstName lastName email name').lean().exec();
			const learner = updatedAttempt.learnerId as any;
			const drill = updatedAttempt.drillId as any;
			
			// Get best available name for the reviewer (tutor)
			let tutorName = 'Your tutor';
			if (reviewer?.firstName) {
				tutorName = `${reviewer.firstName}${reviewer.lastName ? ' ' + reviewer.lastName : ''}`.trim();
			} else if ((reviewer as any)?.name) {
				tutorName = (reviewer as any).name;
			} else if (reviewer?.email) {
				tutorName = reviewer.email.split('@')[0];
			}
			
			if (learner?.email && drill) {
				sendDrillReviewNotification({
					studentEmail: learner.email,
					studentName: learner.firstName || learner.name || 'Student',
					drillTitle: drill.title,
					drillType: drill.type,
					tutorName,
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

		logger.error('Error reviewing grammar drill', {
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

