// GET /api/v1/learner/precision-clinic/[weekNumber] — personal week detail
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { ValidationError } from '@/lib/api/response';
import { PrecisionClinicLearnerService } from '@/domain/precision-clinic';

async function getHandler(
	_req: NextRequest,
	context: { userId: string; userRole: string },
	params: { weekNumber: string }
) {
	await connectToDatabase();

	const weekNumber = Number(params.weekNumber);
	if (!Number.isInteger(weekNumber) || weekNumber < 1) {
		throw new ValidationError('Invalid week number');
	}

	const service = new PrecisionClinicLearnerService();
	const week = await service.getWeekDetail(
		context.userId.toString(),
		weekNumber
	);
	return apiResponse.success(week);
}

export async function GET(
	req: NextRequest,
	segment: { params: Promise<{ weekNumber: string }> }
) {
	const params = await segment.params;
	return withRole(
		['user'],
		withErrorHandler((r, c) => getHandler(r, c, params))
	)(req);
}
