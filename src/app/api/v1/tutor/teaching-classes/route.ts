// GET /api/v1/tutor/teaching-classes — tutor-scoped class list (scheduling is admin-only)
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { ClassRepository } from '@/domain/classes/class.repository';
import type { ClassBucket } from '@/domain/classes/class.api.types';
import '@/models/class-series';
import '@/models/class-enrollment';
import '@/models/class-session';

async function getHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
) {
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
  const { items, total } = await repo.findTutorList({
    tutorId: context.userId,
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

export const GET = withRole(['tutor'], withErrorHandler(getHandler));
