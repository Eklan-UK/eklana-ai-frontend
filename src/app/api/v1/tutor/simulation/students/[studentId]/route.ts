// GET /api/v1/tutor/simulation/students/[studentId] — aggregate simulation
// performance summary for one student across all completed sessions, for
// tutors/admins. Lightweight by design; full per-session detail lives at
// /api/v1/tutor/simulation/sessions/[sessionId].
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import SimulationSession from '@/models/simulation-session';
// Registers the SimulationScenario model so populate('scenarioId') can resolve it
import '@/models/simulation-scenario';
import { assertStaffCanReadLearner } from '@/lib/api/staff-learner-access';

interface SimulationGrammarError {
	studentTurnNumber: number;
	quotedText: string;
	errorType: 'phrasing_error' | 'context_error';
	correctedVersion: string;
	explanation: string;
}

interface SimulationCompetencyScore {
	competencyName: string;
	rating: 'exceeds' | 'meets' | 'fails';
	evidence: string;
}

interface SimulationOverallGradeResult {
	pronunciation?: { gradedTurnCount: number; failedTurnCount: number };
	grammar?: { errors: SimulationGrammarError[] };
	competency?: { competencyScores: SimulationCompetencyScore[]; overallSummary: string };
	gradedAt?: Date;
}

interface PopulatedSimulationSession {
	_id: Types.ObjectId;
	scenarioId: { _id: Types.ObjectId; title: string } | null;
	completedAt?: Date;
	overallGradeResult?: SimulationOverallGradeResult;
}

async function getHandler(
	req: NextRequest,
	ctx: { userId: Types.ObjectId; userRole: string },
	params: { studentId: string },
): Promise<NextResponse> {
	try {
		const { studentId } = params;

		if (!studentId || !Types.ObjectId.isValid(studentId)) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Invalid student ID' },
				{ status: 400 },
			);
		}

		await connectToDatabase();

		const access = await assertStaffCanReadLearner(ctx, studentId);

		if (access === 'forbidden') {
			return NextResponse.json(
				{ code: 'NotFound', message: 'Student not found' },
				{ status: 404 },
			);
		}

		const sessions = (await SimulationSession.find({
			studentId: new Types.ObjectId(studentId),
			status: 'completed',
		})
			.sort({ completedAt: -1 })
			.populate('scenarioId', 'title')
			.lean()) as unknown as PopulatedSimulationSession[];

		const sessionsSummary = sessions.map((session) => ({
			sessionId: session._id,
			scenarioTitle: session.scenarioId?.title ?? '',
			completedAt: session.completedAt,
			competencyOverallSummary: session.overallGradeResult?.competency?.overallSummary ?? '',
			grammarErrorCount: session.overallGradeResult?.grammar?.errors?.length ?? 0,
		}));

		let gradedTurnSum = 0;
		let gradedTurnSessionCount = 0;
		const grammarErrorTypeFreq: Record<'phrasing_error' | 'context_error', number> = {
			phrasing_error: 0,
			context_error: 0,
		};
		const competencyRatingCounts = { exceeds: 0, meets: 0, fails: 0 };

		for (const session of sessions) {
			const pronunciation = session.overallGradeResult?.pronunciation;
			if (pronunciation) {
				gradedTurnSum += pronunciation.gradedTurnCount;
				gradedTurnSessionCount++;
			}

			for (const err of session.overallGradeResult?.grammar?.errors ?? []) {
				grammarErrorTypeFreq[err.errorType]++;
			}

			for (const score of session.overallGradeResult?.competency?.competencyScores ?? []) {
				competencyRatingCounts[score.rating]++;
			}
		}

		const avgPronunciationGradedTurns =
			gradedTurnSessionCount > 0 ? gradedTurnSum / gradedTurnSessionCount : 0;

		let mostCommonGrammarErrorType: 'phrasing_error' | 'context_error' | null = null;
		if (grammarErrorTypeFreq.phrasing_error > 0 || grammarErrorTypeFreq.context_error > 0) {
			mostCommonGrammarErrorType =
				grammarErrorTypeFreq.phrasing_error >= grammarErrorTypeFreq.context_error
					? 'phrasing_error'
					: 'context_error';
		}

		return NextResponse.json(
			{
				code: 'Success',
				data: {
					studentId,
					totalSessionsCompleted: sessions.length,
					sessionsSummary,
					trends: {
						avgPronunciationGradedTurns,
						mostCommonGrammarErrorType,
						competencyRatingCounts,
					},
				},
			},
			{ status: 200 },
		);
	} catch (error: any) {
		logger.error('[TutorSimulationStudentSummary] GET error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to fetch simulation summary' },
			{ status: 500 },
		);
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ studentId: string }> },
) {
	const resolvedParams = await params;
	return withRole(['tutor', 'admin'], (req, context) =>
		getHandler(req, context, resolvedParams),
	)(req);
}
