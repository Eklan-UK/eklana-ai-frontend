import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { parseRequestBody } from '@/lib/api/request-parser';
import { validateRequest } from '@/lib/api/validation';
import {
  getEnrolledPartsForLearner,
  setLearnerEnrollments,
} from '@/domain/learning-journey/mission-enrollment.service';
import { learningJourneyPartSchema } from '@/domain/learning-journey/learning-journey.validation';
import {
  assertStaffCanReadLearner,
  resolveLearnerIdToUserIdString,
} from '@/lib/api/staff-learner-access';
import '@/models/learner-mission-enrollment';

const putBodySchema = z.object({
  parts: z.array(learningJourneyPartSchema),
});

async function getHandler(
  _req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { learnerId: string },
) {
  await connectToDatabase();

  const canonicalLearnerId = await resolveLearnerIdToUserIdString(params.learnerId);

  if (context.userRole === 'user') {
    if (canonicalLearnerId !== context.userId.toString()) {
      return apiResponse.forbidden('You can only view your own enrollments');
    }
  } else {
    const access = await assertStaffCanReadLearner(context, canonicalLearnerId);
    if (access === 'forbidden') {
      return apiResponse.notFound('Learner');
    }
  }

  const enrolledParts = await getEnrolledPartsForLearner(canonicalLearnerId);

  return apiResponse.success({
    learnerId: canonicalLearnerId,
    enrolledParts,
  });
}

async function putHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { learnerId: string },
) {
  await connectToDatabase();

  const canonicalLearnerId = await resolveLearnerIdToUserIdString(params.learnerId);
  const access = await assertStaffCanReadLearner(context, canonicalLearnerId);
  if (access === 'forbidden') {
    return apiResponse.notFound('Learner not found or access denied');
  }

  const body = await parseRequestBody(req);
  const validated = validateRequest(putBodySchema, body);

  const enrolledParts = await setLearnerEnrollments({
    learnerId: canonicalLearnerId,
    parts: validated.parts,
    enrolledBy: context.userId.toString(),
  });

  return apiResponse.success({
    learnerId: canonicalLearnerId,
    enrolledParts,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ learnerId: string }> },
) {
  const resolvedParams = await params;
  return withRole(
    ['admin', 'tutor', 'user'],
    withErrorHandler((r, ctx) => getHandler(r, ctx, resolvedParams)),
  )(req);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ learnerId: string }> },
) {
  const resolvedParams = await params;
  return withRole(
    ['admin', 'tutor'],
    withErrorHandler((r, ctx) => putHandler(r, ctx, resolvedParams)),
  )(req);
}
