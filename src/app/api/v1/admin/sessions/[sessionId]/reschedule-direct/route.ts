// POST /api/v1/admin/sessions/[sessionId]/reschedule-direct — admin-only, any future time (cross-week)
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { parseRequestBody } from '@/lib/api/request-parser';
import { RescheduleService } from '@/domain/classes/reschedule.service';
import '@/models/class-session';

const bodySchema = z.object({
  newStartUtc: z.string(),
  newEndUtc: z.string(),
});

async function postHandler(
  req: NextRequest,
  _context: { userId: Types.ObjectId; userRole: string },
  params: { sessionId: string },
) {
  await connectToDatabase();
  const raw = await parseRequestBody(req);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return apiResponse.error('ValidationError', parsed.error.message, 400);
  }

  const newStart = new Date(parsed.data.newStartUtc);
  const newEnd = new Date(parsed.data.newEndUtc);
  if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime())) {
    return apiResponse.error('ValidationError', 'Invalid date strings', 400);
  }

  const svc = new RescheduleService();
  await svc.adminRescheduleSessionDirect({
    sessionId: params.sessionId,
    newStartUtc: newStart,
    newEndUtc: newEnd,
  });

  return apiResponse.success({ updated: true });
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
