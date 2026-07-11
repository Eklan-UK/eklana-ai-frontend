// GET /api/v1/drills/learner/saved-drills - Bookmark-first saved drills list
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { apiResponse } from '@/lib/api/response';
import { getLearnerSavedDrillsPayload } from '@/lib/server/learner-saved-drills.server';

async function getHandler(
  req: NextRequest,
  context: { userId: string; userRole: string },
) {
  const payload = await getLearnerSavedDrillsPayload(context.userId);
  return apiResponse.success(payload);
}

export const GET = withRole(['user'], withErrorHandler(getHandler));
