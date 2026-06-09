// GET /api/v1/learner/weekly-challenge/history — list all weekly challenges for the learner
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { getWeeklyChallengeHistory } from '@/domain/challenges/weekly-challenge.service';
import '@/models/weekly-challenge';

async function getHandler(
	_req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
) {
	await connectToDatabase();
	const result = await getWeeklyChallengeHistory(context.userId);
	return apiResponse.success(result);
}

export const GET = withRole(['user'], withErrorHandler(getHandler));
