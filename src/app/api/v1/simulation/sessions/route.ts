// POST /api/v1/simulation/sessions — a student starts a Simulation Room session
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';
import { Types } from 'mongoose';
import SimulationScenario from '@/models/simulation-scenario';
import SimulationSession from '@/models/simulation-session';

const startSessionBodySchema = z.object({
	scenarioId: z.string().min(1, 'Scenario ID is required'),
});

async function handler(
	req: NextRequest,
	ctx: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		const body = await req.json();
		const { scenarioId } = startSessionBodySchema.parse(body);

		await connectToDatabase();

		const scenario = await SimulationScenario.findById(scenarioId);

		if (!scenario || !scenario.isActive) {
			return NextResponse.json(
				{ code: 'NotFound', message: 'Scenario not found' },
				{ status: 404 }
			);
		}

		const isAssigned = scenario.assignedLearnerIds.some((learnerId: Types.ObjectId) =>
			learnerId.equals(ctx.userId)
		);

		if (!isAssigned) {
			return NextResponse.json(
				{ code: 'Forbidden', message: 'You are not assigned to this scenario' },
				{ status: 403 }
			);
		}

		const session = await SimulationSession.create({
			scenarioId: scenario._id,
			studentId: ctx.userId,
			assignedBy: scenario.createdBy,
			status: 'in_progress',
			startedAt: new Date(),
			currentPhaseIndex: 0,
			briefingComplete: false,
			turns: [],
		});

		return NextResponse.json(
			{
				code: 'Success',
				data: {
					sessionId: session._id,
					background: scenario.background,
					maxDurationMinutes: scenario.maxDurationMinutes,
				},
			},
			{ status: 201 }
		);
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			const firstIssue = error.issues?.[0];
			return NextResponse.json(
				{ code: 'ValidationError', message: firstIssue?.message ?? 'Invalid input' },
				{ status: 400 }
			);
		}
		logger.error('[SimulationSessions] POST error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to start simulation session' },
			{ status: 500 }
		);
	}
}

export const POST = withRole(['user'], handler);
