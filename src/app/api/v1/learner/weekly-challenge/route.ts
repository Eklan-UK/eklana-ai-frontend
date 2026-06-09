// GET /api/v1/learner/weekly-challenge — get weekly challenge for a specific week (defaults to current)
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { z } from 'zod';
import { getWeeklyChallengeForWeek } from '@/domain/challenges/weekly-challenge.service';
import { currentWeekStartUtc } from '@/lib/challenges/utc-week-challenge';
import '@/models/weekly-challenge';

const weekStartDateSchema = z.string().datetime();

async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
) {
	await connectToDatabase();

	const { searchParams } = new URL(req.url);
	const weekStartDateParam = searchParams.get('weekStartDate');

	let weekStartDate: Date;
	if (weekStartDateParam) {
		const parsed = weekStartDateSchema.safeParse(weekStartDateParam);
		if (!parsed.success) {
			return apiResponse.validationError('weekStartDate must be an ISO datetime string');
		}
		weekStartDate = new Date(parsed.data);
	} else {
		weekStartDate = currentWeekStartUtc();
	}

	const challenge = await getWeeklyChallengeForWeek(
		context.userId,
		weekStartDate,
	);

	return apiResponse.success(challenge);
}

export const GET = withRole(['user'], withErrorHandler(getHandler));
