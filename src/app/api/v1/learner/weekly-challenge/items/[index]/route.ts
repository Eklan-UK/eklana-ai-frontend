// GET /api/v1/learner/weekly-challenge/items/[index] — full drill item for practice
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse, NotFoundError, ValidationError } from '@/lib/api/response';
import { getWeeklyChallengeItem } from '@/domain/challenges/weekly-challenge.service';
import '@/models/weekly-challenge';

async function getHandler(
	_req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { index: string },
) {
	await connectToDatabase();
	const index = parseInt(params.index, 10);
	if (Number.isNaN(index) || index < 0) {
		throw new ValidationError('Invalid item index');
	}

	const item = await getWeeklyChallengeItem(context.userId, index);
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
