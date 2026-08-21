import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { listEnrollmentsForAdmin } from '@/domain/precision-clinic/clinic-enrollment.service';
import '@/models/learner-precision-clinic-enrollment';

async function getHandler(req: NextRequest) {
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const learnerId = searchParams.get('learnerId')?.trim() || undefined;

  const enrollments = await listEnrollmentsForAdmin(learnerId);

  return apiResponse.success({ enrollments });
}

export const GET = withRole(['admin'], withErrorHandler(getHandler));
