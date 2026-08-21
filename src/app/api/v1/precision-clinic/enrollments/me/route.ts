import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { isLearnerEnrolled } from '@/domain/precision-clinic/clinic-enrollment.service';
import '@/models/learner-precision-clinic-enrollment';

async function getHandler(
  _req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
) {
  await connectToDatabase();

  const enrolled = await isLearnerEnrolled(context.userId.toString());

  return apiResponse.success({ enrolled });
}

export const GET = withRole(['user'], withErrorHandler(getHandler));
