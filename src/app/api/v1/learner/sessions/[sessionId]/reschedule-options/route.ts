// GET /api/v1/learner/sessions/[sessionId]/reschedule-options — same-week alternatives (Phase 5)
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { RescheduleService } from '@/domain/classes/reschedule.service';
import '@/models/class-session';

async function getHandler(
  _req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { sessionId: string },
) {
  await connectToDatabase();
  const svc = new RescheduleService();
  const { slots, weekPolicy } = await svc.getLearnerRescheduleSlots(
    params.sessionId,
    context.userId,
  );

  return apiResponse.success({
    slots,
    weekPolicy,
  });
}

export async function GET(
  req: NextRequest,
  segment: { params: Promise<{ sessionId: string }> },
) {
  const params = await segment.params;
  return withRole(
    ['user'],
    withErrorHandler((r, c) => getHandler(r, c, params)),
  )(req);
}
