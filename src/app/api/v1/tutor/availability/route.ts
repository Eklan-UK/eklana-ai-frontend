// GET/PATCH /api/v1/tutor/availability — tutor weekly availability (timezone + rules + exceptions)
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { parseRequestBody } from '@/lib/api/request-parser';
import { TutorAvailabilityRepository } from '@/domain/tutor-availability/tutor-availability.repository';
import '@/models/tutor-availability';

const patchSchema = z.object({
  timezone: z.string().min(1).max(80),
  weeklyRules: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      startMin: z.number().int().min(0).max(1439),
      endMin: z.number().int().min(1).max(1440),
    }),
  ),
  exceptions: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      kind: z.enum(['block', 'open']),
    }),
  ),
  bufferMinutes: z.number().int().min(0).max(240),
});

function validateTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

async function getHandler(
  _req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
) {
  await connectToDatabase();
  const repo = new TutorAvailabilityRepository();
  const doc = await repo.findByTutorId(context.userId);
  const dto = repo.toDTO(doc);
  if (!dto) {
    return apiResponse.success({
      timezone: 'UTC',
      weeklyRules: [] as { weekday: number; startMin: number; endMin: number }[],
      exceptions: [] as { date: string; kind: 'block' | 'open' }[],
      bufferMinutes: 0,
    });
  }
  return apiResponse.success(dto);
}

async function patchHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
) {
  await connectToDatabase();
  const raw = await parseRequestBody(req);
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return apiResponse.error('ValidationError', parsed.error.message, 400);
  }
  const body = parsed.data;
  if (!validateTimezone(body.timezone)) {
    return apiResponse.error('ValidationError', 'Invalid IANA timezone', 400);
  }
  for (const r of body.weeklyRules) {
    if (r.startMin >= r.endMin) {
      return apiResponse.error(
        'ValidationError',
        'Each rule must have startMin < endMin',
        400,
      );
    }
  }

  const repo = new TutorAvailabilityRepository();
  await repo.upsertForTutor(context.userId, body);
  const doc = await repo.findByTutorId(context.userId);
  const dto = repo.toDTO(doc);
  return apiResponse.success(dto!);
}

export const GET = withRole(['tutor'], withErrorHandler(getHandler));
export const PATCH = withRole(['tutor'], withErrorHandler(patchHandler));
