// GET /api/v1/admin/learners/[learnerId]/ai-sessions
// List persisted Eklan AI session summaries for a learner (admin or assigned tutor)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { Types } from 'mongoose';
import AiSession from '@/models/ai-session';
import { logger } from '@/lib/api/logger';
import {
	assertStaffCanReadLearner,
	resolveLearnerIdToUserIdString,
} from '@/lib/api/staff-learner-access';
import type { AiSessionMode } from '@/types/ai-session-summary';

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
		const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
		const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));
		const modeParam = searchParams.get('mode');
		const modeFilter: AiSessionMode | undefined =
			modeParam === 'drill' || modeParam === 'free' || modeParam === 'topic'
				? modeParam
				: undefined;

		const userOid = new Types.ObjectId(canonicalLearnerId);
		const baseFilter = {
			userId: userOid,
			...(modeFilter ? { mode: modeFilter } : {}),
		};

		const [items, total] = await Promise.all([
			AiSession.find(baseFilter)
				.sort({ endedAt: -1 })
				.skip(offset)
				.limit(limit)
				.select('mode topic drillId summary endedAt createdAt')
				.lean()
				.exec(),
			AiSession.countDocuments(baseFilter).exec(),
		]);

		return NextResponse.json(
			{
				code: 'Success',
				data: {
					sessions: items.map((s) => ({
						id: s._id.toString(),
						mode: s.mode,
						topic: s.topic,
						drillId: s.drillId?.toString(),
						summary: s.summary,
						endedAt: s.endedAt,
						createdAt: s.createdAt,
					})),
					total,
					limit,
					offset,
				},
			},
			{ status: 200 }
		);
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : 'Server error';
		logger.error('GET admin/learners/.../ai-sessions', { error: msg });
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
