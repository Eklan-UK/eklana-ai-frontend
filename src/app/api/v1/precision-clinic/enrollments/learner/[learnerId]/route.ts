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
  getLearnerEnrollment,
  setLearnerEnrollment,
} from '@/domain/precision-clinic/clinic-enrollment.service';
import {
  assertStaffCanReadLearner,
  resolveLearnerIdToUserIdString,
} from '@/lib/api/staff-learner-access';
import '@/models/learner-precision-clinic-enrollment';

const putBodySchema = z.object({
  enrolled: z.boolean(),
});

async function getHandler(
  _req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { learnerId: string },
) {
  await connectToDatabase();

  const canonicalLearnerId = await resolveLearnerIdToUserIdString(
    params.learnerId,
  );
  const access = await assertStaffCanReadLearner(context, canonicalLearnerId);
  if (access === 'forbidden') {
    return apiResponse.notFound('Learner');
  }

  const enrollment = await getLearnerEnrollment(canonicalLearnerId);

  return apiResponse.success(enrollment);
}

async function putHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { learnerId: string },
) {
  await connectToDatabase();

  const canonicalLearnerId = await resolveLearnerIdToUserIdString(
    params.learnerId,
  );
  const access = await assertStaffCanReadLearner(context, canonicalLearnerId);
  if (access === 'forbidden') {
    return apiResponse.notFound('Learner not found or access denied');
  }

  const body = await parseRequestBody(req);
  const validated = validateRequest(putBodySchema, body);

  const enrolled = await setLearnerEnrollment({
    learnerId: canonicalLearnerId,
    enrolled: validated.enrolled,
    enrolledBy: context.userId.toString(),
  });

  return apiResponse.success({
    learnerId: canonicalLearnerId,
    enrolled,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ learnerId: string }> },
) {
  const resolvedParams = await params;
  return withRole(
    ['admin'],
    withErrorHandler((r, ctx) => getHandler(r, ctx, resolvedParams)),
  )(req);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ learnerId: string }> },
) {
  const resolvedParams = await params;
  return withRole(
    ['admin'],
    withErrorHandler((r, ctx) => putHandler(r, ctx, resolvedParams)),
  )(req);
}
