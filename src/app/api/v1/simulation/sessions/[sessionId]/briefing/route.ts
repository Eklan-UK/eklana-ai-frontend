// GET /api/v1/simulation/sessions/[sessionId]/briefing — spoken briefing audio for a Simulation Room session
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import SimulationScenario from '@/models/simulation-scenario';
import SimulationSession from '@/models/simulation-session';

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

		if (!session.studentId.equals(ctx.userId)) {
			return NextResponse.json(
				{ code: 'Forbidden', message: 'This is not your session' },
				{ status: 403 },
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
					displayText: scenario.displayData,
					audioBase64: scenario.briefingAudioBase64,
				},
			},
			{ status: 200 },
		);
	} catch (error: any) {
		logger.error('[SimulationSessionBriefing] GET error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to generate session briefing' },
			{ status: 500 },
		);
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ sessionId: string }> },
) {
	const resolvedParams = await params;
	return withRole(['user'], (req, context) =>
		getHandler(req, context, resolvedParams),
	)(req);
}
