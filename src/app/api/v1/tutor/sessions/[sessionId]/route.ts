// GET /api/v1/tutor/sessions/[sessionId] — session summary for assigned tutor (reschedule UI)
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import {
  apiResponse,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/api/response';
import ClassSession, { type IClassSession } from '@/models/class-session';
import ClassSeries, { type IClassSeries } from '@/models/class-series';
import User from '@/models/user';
import {
  resolveSessionMeetingUrl,
  tutorMeetingUrlAllowed,
} from '@/domain/classes/class.mapper';

function formatTutorName(t: {
  firstName?: string;
  lastName?: string;
  email?: string;
}): string {
  const n = `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim();
  return n || t.email || 'Tutor';
}

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

  const session = await ClassSession.findById(sessionId).lean();
  if (!session) {
    throw new NotFoundError('Session');
  }
  if (session.tutorId.toString() !== context.userId.toString()) {
    throw new ForbiddenError('You are not the assigned tutor for this session');
  }
  const series = await ClassSeries.findById(session.classSeriesId).lean();
  if (!series) {
    throw new NotFoundError('Class');
  }
  const tutor = await User.findById(series.tutorId).select('firstName lastName email').lean();
  if (!tutor) {
    throw new NotFoundError('Tutor');
  }

  const sessionRow = session as unknown as IClassSession;
  const seriesRow = series as unknown as IClassSeries;
  const resolvedMeetingUrl = resolveSessionMeetingUrl(seriesRow, sessionRow);
  const allowUrl = tutorMeetingUrlAllowed(sessionRow, new Date(), resolvedMeetingUrl);
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
    classTitle: series.title?.trim() || 'Class',
    tutorName: formatTutorName(tutor as { firstName?: string; lastName?: string; email?: string }),
  });
}

export async function GET(
  req: NextRequest,
  segment: { params: Promise<{ sessionId: string }> },
) {
  const params = await segment.params;
  return withRole(
    ['tutor'],
    withErrorHandler((r, c) => getHandler(r, c, params)),
  )(req);
}
