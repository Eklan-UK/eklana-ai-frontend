// GET /api/v1/learner/weekly-challenge/items/[index] — full drill item for practice
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse, NotFoundError, ValidationError } from '@/lib/api/response';
import { getWeeklyChallengeItem } from '@/domain/challenges/weekly-challenge.service';
import { currentWeekStartUtc } from '@/lib/challenges/utc-week-challenge';
import '@/models/weekly-challenge';

const weekStartDateSchema = z.string().datetime();

function parseWeekStartDate(req: NextRequest): Date {
	const weekStartDateParam = new URL(req.url).searchParams.get('weekStartDate');
	if (!weekStartDateParam) {
		return currentWeekStartUtc();
	}
	const parsed = weekStartDateSchema.safeParse(weekStartDateParam);
	if (!parsed.success) {
		throw new ValidationError('weekStartDate must be an ISO datetime string');
	}
	return new Date(parsed.data);
}

async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { index: string },
) {
	await connectToDatabase();
	
	const itemId = params.index;
	let index: number;
	let challengeId: string | undefined;

	if (itemId.includes('-')) {
		const parts = itemId.split('-');
		challengeId = parts[0];
		index = parseInt(parts[1] ?? '', 10);
	} else {
		index = parseInt(itemId, 10);
	}

	if (Number.isNaN(index) || index < 0) {
		throw new ValidationError('Invalid item index');
	}

	const weekStartDate = parseWeekStartDate(req);
	const item = await getWeeklyChallengeItem(
		context.userId,
		index,
		weekStartDate,
		new Date(),
		challengeId,
	);
	if (!item) {
		throw new NotFoundError('Weekly challenge item');
	}

	return apiResponse.success(item);
}

export async function GET(
	req: NextRequest,
	segment: { params: Promise<{ index: string }> },
) {
	const params = await segment.params;
	return withRole(
		['user'],
		withErrorHandler((r, c) => getHandler(r, c, params)),
	)(req);
}
