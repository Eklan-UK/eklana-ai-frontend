// DELETE /api/v1/admin/free-talk/scenarios/[id]
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import FreeTalkScenario from '@/models/free-talk-scenario';
import { Types } from 'mongoose';

async function deleteHandler(
	_req: NextRequest,
	ctx: { userId: Types.ObjectId; userRole: string; params: Promise<{ id: string }> }
): Promise<NextResponse> {
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

export const DELETE = withRole(['admin'], deleteHandler);
