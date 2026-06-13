// DELETE /api/v1/admin/unassign-tutor
// End an active tutor–student assignment
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';
import { unassignLearnerFromTutor } from '@/domain/tutor-assignments/tutor-assignment.service';

const schema = z.object({
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
		const validated = schema.parse(body);

		await unassignLearnerFromTutor({
			learnerId: new Types.ObjectId(validated.studentId),
			tutorId: new Types.ObjectId(validated.tutorId),
		});

		logger.info('Tutor unassigned from student', {
			studentId: validated.studentId,
			tutorId: validated.tutorId,
			by: context.userId.toString(),
		});

		return NextResponse.json(
			{ code: 'Success', message: 'Assignment removed successfully' },
			{ status: 200 }
		);
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Validation failed', errors: error.issues },
				{ status: 400 }
			);
		}

		logger.error('Error removing tutor assignment', { error: error.message });

		return NextResponse.json(
			{ code: 'ServerError', message: 'Internal Server Error' },
			{ status: 500 }
		);
	}
}

export const DELETE = withRole(['admin'], handler);
