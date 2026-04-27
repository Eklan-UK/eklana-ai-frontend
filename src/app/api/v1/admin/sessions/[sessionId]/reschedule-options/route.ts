// GET /api/v1/admin/sessions/[sessionId]/reschedule-options — same-week alternatives
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
  _context: { userId: Types.ObjectId; userRole: string },
  params: { sessionId: string },
) {
  await connectToDatabase();
  const svc = new RescheduleService();
  const { slots, weekPolicy } = await svc.getAdminRescheduleSlots(params.sessionId);

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
    ['admin'],
    withErrorHandler((r, c) => getHandler(r, c, params)),
  )(req);
}
