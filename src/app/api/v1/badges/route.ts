// GET /api/v1/badges - Get learner badge state
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { BadgeService } from '@/domain/badges/badge.service';

async function getHandler(
  _req: NextRequest,
  context: { userId: { toString(): string }; userRole: string }
): Promise<NextResponse> {
  if (context.userRole !== 'user') {
    return apiResponse.forbidden('Badges are only available for learners');
  }

  try {
    await connectToDatabase();
    const userId = context.userId.toString();
    await BadgeService.evaluateAndUnlock(userId);
    const state = await BadgeService.getBadgeState(userId);
    return apiResponse.success(state);
  } catch (error: unknown) {
    return apiResponse.serverError(error);
  }
}

export const GET = withAuth(getHandler);
