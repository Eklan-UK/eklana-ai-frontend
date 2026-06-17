// GET /api/v1/progress/scorecard — Student Progress Scorecard (Pronunciation, Accuracy, Fluency, Confidence)
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { Types } from 'mongoose';
import { apiResponse } from '@/lib/api/response';
import { computeProgressScorecard } from '@/domain/progress/progress-scorecard.service';

async function getHandler(
	_req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
) {
	const scorecard = await computeProgressScorecard(context.userId.toString());
	return apiResponse.success({ scorecard });
}

export const GET = withRole(['user'], withErrorHandler(getHandler));
