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
  const { session } = await svc.assertLearnerMayAccessSession(
    params.sessionId,
    context.userId,
  );

  const start = new Date(session.startUtc);
  const end = new Date(session.endUtc);
  const slots = svc.buildRescheduleOptions(start, end);

  return apiResponse.success({
    slots,
    weekPolicy:
      'UTC Monday–Sunday week containing the original session start (MVP). TZ-aware weeks may replace this.',
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
