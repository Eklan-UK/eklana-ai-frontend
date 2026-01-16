// GET /api/v1/tutor/students/[studentId]
// Get a single student's details with drill assignment counts and review status
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import Profile from '@/models/profile';
import DrillAssignment from '@/models/drill-assignment';
import DrillAttempt from '@/models/drill-attempt';
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

		// Get all drill assignments for this student (assigned by this tutor)
		const allAssignments = await DrillAssignment.find({
			learnerId: studentObjectId,
			assignedBy: context.userId,
		})
			.populate('drillId', 'title type difficulty')
			.sort({ assignedAt: -1 })
			.lean()
			.exec();

		// Get all drill attempts for this student to check review status
		const studentAttempts = await DrillAttempt.find({
			learnerId: studentObjectId,
		})
			.select('drillAssignmentId drillId sentenceResults summaryResults grammarResults score completedAt')
			.lean()
			.exec();

		// Create a map of attempts by assignment ID
		const attemptsByAssignment = new Map<string, any>();
		studentAttempts.forEach(attempt => {
			const key = attempt.drillAssignmentId?.toString();
			if (key) {
				attemptsByAssignment.set(key, attempt);
			}
		});

		// Categorize drills
		const pendingDrills: any[] = [];
		const pendingReviewDrills: any[] = [];
		const reviewedDrills: any[] = [];
		const recentDrills: any[] = [];

		allAssignments.forEach((assignment) => {
			const drill = assignment.drillId as any;
			const attempt = attemptsByAssignment.get(assignment._id.toString());
			
			// Determine review status from attempt
			let reviewStatus = null;
			if (attempt) {
				if (attempt.sentenceResults?.reviewStatus) {
					reviewStatus = attempt.sentenceResults.reviewStatus;
				} else if (attempt.summaryResults?.reviewStatus) {
					reviewStatus = attempt.summaryResults.reviewStatus;
				} else if (attempt.grammarResults?.reviewStatus) {
					reviewStatus = attempt.grammarResults.reviewStatus;
				}
			}

			const drillData = {
				id: assignment._id,
				drillId: drill?._id,
				title: drill?.title || 'Unknown Drill',
				type: drill?.type || 'unknown',
				difficulty: drill?.difficulty,
				status: assignment.status,
				score: attempt?.score || assignment.score,
				reviewStatus: reviewStatus,
				completedAt: attempt?.completedAt || assignment.completedAt,
				dueDate: assignment.dueDate,
				assignedAt: assignment.assignedAt,
			};

			// Categorize
			if (assignment.status === 'pending' || assignment.status === 'in-progress' || assignment.status === 'overdue') {
				pendingDrills.push(drillData);
			} else if (assignment.status === 'completed') {
				if (reviewStatus === 'pending') {
					pendingReviewDrills.push(drillData);
				} else if (reviewStatus === 'reviewed') {
					reviewedDrills.push(drillData);
				} else {
					// Completed drills without review requirement
					reviewedDrills.push(drillData);
				}
			}

			// Add to recent drills (first 10)
			if (recentDrills.length < 10) {
				recentDrills.push(drillData);
			}
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
			drillsPendingReview: pendingReviewDrills.length,
			drillsReviewed: reviewedDrills.length,
			drillsTotal: counts.totalAssigned,
			joinDate: user.createdAt,
			lastActivity: user.lastActivity || null,
			recentDrills,
			// Categorized drill lists
			assignedDrills: pendingDrills,
			submittedDrills: pendingReviewDrills,
			reviewedDrills: reviewedDrills,
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

