// DELETE /api/v1/admin/simulation/scenarios/[scenarioId] — soft-delete a scenario
// (isActive: false). Matches the isActive pattern already used on this model:
// an explicit status boolean, not a TTL index, so scenarios remain queryable
// for reporting/audit after deletion.
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import SimulationScenario from '@/models/simulation-scenario';

async function deleteHandler(
	req: NextRequest,
	ctx: { userId: Types.ObjectId; userRole: string },
	params: { scenarioId: string },
): Promise<NextResponse> {
	try {
		const { scenarioId } = params;

		if (!scenarioId || !Types.ObjectId.isValid(scenarioId)) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Invalid scenario ID' },
				{ status: 400 },
			);
		}

		await connectToDatabase();

		const scenario = await SimulationScenario.findOne({ _id: scenarioId, isActive: true });

		if (!scenario) {
			return NextResponse.json(
				{ code: 'NotFound', message: 'Scenario not found' },
				{ status: 404 },
			);
		}

		scenario.isActive = false;
		await scenario.save();

		return NextResponse.json({ code: 'Success', data: null }, { status: 200 });
	} catch (error: any) {
		logger.error('[SimulationScenarioDetail] DELETE error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to delete scenario' },
			{ status: 500 },
		);
	}
}

export async function DELETE(
	req: NextRequest,
	{ params }: { params: Promise<{ scenarioId: string }> },
) {
	const resolvedParams = await params;
	return withRole(['tutor', 'admin'], (req, context) =>
		deleteHandler(req, context, resolvedParams),
	)(req);
}
