// POST /api/v1/learner/weekly-challenge/items/[index]/complete — mark drill item complete
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse, NotFoundError, ValidationError } from '@/lib/api/response';
import { markWeeklyChallengeItemComplete } from '@/domain/challenges/weekly-challenge.service';
import '@/models/weekly-challenge';

async function postHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { index: string },
) {
	await connectToDatabase();
	const index = parseInt(params.index, 10);
	if (Number.isNaN(index) || index < 0) {
		throw new ValidationError('Invalid item index');
	}

	let score: number | undefined;
	try {
		const body = await req.json();
		if (body?.score != null) {
			score = Number(body.score);
		}
	} catch {
		// empty body is fine
	}

	const result = await markWeeklyChallengeItemComplete(context.userId, index, score);
	if (!result) {
		throw new NotFoundError('Weekly challenge item');
	}

	return apiResponse.success(result);
}

export async function POST(
	req: NextRequest,
	segment: { params: Promise<{ index: string }> },
) {
	const params = await segment.params;
	return withRole(
		['user'],
		withErrorHandler((r, c) => postHandler(r, c, params)),
	)(req);
}
