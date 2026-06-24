// POST /api/v1/badges/evaluate - Evaluate badge unlocks without blocking drill completion
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { triggerBadgeEvaluation } from '@/services/streak.service';

async function handler(
	_req: NextRequest,
	context: { userId: { toString(): string }; userRole: string },
) {
	if (context.userRole !== 'user') {
		return apiResponse.forbidden('Badges are only available for learners');
	}

	await connectToDatabase();
	const badgesUnlocked = await triggerBadgeEvaluation(context.userId.toString());
	return apiResponse.success({ badgesUnlocked });
}

export const POST = withAuth(withErrorHandler(handler));
