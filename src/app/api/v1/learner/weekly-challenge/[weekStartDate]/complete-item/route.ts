// POST /api/v1/learner/weekly-challenge/[weekStartDate]/complete-item — mark a challenge item complete
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse, NotFoundError, ValidationError } from '@/lib/api/response';
import { ChallengeRepository } from '@/domain/challenges/challenge.repository';
import { ChallengeService } from '@/domain/challenges/challenge.service';
import '@/models/weekly-challenge';

const bodySchema = z.object({
	itemIndex: z.number().int().min(0),
});

async function postHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { weekStartDate: string }
) {
	await connectToDatabase();

	const weekStartDate = new Date(params.weekStartDate);
	if (isNaN(weekStartDate.getTime())) {
		throw new ValidationError('weekStartDate must be a valid date');
	}

	const body = await req.json();
	const parsed = bodySchema.safeParse(body);
	if (!parsed.success) {
		throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid request body');
	}

	const { itemIndex } = parsed.data;

	const updated = await challengeService.completeItem(context.userId, weekStartDate, itemIndex);
	if (!updated) {
		throw new NotFoundError('Weekly challenge');
	}

	return apiResponse.success({ challenge: updated });
}

export async function POST(
	req: NextRequest,
	segment: { params: Promise<{ weekStartDate: string }> }
) {
	const params = await segment.params;
	return withRole(
		['user'],
		withErrorHandler((r, c) => postHandler(r, c, params))
	)(req);
}

// ─── Service instantiation ───────────────────────────────────────────────────

const challengeRepo = new ChallengeRepository();
const challengeService = new ChallengeService(challengeRepo);
