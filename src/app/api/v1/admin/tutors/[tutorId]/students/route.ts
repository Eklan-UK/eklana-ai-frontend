// GET /api/v1/admin/tutors/[tutorId]/students
// List learners actively assigned to a specific tutor (admin use)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import TutorAssignment from '@/models/tutor-assignment';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { tutorId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { tutorId } = params;

		if (!Types.ObjectId.isValid(tutorId)) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Invalid tutor ID' },
				{ status: 400 }
			);
		}

		const { searchParams } = new URL(req.url);
		const search = searchParams.get('search') || '';

		const tutorOid = new Types.ObjectId(tutorId);

		const assignments = await TutorAssignment.find({ tutorId: tutorOid, status: 'active' })
			.select('learnerId assignedBy assignedAt')
			.populate('assignedBy', 'firstName lastName email')
			.sort({ assignedAt: -1 })
			.lean()
			.exec();

		const learnerIds = assignments.map((a) => a.learnerId);

		const learnerQuery: any = { _id: { $in: learnerIds }, role: 'user' };
		if (search) {
			learnerQuery.$or = [
				{ firstName: { $regex: search, $options: 'i' } },
				{ lastName: { $regex: search, $options: 'i' } },
				{ email: { $regex: search, $options: 'i' } },
			];
		}

		const users = await User.find(learnerQuery)
			.select('_id firstName lastName email createdAt')
			.lean()
			.exec();

		const userMap = new Map(users.map((u) => [u._id.toString(), u]));

		const students = assignments
			.filter((a) => userMap.has(a.learnerId.toString()))
			.map((a) => {
				const user = userMap.get(a.learnerId.toString())!;
				return {
					assignmentId: a._id.toString(),
					id: user._id.toString(),
					firstName: user.firstName,
					lastName: user.lastName,
					name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email,
					email: user.email,
					assignedAt: a.assignedAt,
					assignedBy: a.assignedBy,
				};
			});

		return NextResponse.json({ students, total: students.length }, { status: 200 });
	} catch (error: any) {
		logger.error('Error fetching tutor assigned students', { error: error.message });
		return NextResponse.json(
			{ code: 'ServerError', message: 'Internal Server Error' },
			{ status: 500 }
		);
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ tutorId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['admin'], (req, context) => handler(req, context, resolvedParams))(req);
}
