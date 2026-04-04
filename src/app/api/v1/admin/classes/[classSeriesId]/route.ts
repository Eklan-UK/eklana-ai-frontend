// GET /api/v1/admin/classes/[classSeriesId]
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse, NotFoundError, ValidationError } from '@/lib/api/response';
import { ClassRepository } from '@/domain/classes/class.repository';
import { mapToAdminDetail } from '@/domain/classes/class.mapper';
import '@/models/class-series';
import '@/models/class-enrollment';
import '@/models/class-session';

async function getHandler(
  _req: NextRequest,
  _context: { userId: Types.ObjectId; userRole: string },
  params: { classSeriesId: string },
) {
  await connectToDatabase();
  const { classSeriesId } = params;
  if (!Types.ObjectId.isValid(classSeriesId)) {
    throw new ValidationError('Invalid class ID');
  }

  const repo = new ClassRepository();
  const full = await repo.findById(classSeriesId);
  if (!full) {
    throw new NotFoundError('Class');
  }

  const detail = mapToAdminDetail(
    full.series,
    full.sessions,
    full.learners,
    full.tutor,
  );

  return apiResponse.success(detail);
}

async function deleteHandler(
  _req: NextRequest,
  _context: { userId: Types.ObjectId; userRole: string },
  params: { classSeriesId: string },
) {
  await connectToDatabase();
  const { classSeriesId } = params;
  if (!Types.ObjectId.isValid(classSeriesId)) {
    throw new ValidationError('Invalid class ID');
  }

  const repo = new ClassRepository();
  const removed = await repo.softDeleteSeries(classSeriesId);
  if (!removed) {
    throw new NotFoundError('Class');
  }

  return apiResponse.success({ deleted: true });
}

export async function GET(
  req: NextRequest,
  segment: { params: Promise<{ classSeriesId: string }> },
) {
  const params = await segment.params;
  return withRole(
    ['admin'],
    withErrorHandler((r, c) => getHandler(r, c, params)),
  )(req);
}

export async function DELETE(
  req: NextRequest,
  segment: { params: Promise<{ classSeriesId: string }> },
) {
  const params = await segment.params;
  return withRole(
    ['admin'],
    withErrorHandler((r, c) => deleteHandler(r, c, params)),
  )(req);
}
