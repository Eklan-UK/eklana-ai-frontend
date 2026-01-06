// GET /api/v1/pronunciations/learner/my-pronunciations
// Get pronunciations assigned to the current learner
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import PronunciationAssignment from '@/models/pronunciation-assignment';
import Learner from '@/models/leaner';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { searchParams } = new URL(req.url);
		const limit = parseInt(searchParams.get('limit') || '100');
		const offset = parseInt(searchParams.get('offset') || '0');
		const status = searchParams.get('status');

		// Find learner profile
		const learner = await Learner.findOne({ userId: context.userId }).lean().exec();
		if (!learner) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Learner profile not found',
				},
				{ status: 404 }
			);
		}

		// Build query
		const query: any = { learnerId: learner._id };
		if (status) {
			query.status = status;
		}

		// Get assignments with pronunciation details
		const assignments = await PronunciationAssignment.find(query)
			.populate({
				path: 'pronunciationId',
				populate: { path: 'createdBy', select: 'email firstName lastName' },
			})
			.populate('assignedBy', 'email firstName lastName')
			.sort({ assignedAt: -1 })
			.limit(limit)
			.skip(offset)
			.lean()
			.exec();

		const total = await PronunciationAssignment.countDocuments(query);

		// Format response
		const pronunciations = assignments.map((assignment: any) => ({
			assignmentId: assignment._id,
			pronunciation: assignment.pronunciationId,
			assignedBy: assignment.assignedBy,
			assignedAt: assignment.assignedAt,
			dueDate: assignment.dueDate,
			status: assignment.status,
			completedAt: assignment.completedAt,
			attemptsCount: assignment.attemptsCount,
			bestScore: assignment.bestScore,
			lastAttemptAt: assignment.lastAttemptAt,
		}));

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Pronunciations retrieved successfully',
				data: {
					pronunciations,
					pagination: {
						total,
						limit,
						offset,
						hasMore: offset + pronunciations.length < total,
					},
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching learner pronunciations', {
			error: error.message,
			stack: error.stack,
			userId: context.userId,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to fetch pronunciations',
			},
			{ status: 500 }
		);
	}
}

export const GET = withRole(['user'], handler);

