// GET /api/v1/tutor/students/[studentId] — student details
// PATCH /api/v1/tutor/students/[studentId] — update learner first/last name (assigned tutor only)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import DrillAssignment from '@/models/drill-assignment';
import { isTutorAssignedToLearner } from '@/domain/tutor-assignments/tutor-assignment.service';
import DrillAttempt from '@/models/drill-attempt';
import '@/models/drill';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';
import { drillDisplayLabel } from '@/lib/drill-display-label';
import {
	computeDrillAssignmentStatistics,
	enrichDrillAssignment,
	groupAttemptsByAssignmentId,
	isPopulatedDrillRef,
} from '@/domain/drills/drill-assignment-analytics.service';

const updateStudentNameSchema = z.object({
	firstName: z.string().min(1).max(50),
	lastName: z.string().min(1).max(50),
});

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
		const assigned = await isTutorAssignedToLearner(context.userId, studentObjectId);
		if (!assigned) {
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

		// Get all drill assignments for this student (assigned by this tutor)
		const allAssignments = await DrillAssignment.find({
			learnerId: studentObjectId,
			assignedBy: context.userId,
		})
			.populate('drillId', 'title type difficulty learning_journey_part learning_journey_topic')
			.sort({ assignedAt: -1 })
			.lean()
			.exec();

		const assignmentIds = allAssignments.map((assignment) => assignment._id);
		const attempts =
			assignmentIds.length > 0
				? await DrillAttempt.find({
						drillAssignmentId: { $in: assignmentIds },
					})
						.select(
							'drillAssignmentId score completedAt startedAt grammarResults sentenceResults summaryResults'
						)
						.lean()
						.exec()
				: [];

		const attemptsByAssignment = groupAttemptsByAssignmentId(attempts);
		const enrichedAssignments = allAssignments.map((assignment) =>
			enrichDrillAssignment(
				assignment,
				attemptsByAssignment.get(assignment._id.toString()) || []
			)
		);
		const statistics = computeDrillAssignmentStatistics(enrichedAssignments);

		// Categorize drills
		const pendingDrills: any[] = [];
		const pendingReviewDrills: any[] = [];
		const reviewedDrills: any[] = [];
		const recentDrills: any[] = [];

		enrichedAssignments.forEach((enriched) => {
			const drill = isPopulatedDrillRef(enriched.drill) ? enriched.drill : null;

			const drillData = {
				id: enriched._id,
				drillId: enriched.drillId,
				title: (drill?.title as string) || drillDisplayLabel(drill) || 'Unknown Drill',
				type: (drill?.type as string) || 'unknown',
				difficulty: drill?.difficulty,
				status: enriched.status,
				score: enriched.bestScore ?? enriched.latestAttempt?.score,
				reviewStatus: enriched.reviewStatus,
				completedAt: enriched.latestAttempt?.completedAt || enriched.completedAt,
				dueDate: enriched.dueDate,
				assignedAt: enriched.assignedAt,
			};

			if (
				enriched.status === 'pending' ||
				enriched.status === 'in-progress' ||
				enriched.status === 'overdue'
			) {
				pendingDrills.push(drillData);
			} else if (enriched.status === 'completed') {
				if (enriched.reviewStatus === 'pending') {
					pendingReviewDrills.push(drillData);
				} else {
					reviewedDrills.push(drillData);
				}
			}

			if (recentDrills.length < 10) {
				recentDrills.push(drillData);
			}
		});

		const progress =
			statistics.total > 0
				? Math.round(statistics.completionRate)
				: 0;

		const student = {
			id: user._id,
			name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Unknown',
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
			progress,
			drillsCompleted: statistics.completed,
			drillsActive: statistics.pending + statistics.inProgress + statistics.overdue,
			drillsPendingReview: statistics.pendingReview,
			drillsReviewed: reviewedDrills.length,
			drillsTotal: statistics.total,
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

async function patchHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { studentId: string },
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { studentId } = params;

		if (!studentId || !Types.ObjectId.isValid(studentId)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Invalid student ID',
				},
				{ status: 400 },
			);
		}

		const studentObjectId = new Types.ObjectId(studentId);

		const assigned = await isTutorAssignedToLearner(context.userId, studentObjectId);
		if (!assigned) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Student not found or not assigned to you',
				},
				{ status: 404 },
			);
		}

		const body = await req.json();
		const validated = updateStudentNameSchema.parse(body);

		const user = await User.findById(studentObjectId);
		if (!user) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'User not found',
				},
				{ status: 404 },
			);
		}

		user.firstName = validated.firstName.trim();
		user.lastName = validated.lastName.trim();
		user.name = `${user.firstName} ${user.lastName}`.trim();
		await user.save();

		const displayName =
			`${user.firstName} ${user.lastName}`.trim() || user.name || 'Unknown';

		logger.info('Tutor updated student name', {
			tutorId: context.userId.toString(),
			studentId,
		});

		return NextResponse.json(
			{
				code: 'Success',
				data: {
					student: {
						id: user._id,
						firstName: user.firstName,
						lastName: user.lastName,
						name: displayName,
					},
				},
			},
			{ status: 200 },
		);
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Validation failed',
					errors: error.issues,
				},
				{ status: 400 },
			);
		}
		logger.error('Error updating student name', {
			error: error.message,
			stack: error.stack,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Internal Server Error',
			},
			{ status: 500 },
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

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ studentId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['tutor'], (req, context) =>
		patchHandler(req, context, resolvedParams)
	)(req);
}

