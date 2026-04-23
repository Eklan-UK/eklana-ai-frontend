// GET /api/v1/learner/sessions/past — ended sessions for the enrolled learner (newest first)
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { ClassRepository } from '@/domain/classes/class.repository';
import '@/models/class-series';
import '@/models/class-enrollment';
import '@/models/class-session';
import '@/models/session-attendance';

async function getHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
) {
  await connectToDatabase();
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);
  const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;

  const repo = new ClassRepository();
  const { items, total } = await repo.findLearnerPastSessionInstances({
    learnerId: context.userId,
    limit,
    offset,
  });

  return apiResponse.success({
    sessions: items,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    },
  });
}

export const GET = withRole(['user'], withErrorHandler(getHandler));
