// PATCH  /api/v1/admin/free-talk/scenarios/[id] — update scenario + assignment
// DELETE /api/v1/admin/free-talk/scenarios/[id]
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';
import FreeTalkScenario from '@/models/free-talk-scenario';
import {
	freeTalkScenarioPatchSchema,
	serializeFreeTalkScenario,
} from '@/lib/free-talk-scenario-api-schema';
import { Types } from 'mongoose';

type RouteCtx = {
	userId: Types.ObjectId;
	userRole: string;
	params: Promise<{ id: string }>;
};

async function patchHandler(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
	try {
		const { id } = await ctx.params;
		if (!Types.ObjectId.isValid(id)) {
			return NextResponse.json({ code: 'ValidationError', message: 'Invalid scenario id' }, { status: 400 });
		}

		const body = await req.json();
		const validated = freeTalkScenarioPatchSchema.parse(body);

		await connectToDatabase();

		const existing = await FreeTalkScenario.findById(id).lean().exec();
		if (!existing) {
			return NextResponse.json({ code: 'NotFound', message: 'Scenario not found' }, { status: 404 });
		}

		const update: Record<string, unknown> = { ...validated };
		delete update.assignedLearnerIds;

		const allLearners =
			validated.allLearners !== undefined ? validated.allLearners : existing.allLearners !== false;

		if (validated.allLearners !== undefined || validated.assignedLearnerIds !== undefined) {
			update.allLearners = allLearners;
			if (allLearners) {
				update.assignedLearnerIds = [];
			} else {
				update.assignedLearnerIds =
					validated.assignedLearnerIds ??
					(existing.assignedLearnerIds as Types.ObjectId[] | undefined) ??
					[];
			}
		}

		const scenario = await FreeTalkScenario.findByIdAndUpdate(id, update, { new: true }).lean().exec();
		if (!scenario) {
			return NextResponse.json({ code: 'NotFound', message: 'Scenario not found' }, { status: 404 });
		}

		return NextResponse.json({
			code: 'Success',
			data: serializeFreeTalkScenario(scenario as Record<string, unknown>),
		});
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			const firstIssue = (error as z.ZodError).issues?.[0];
			return NextResponse.json(
				{ code: 'ValidationError', message: firstIssue?.message ?? 'Invalid input' },
				{ status: 400 }
			);
		}
		logger.error('[FreeTalkScenarios] PATCH error', { error: error.message });
		return NextResponse.json({ code: 'ServerError', message: 'Failed to update scenario' }, { status: 500 });
	}
}

async function deleteHandler(_req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
	try {
		const { id } = await ctx.params;
		if (!Types.ObjectId.isValid(id)) {
			return NextResponse.json({ code: 'ValidationError', message: 'Invalid scenario id' }, { status: 400 });
		}

		await connectToDatabase();
		const deleted = await FreeTalkScenario.findByIdAndDelete(id).lean().exec();

		if (!deleted) {
			return NextResponse.json({ code: 'NotFound', message: 'Scenario not found' }, { status: 404 });
		}

		return NextResponse.json({ code: 'Success', message: 'Scenario deleted' }, { status: 200 });
	} catch (error: any) {
		logger.error('[FreeTalkScenarios] DELETE error', { error: error.message });
		return NextResponse.json({ code: 'ServerError', message: 'Failed to delete scenario' }, { status: 500 });
	}
}

export const PATCH = withRole(['admin'], patchHandler);
export const DELETE = withRole(['admin'], deleteHandler);
