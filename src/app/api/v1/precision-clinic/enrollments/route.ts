import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { listEnrollmentsForAdmin } from '@/domain/precision-clinic/clinic-enrollment.service';
import { resolveTutorScopedLearnerIds } from '@/lib/api/staff-learner-access';
import '@/models/learner-precision-clinic-enrollment';

async function getHandler(
  req: NextRequest,
  context: { userId: string; userRole: string },
) {
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const learnerId = searchParams.get('learnerId')?.trim() || undefined;

  const scoped = await resolveTutorScopedLearnerIds(
    context,
    learnerId ? [learnerId] : undefined,
  );
  if (!scoped.ok) {
    return apiResponse.notFound('Enrollments');
  }

  const enrollments = await listEnrollmentsForAdmin(scoped.learnerIds);

  return apiResponse.success({ enrollments });
}

export const GET = withRole(['admin', 'tutor'], withErrorHandler(getHandler));
