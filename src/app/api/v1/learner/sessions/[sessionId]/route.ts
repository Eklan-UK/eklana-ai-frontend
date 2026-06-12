// GET /api/v1/learner/sessions/[sessionId] — one session if learner is enrolled (join URL per policy)
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse, NotFoundError, ValidationError } from '@/lib/api/response';
import { ClassRepository } from '@/domain/classes/class.repository';
import {
  resolveSessionMeetingUrl,
  tutorMeetingUrlAllowed,
} from '@/domain/classes/class.mapper';
import '@/models/class-series';
import '@/models/class-enrollment';
import '@/models/class-session';

async function getHandler(
  _req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { sessionId: string },
) {
  await connectToDatabase();
  const { sessionId } = params;
  if (!Types.ObjectId.isValid(sessionId)) {
    throw new ValidationError('Invalid session ID');
  }

  const repo = new ClassRepository();
  const row = await repo.findSessionForLearner(sessionId, context.userId);
  if (!row) {
    throw new NotFoundError('Session');
  }

  const { session, series, seriesTitle, tutorName, tutorId } = row;
  const resolvedMeetingUrl = resolveSessionMeetingUrl(series, session);
  const allowUrl = tutorMeetingUrlAllowed(session, new Date(), resolvedMeetingUrl);
  const meetingUrl = allowUrl && resolvedMeetingUrl ? resolvedMeetingUrl : undefined;

  return apiResponse.success({
    session: {
      id: session._id.toString(),
      classSeriesId: session.classSeriesId.toString(),
      startUtc: new Date(session.startUtc).toISOString(),
      endUtc: new Date(session.endUtc).toISOString(),
      status: session.status,
      isReschedule: Boolean((session as { isReschedule?: boolean }).isReschedule),
      meetingUrl,
    },
    classTitle: seriesTitle,
    tutorName,
    tutorId: tutorId.toString(),
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
