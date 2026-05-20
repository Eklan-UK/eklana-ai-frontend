// GET  /api/v1/admin/free-talk/scenarios — list all scenarios
// POST /api/v1/admin/free-talk/scenarios — create a scenario
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';
import FreeTalkScenario from '@/models/free-talk-scenario';
import {
	freeTalkScenarioBodySchema,
	serializeFreeTalkScenario,
} from '@/lib/free-talk-scenario-api-schema';
import { purgeExpiredFreeTalkScenarios } from '@/lib/free-talk-scenario-purge';
import { Types } from 'mongoose';

async function getHandler(
	_req: NextRequest,
	_ctx: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();
		await purgeExpiredFreeTalkScenarios();
		const scenarios = await FreeTalkScenario.find()
			.sort({ createdAt: -1 })
			.lean()
			.exec();

		const data = scenarios.map((doc) => serializeFreeTalkScenario(doc as Record<string, unknown>));

		return NextResponse.json({ code: 'Success', data }, { status: 200 });
	} catch (error: any) {
		logger.error('[FreeTalkScenarios] GET error', { error: error.message });
		return NextResponse.json({ code: 'ServerError', message: 'Failed to fetch scenarios' }, { status: 500 });
	}
}

async function postHandler(
	req: NextRequest,
	ctx: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		const body = await req.json();
		const validated = freeTalkScenarioBodySchema.parse(body);

		await connectToDatabase();

		const assignedLearnerIds = validated.allLearners ? [] : validated.assignedLearnerIds;

		const scenario = await FreeTalkScenario.create({
			title: validated.title,
			background: validated.background,
			task: validated.task,
			include: validated.include,
			usefulPhrases: validated.usefulPhrases,
			scenarioType: validated.scenarioType,
			hint: validated.hint,
			completionDate: validated.completionDate,
			allLearners: validated.allLearners,
			assignedLearnerIds,
			createdBy: ctx.userId,
		});

		return NextResponse.json(
			{
				code: 'Success',
				data: serializeFreeTalkScenario(scenario.toObject() as Record<string, unknown>),
			},
			{ status: 201 }
		);
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			const firstIssue = (error as z.ZodError).issues?.[0];
			return NextResponse.json(
				{ code: 'ValidationError', message: firstIssue?.message ?? 'Invalid input' },
				{ status: 400 }
			);
		}
		logger.error('[FreeTalkScenarios] POST error', { error: error.message });
		return NextResponse.json({ code: 'ServerError', message: 'Failed to create scenario' }, { status: 500 });
	}
}

export const GET = withRole(['admin'], getHandler);
export const POST = withRole(['admin'], postHandler);
