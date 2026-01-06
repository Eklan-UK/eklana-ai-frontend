// GET /api/v1/pronunciations/[pronunciationId]/attempts
// Get pronunciation attempts for a learner
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import PronunciationAttempt from '@/models/pronunciation-attempt';
import PronunciationAssignment from '@/models/pronunciation-assignment';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { pronunciationId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { pronunciationId } = params;
		const { searchParams } = new URL(req.url);
		const learnerIdParam = searchParams.get('learnerId');

		// Determine which user's attempts to fetch
		let targetUserId: Types.ObjectId;
		if (learnerIdParam && (context.userRole === 'admin' || context.userRole === 'tutor')) {
			// Admin/tutor can view any user's attempts
			if (!Types.ObjectId.isValid(learnerIdParam)) {
				return NextResponse.json(
					{
						code: 'ValidationError',
						message: 'Invalid learner ID format',
					},
					{ status: 400 }
				);
			}
			targetUserId = new Types.ObjectId(learnerIdParam);
		} else {
			// User can only view their own attempts
			targetUserId = context.userId;
		}

		// Verify user exists
		const user = await User.findById(targetUserId).lean().exec();
		if (!user) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'User not found',
				},
				{ status: 404 }
			);
		}

		// Find assignment (learnerId now references User)
		const assignment = await PronunciationAssignment.findOne({
			pronunciationId,
			learnerId: targetUserId,
		}).lean().exec();

		if (!assignment) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Pronunciation assignment not found',
				},
				{ status: 404 }
			);
		}

		// Get all attempts for this assignment
		const attempts = await PronunciationAttempt.find({
			pronunciationAssignmentId: assignment._id,
		})
			.sort({ attemptNumber: 1 })
			.lean()
			.exec();

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Attempts retrieved successfully',
				data: {
					assignment: {
						_id: assignment._id,
						status: assignment.status,
						attemptsCount: assignment.attemptsCount,
						bestScore: assignment.bestScore,
						completedAt: assignment.completedAt,
					},
					attempts,
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching pronunciation attempts', {
			error: error.message,
			stack: error.stack,
			pronunciationId: params.pronunciationId,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to fetch attempts',
			},
			{ status: 500 }
		);
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ pronunciationId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['user', 'admin', 'tutor'], (req, context) =>
		handler(req, context, resolvedParams)
	)(req);
}

