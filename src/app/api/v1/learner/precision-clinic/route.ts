// GET /api/v1/learner/precision-clinic — personal Clinic week history
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { PrecisionClinicLearnerService } from '@/domain/precision-clinic';

async function getHandler(
	_req: NextRequest,
	context: { userId: string; userRole: string }
) {
	await connectToDatabase();
	const service = new PrecisionClinicLearnerService();
	const result = await service.getHistory(context.userId.toString());
	return apiResponse.success(result);
}

export const GET = withRole(['user'], withErrorHandler(getHandler));
