// GET /api/v1/pronunciation
// Compute and return the current learner's pronunciation metrics
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { Types } from 'mongoose';
import { apiResponse } from '@/lib/api/response';
import { computePronunciationMetrics } from '@/domain/pronunciation/pronunciation.service';

async function getHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
) {
  await connectToDatabase();

  const metrics = await computePronunciationMetrics(context.userId.toString());

  return apiResponse.success({ pronunciation: metrics });
}

export const GET = withRole(['user'], withErrorHandler(getHandler));
