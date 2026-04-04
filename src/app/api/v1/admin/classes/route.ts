// GET, POST /api/v1/admin/classes
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { parseRequestBody } from '@/lib/api/request-parser';
import { apiResponse } from '@/lib/api/response';
import { ClassRepository } from '@/domain/classes/class.repository';
import { mapSeriesToListItem } from '@/domain/classes/class.mapper';
import type { ClassBucket } from '@/domain/classes/class.api.types';
import '@/models/class-series';
import '@/models/class-enrollment';
import '@/models/class-session';

const createSchema = z.object({
  tutorId: z.string(),
  learnerIds: z.array(z.string()).min(1),
  title: z.string().max(200).optional(),
  classType: z.enum(['group', 'individual']),
  timezone: z.string().min(1),
  firstSessionStart: z.string(),
  firstSessionEnd: z.string(),
  recurrence: z
    .object({
      rule: z.enum(['weekly', 'none']),
      daysOfWeek: z.array(z.number()).optional(),
      totalSessions: z.number().int().min(1).optional(),
    })
    .optional(),
  scheduleDayLabels: z.array(z.string()).optional(),
  scheduleStartTime: z.string().optional(),
  scheduleEndTime: z.string().optional(),
  totalSessionsPlanned: z.number().int().min(1).optional(),
});

async function getHandler(req: NextRequest) {
  await connectToDatabase();
  const { searchParams } = new URL(req.url);
  const bucketRaw = searchParams.get('bucket');
  const bucket =
    bucketRaw === 'today' || bucketRaw === 'upcoming'
      ? (bucketRaw as ClassBucket)
      : undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);
  const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;

  const repo = new ClassRepository();
  const { items, total } = await repo.findAdminList({
    bucket,
    limit,
    offset,
  });

  return apiResponse.success({
    classes: items,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    },
  });
}

async function postHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
) {
  await connectToDatabase();
  const raw = await parseRequestBody(req);
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return apiResponse.error('ValidationError', parsed.error.message, 400);
  }

  const repo = new ClassRepository();
  const { series } = await repo.create(parsed.data, context.userId);
  const full = await repo.findById(series._id.toString());
  if (!full) {
    return apiResponse.error('ServerError', 'Class created but could not be loaded', 500);
  }

  const listItem = mapSeriesToListItem(
    full.series,
    full.sessions,
    full.learners,
    full.tutor,
  );

  return apiResponse.success(
    {
      classSeriesId: series._id.toString(),
      sessionIds: full.sessions.map((s) => s._id.toString()),
      class: listItem,
    },
    201,
  );
}

export const GET = withRole(['admin'], withErrorHandler(getHandler));
export const POST = withRole(['admin'], withErrorHandler(postHandler));
