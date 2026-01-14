// GET /api/v1/tutor/students/[studentId]
// Get a single student's details with drill assignment counts
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import Profile from '@/models/profile';
import DrillAssignment from '@/models/drill-assignment';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { studentId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { studentId } = params;

		// Validate student ID
		if (!studentId || !Types.ObjectId.isValid(studentId)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Invalid student ID',
				},
				{ status: 400 }
			);
		}

		const studentObjectId = new Types.ObjectId(studentId);

		// Verify the student is assigned to this tutor
		const profile = await Profile.findOne({
			userId: studentObjectId,
			tutorId: context.userId,
		})
			.lean()
			.exec();

		if (!profile) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Student not found or not assigned to you',
				},
				{ status: 404 }
			);
		}

		// Get user details
		const user = await User.findById(studentObjectId)
			.select('-password -__v')
			.lean()
			.exec();

		if (!user) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'User not found',
				},
				{ status: 404 }
			);
		}

		// Get drill assignment counts
		const drillCounts = await DrillAssignment.aggregate([
			{
				$match: {
					learnerId: studentObjectId,
					assignedBy: context.userId,
				},
			},
			{
				$group: {
					_id: null,
					totalAssigned: { $sum: 1 },
					completed: {
						$sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
					},
					pending: {
						$sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
					},
					inProgress: {
						$sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] },
					},
				},
			},
		]).exec();

		const counts = drillCounts[0] || {
			totalAssigned: 0,
			completed: 0,
			pending: 0,
			inProgress: 0,
		};

		// Get recent drill assignments for this student
		const recentAssignments = await DrillAssignment.find({
			learnerId: studentObjectId,
			assignedBy: context.userId,
		})
			.populate('drillId', 'title type difficulty')
			.sort({ assignedAt: -1 })
			.limit(10)
			.lean()
			.exec();

		const recentDrills = recentAssignments.map((assignment) => {
			const drill = assignment.drillId as any;
			return {
				id: assignment._id,
				title: drill?.title || 'Unknown Drill',
				type: drill?.type || 'unknown',
				status: assignment.status,
				score: assignment.score,
				completedAt: assignment.completedAt,
				dueDate: assignment.dueDate,
				assignedAt: assignment.assignedAt,
			};
		});

		// Calculate progress percentage
		const progress = counts.totalAssigned > 0
			? Math.round((counts.completed / counts.totalAssigned) * 100)
			: 0;

		const student = {
			id: user._id,
			name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Unknown',
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
			progress,
			drillsCompleted: counts.completed,
			drillsActive: counts.pending + counts.inProgress,
			drillsTotal: counts.totalAssigned,
			joinDate: user.createdAt,
			lastActivity: user.lastActivity || null,
			recentDrills,
		};

		logger.info('Student details fetched', {
			tutorId: context.userId,
			studentId,
		});

		return NextResponse.json(
			{
				code: 'Success',
				data: { student },
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching student details', {
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
	{ params }: { params: Promise<{ studentId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['tutor'], (req, context) =>
		handler(req, context, resolvedParams)
	)(req);
}

