import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { listEnrollmentsForStaff } from '@/domain/learning-journey/mission-enrollment.service';
import '@/models/learner-mission-enrollment';

async function getHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
) {
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const learnerId = searchParams.get('learnerId')?.trim() || undefined;

  const enrollments = await listEnrollmentsForStaff({
    userId: context.userId,
    userRole: context.userRole,
    learnerIdFilter: learnerId,
  });

  return apiResponse.success({ enrollments });
}

export const GET = withRole(['admin', 'tutor'], withErrorHandler(getHandler));
