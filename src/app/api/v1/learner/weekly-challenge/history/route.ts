// GET /api/v1/learner/weekly-challenge/history — all weekly challenges for the authenticated learner
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { ChallengeRepository } from '@/domain/challenges/challenge.repository';
import { ChallengeService } from '@/domain/challenges/challenge.service';
import '@/models/weekly-challenge';

async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
) {
	await connectToDatabase();

	const challenges = await challengeService.getAllChallenges(context.userId);

	return apiResponse.success({ challenges });
}

export const GET = withRole(['user'], withErrorHandler(getHandler));

// ─── Service instantiation ───────────────────────────────────────────────────

const challengeRepo = new ChallengeRepository();
const challengeService = new ChallengeService(challengeRepo);
