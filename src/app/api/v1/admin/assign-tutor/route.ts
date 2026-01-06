// POST /api/v1/admin/assign-tutor
// Assign a tutor to a student (learner)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import Learner from '@/models/leaner';
import Tutor from '@/models/tutor';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';

const assignTutorSchema = z.object({
	studentId: z.string().refine((id) => Types.ObjectId.isValid(id), {
		message: 'Invalid student ID format',
	}),
	tutorId: z.string().refine((id) => Types.ObjectId.isValid(id), {
		message: 'Invalid tutor ID format',
	}),
});

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const body = await req.json();
		const validated = assignTutorSchema.parse(body);

		// Verify student exists and is a learner
		const studentUser = await User.findById(validated.studentId).exec();
		if (!studentUser) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Student not found',
				},
				{ status: 404 }
			);
		}

		if (studentUser.role !== 'user') {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'The provided studentId does not belong to a learner',
				},
				{ status: 400 }
			);
		}

		// Verify tutor exists and is a tutor
		const tutorUser = await User.findById(validated.tutorId).exec();
		if (!tutorUser) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Tutor not found',
				},
				{ status: 404 }
			);
		}

		if (tutorUser.role !== 'tutor') {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'The provided tutorId does not belong to a tutor',
				},
				{ status: 400 }
			);
		}

		// Verify tutor profile exists
		const tutorProfile = await Tutor.findOne({ userId: validated.tutorId }).exec();
		if (!tutorProfile) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Tutor profile not found',
				},
				{ status: 404 }
			);
		}

		// Find learner profile
		const learnerProfile = await Learner.findOne({ userId: validated.studentId }).exec();
		if (!learnerProfile) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Learner profile not found',
				},
				{ status: 404 }
			);
		}

		// Update learner's tutorId
		learnerProfile.tutorId = new Types.ObjectId(validated.tutorId);
		await learnerProfile.save();

		// Populate tutor and student details for response
		const updatedLearner = await Learner.findById(learnerProfile._id)
			.populate({
				path: 'userId',
				select: '-password -__v',
			})
			.populate({
				path: 'tutorId',
				select: '-password -__v',
			})
			.select('-__v')
			.lean()
			.exec();

		logger.info('Tutor assigned to student successfully', {
			studentId: validated.studentId,
			tutorId: validated.tutorId,
			assignedBy: context.userId,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Tutor assigned to student successfully',
				data: {
					learner: updatedLearner,
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Validation failed',
					errors: error.issues,
				},
				{ status: 400 }
			);
		}

		logger.error('Error assigning tutor to student', {
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

export const POST = withRole(['admin'], handler);

