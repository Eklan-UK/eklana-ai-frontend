import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { getEnrolledPartsForLearner } from '@/domain/learning-journey/mission-enrollment.service';
import '@/models/learner-mission-enrollment';

async function getHandler(
  _req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
) {
  await connectToDatabase();

  const enrolledParts = await getEnrolledPartsForLearner(context.userId.toString());

  return apiResponse.success({ enrolledParts });
}

export const GET = withRole(['user'], withErrorHandler(getHandler));
