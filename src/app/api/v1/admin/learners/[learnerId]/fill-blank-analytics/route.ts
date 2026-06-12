// GET /api/v1/admin/learners/[learnerId]/fill-blank-analytics
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { Types } from 'mongoose';
import { logger } from '@/lib/api/logger';
import {
	assertStaffCanReadLearner,
	resolveLearnerIdToUserIdString,
} from '@/lib/api/staff-learner-access';
import { getLearnerFillBlankAnalytics } from '@/domain/admin/platform-analytics.service';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { learnerId: string }
): Promise<NextResponse> {
	try {
		const { learnerId } = params;

		if (!learnerId || !Types.ObjectId.isValid(learnerId)) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Invalid learner ID' },
				{ status: 400 }
			);
		}

		await connectToDatabase();

		const canonicalLearnerId = await resolveLearnerIdToUserIdString(learnerId);
		const access = await assertStaffCanReadLearner(context, canonicalLearnerId);
		if (access === 'forbidden') {
			return NextResponse.json(
				{ code: 'NotFound', message: 'Learner not found or access denied' },
				{ status: 404 }
			);
		}

		const { searchParams } = new URL(req.url);
		const from = searchParams.get('from') ?? undefined;
		const to = searchParams.get('to') ?? undefined;

		const analytics = await getLearnerFillBlankAnalytics(canonicalLearnerId, { from, to });

		return NextResponse.json(
			{
				code: 'Success',
				data: {
					...analytics.stats,
					problemRows: analytics.problemRows,
					attemptsConsidered: analytics.attemptsConsidered,
				},
			},
			{ status: 200 }
		);
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : 'Server error';
		logger.error('GET admin/learners/.../fill-blank-analytics', { error: msg });
		return NextResponse.json({ code: 'ServerError', message: msg }, { status: 500 });
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ learnerId: string }> }
) {
	const resolved = await params;
	return withRole(['admin', 'tutor'], (r, context) => handler(r, context, resolved))(req);
}
