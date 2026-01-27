// GET /api/v1/users/streak - Get user's streak data
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { StreakService } from '@/services/streak.service';
import { apiResponse } from '@/lib/api/response';

async function getHandler(
  req: NextRequest,
  context: { userId: any; userRole: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();
    const streakData = await StreakService.getStreakData(context.userId.toString());
    return apiResponse.success(streakData);
  } catch (error: any) {
    return apiResponse.serverError(error);
  }
}

export const GET = withAuth(getHandler);

