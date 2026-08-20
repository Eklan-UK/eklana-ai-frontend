// GET /api/v1/tutor/simulation/sessions/[sessionId] — full grading detail for a
// single simulation session, for tutors/admins reviewing a student's performance.
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import SimulationSession from '@/models/simulation-session';
import SimulationScenario from '@/models/simulation-scenario';
import { assertStaffCanReadLearner } from '@/lib/api/staff-learner-access';
import { getTopicName } from '@/config/competency-framework';

async function getHandler(
	req: NextRequest,
	ctx: { userId: Types.ObjectId; userRole: string },
	params: { sessionId: string },
): Promise<NextResponse> {
	try {
		const { sessionId } = params;

		if (!sessionId || !Types.ObjectId.isValid(sessionId)) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Invalid session ID' },
				{ status: 400 },
			);
		}

		await connectToDatabase();

		const session = await SimulationSession.findById(sessionId);

		if (!session) {
			return NextResponse.json(
				{ code: 'NotFound', message: 'Session not found' },
				{ status: 404 },
			);
		}

		const access = await assertStaffCanReadLearner(ctx, session.studentId.toString());

		if (access === 'forbidden') {
			return NextResponse.json(
				{ code: 'NotFound', message: 'Session not found' },
				{ status: 404 },
			);
		}

		const scenario = await SimulationScenario.findById(session.scenarioId);

		if (!scenario) {
			return NextResponse.json(
				{ code: 'NotFound', message: 'Scenario not found' },
				{ status: 404 },
			);
		}

		return NextResponse.json(
			{
				code: 'Success',
				data: {
					sessionId: session._id,
					// Topic is the sole scenario identifier now that title has been
					// removed — see the same tradeoff noted on the admin scenario list.
					scenarioTopic: getTopicName(scenario.topicId),
					workplaceSetting: scenario.workplaceSetting,
					studentId: session.studentId,
					status: session.status,
					startedAt: session.startedAt,
					completedAt: session.completedAt,
					turns: session.turns,
					overallGradeResult: session.overallGradeResult,
				},
			},
			{ status: 200 },
		);
	} catch (error: any) {
		logger.error('[TutorSimulationSessionDetail] GET error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to fetch simulation session' },
			{ status: 500 },
		);
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ sessionId: string }> },
) {
	const resolvedParams = await params;
	return withRole(['tutor', 'admin'], (req, context) =>
		getHandler(req, context, resolvedParams),
	)(req);
}
