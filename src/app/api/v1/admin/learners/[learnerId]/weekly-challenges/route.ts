import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import {
	assertStaffCanReadLearner,
	resolveLearnerIdToUserIdString,
} from '@/lib/api/staff-learner-access';
import { getStaffWeeklyChallengeHistory } from '@/domain/challenges/weekly-challenge.service';
import '@/models/weekly-challenge';

async function handler(
	_req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { learnerId: string },
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { learnerId } = params;

		const canonicalLearnerId = await resolveLearnerIdToUserIdString(learnerId);
		const access = await assertStaffCanReadLearner(context, canonicalLearnerId);
		if (access === 'forbidden') {
			return NextResponse.json(
				{ code: 'NotFound', message: 'Learner not found or access denied' },
				{ status: 404 },
			);
		}

		if (!Types.ObjectId.isValid(canonicalLearnerId)) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Invalid learner ID' },
				{ status: 400 },
			);
		}

		const result = await getStaffWeeklyChallengeHistory(
			new Types.ObjectId(canonicalLearnerId),
		);

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Weekly challenges retrieved successfully',
				data: result,
			},
			{ status: 200 },
		);
	} catch (error: any) {
		logger.error('Error fetching learner weekly challenges', {
			error: error.message,
			stack: error.stack,
			learnerId: params.learnerId,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to fetch weekly challenges',
			},
			{ status: 500 },
		);
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ learnerId: string }> },
) {
	const resolvedParams = await params;
	return withRole(['admin', 'tutor'], (req, context) => {
		return handler(req, context, resolvedParams);
	})(req);
}
