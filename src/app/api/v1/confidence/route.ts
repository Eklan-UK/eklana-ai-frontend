// GET /api/v1/confidence - Compute and return the current learner's confidence metrics
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { Types } from 'mongoose';
import { apiResponse } from '@/lib/api/response';
import { computeConfidenceMetrics } from '@/domain/confidence/confidence.service';

async function getHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
) {
  await connectToDatabase();

  const metrics = await computeConfidenceMetrics(context.userId.toString());

  return apiResponse.success({ confidence: metrics });
}

export const GET = withRole(['user'], withErrorHandler(getHandler));
