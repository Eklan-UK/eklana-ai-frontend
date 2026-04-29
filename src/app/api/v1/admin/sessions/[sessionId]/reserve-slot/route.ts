// POST /api/v1/admin/sessions/[sessionId]/reserve-slot — pessimistic hold on a reschedule time
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { parseRequestBody } from '@/lib/api/request-parser';
import { RescheduleService } from '@/domain/classes/reschedule.service';
import '@/models/class-slot-reservation';
import '@/models/class-session';

const bodySchema = z.object({
  startUtc: z.string(),
  endUtc: z.string(),
});

async function postHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { sessionId: string },
) {
  await connectToDatabase();
  const raw = await parseRequestBody(req);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return apiResponse.error('ValidationError', parsed.error.message, 400);
  }

  const svc = new RescheduleService();
  const data = await svc.createAdminRescheduleSlotReservation(
    params.sessionId,
    context.userId,
    parsed.data.startUtc,
    parsed.data.endUtc,
  );

  return apiResponse.success(data);
}

export async function POST(
  req: NextRequest,
  segment: { params: Promise<{ sessionId: string }> },
) {
  const params = await segment.params;
  return withRole(
    ['admin'],
    withErrorHandler((r, c) => postHandler(r, c, params)),
  )(req);
}
