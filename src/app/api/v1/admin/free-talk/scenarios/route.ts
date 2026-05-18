// GET  /api/v1/admin/free-talk/scenarios — list all scenarios
// POST /api/v1/admin/free-talk/scenarios — create a scenario
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';
import FreeTalkScenario, { FREE_TALK_SCENARIO_TYPES } from '@/models/free-talk-scenario';
import { Types } from 'mongoose';

// ── GET ──────────────────────────────────────────────────────────────────────

async function getHandler(
	_req: NextRequest,
	_ctx: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();
		const scenarios = await FreeTalkScenario.find()
			.sort({ createdAt: -1 })
			.lean()
			.exec();

		return NextResponse.json({ code: 'Success', data: scenarios }, { status: 200 });
	} catch (error: any) {
		logger.error('[FreeTalkScenarios] GET error', { error: error.message });
		return NextResponse.json({ code: 'ServerError', message: 'Failed to fetch scenarios' }, { status: 500 });
	}
}

// ── POST ─────────────────────────────────────────────────────────────────────

const createSchema = z.object({
	title: z.string().min(1, 'Title is required').max(200),
	background: z.string().min(1, 'Background is required'),
	task: z.string().min(1, 'Task is required'),
	include: z.array(z.string()).default([]),
	usefulPhrases: z.array(z.string()).default([]),
	scenarioType: z.enum([...FREE_TALK_SCENARIO_TYPES] as [string, ...string[]]),
	hint: z.string().default(''),
});

async function postHandler(
	req: NextRequest,
	ctx: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		const body = await req.json();
		const validated = createSchema.parse(body);

		await connectToDatabase();

		const scenario = await FreeTalkScenario.create({
			...validated,
			createdBy: ctx.userId,
		});

		return NextResponse.json({ code: 'Success', data: scenario }, { status: 201 });
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
