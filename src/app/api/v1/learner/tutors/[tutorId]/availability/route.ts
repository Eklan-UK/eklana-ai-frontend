// GET /api/v1/learner/tutors/:tutorId/availability — read-only; enrolled learners only
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse, NotFoundError, ValidationError } from '@/lib/api/response';
import { TutorAvailabilityRepository } from '@/domain/tutor-availability/tutor-availability.repository';
import '@/models/tutor-availability';

async function getHandler(
  _req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { tutorId: string },
) {
  await connectToDatabase();
  const { tutorId } = params;
  if (!Types.ObjectId.isValid(tutorId)) {
    throw new ValidationError('Invalid tutor ID');
  }
  const tid = new Types.ObjectId(tutorId);

  const repo = new TutorAvailabilityRepository();
  const allowed = await repo.learnerMayViewTutorAvailability(context.userId, tid);
  if (!allowed) {
    throw new NotFoundError('Availability');
  }

  const doc = await repo.findByTutorId(tid);
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

export async function GET(
  req: NextRequest,
  segment: { params: Promise<{ tutorId: string }> },
) {
  const params = await segment.params;
  return withRole(
    ['user'],
    withErrorHandler((r, c) => getHandler(r, c, params)),
  )(req);
}
