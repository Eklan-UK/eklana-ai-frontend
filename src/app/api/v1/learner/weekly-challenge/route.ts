// GET /api/v1/learner/weekly-challenge — get or generate the weekly challenge for the authenticated learner
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { ChallengeRepository } from '@/domain/challenges/challenge.repository';
import { ChallengeService } from '@/domain/challenges/challenge.service';
import '@/models/weekly-challenge';

const weekStartDateSchema = z.string().datetime();

function getMostRecentMonday(): Date {
	const now = new Date();
	const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, …
	const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
	const monday = new Date(now);
	monday.setUTCDate(now.getUTCDate() + daysToMonday);
	monday.setUTCHours(0, 0, 0, 0);
	return monday;
}

async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
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
		weekStartDate = getMostRecentMonday();
	}

	const challenge = await challengeService.getOrGenerateChallenge(
		context.userId,
		weekStartDate
	);

	return apiResponse.success({ challenge });
}

export const GET = withRole(['user'], withErrorHandler(getHandler));

// ─── Service instantiation ───────────────────────────────────────────────────

const challengeRepo = new ChallengeRepository();
const challengeService = new ChallengeService(challengeRepo);
