// GET /api/v1/drills/[drillId]/assignments - Get all assignments for a drill
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import DrillAssignment from '@/models/drill-assignment';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { drillId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { drillId } = params;

		if (!Types.ObjectId.isValid(drillId)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Invalid drill ID format',
				},
				{ status: 400 }
			);
		}

		// Get all assignments for this drill
		const assignments = await DrillAssignment.find({ drillId: new Types.ObjectId(drillId) })
			.populate({
				path: 'learnerId',
				select: 'firstName lastName email',
			})
			.populate({
				path: 'assignedBy',
				select: 'firstName lastName email',
			})
			.sort({ assignedAt: -1 })
			.lean()
			.exec();

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Drill assignments retrieved successfully',
				data: {
					assignments: assignments.map((a) => ({
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
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error getting drill assignments', {
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

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ drillId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['admin', 'tutor'], (req, context) =>
		handler(req, context, resolvedParams)
	)(req);
}

