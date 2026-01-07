// GET /api/v1/drills/assignments/[assignmentId]/attempts
// Get all attempts for a specific drill assignment
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import DrillAssignment from '@/models/drill-assignment';
import DrillAttempt from '@/models/drill-attempt';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; assignmentId?: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		// Extract assignmentId from URL path
		const url = new URL(req.url);
		const pathParts = url.pathname.split('/');
		const assignmentIndex = pathParts.indexOf('assignments');
		const assignmentId = assignmentIndex !== -1 && pathParts[assignmentIndex + 1] 
			? pathParts[assignmentIndex + 1] 
			: null;

		if (!assignmentId || !Types.ObjectId.isValid(assignmentId)) {
			return NextResponse.json(
				{
					code: 'InvalidRequest',
					message: 'Invalid assignment ID',
				},
				{ status: 400 }
			);
		}

		// Verify the assignment exists and belongs to the user
		const assignment = await DrillAssignment.findById(assignmentId)
			.populate('drillId', 'title type difficulty')
			.lean()
			.exec();

		if (!assignment) {
			return NextResponse.json(
				{
					code: 'NotFound',
					message: 'Assignment not found',
				},
				{ status: 404 }
			);
		}

		// Check if the assignment belongs to the current user
		if (assignment.learnerId.toString() !== context.userId.toString()) {
			return NextResponse.json(
				{
					code: 'Forbidden',
					message: 'You do not have permission to view this assignment',
				},
				{ status: 403 }
			);
		}

		// Get attempts with pagination to prevent memory issues
		const { searchParams } = new URL(req.url);
		const limit = parseInt(searchParams.get('limit') || '50');
		const offset = parseInt(searchParams.get('offset') || '0');

		const attempts = await DrillAttempt.find({
			drillAssignmentId: new Types.ObjectId(assignmentId),
		})
			.sort({ completedAt: -1, createdAt: -1 })
			.limit(limit)
			.skip(offset)
			.lean()
			.exec();

		const totalAttempts = await DrillAttempt.countDocuments({
			drillAssignmentId: new Types.ObjectId(assignmentId),
		});

		// Get the latest completed attempt
		const latestAttempt = attempts.find((a) => a.completedAt) || attempts[0] || null;

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Attempts retrieved successfully',
				data: {
					assignment,
					attempts,
					latestAttempt,
					totalAttempts,
					pagination: {
						total: totalAttempts,
						limit,
						offset,
						hasMore: offset + attempts.length < totalAttempts,
					},
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching drill attempts', {
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

export const GET = withAuth(getHandler);

