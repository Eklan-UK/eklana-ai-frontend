// GET /api/v1/admin/sessions/[sessionId] — session summary for admin (reschedule UI)
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse, NotFoundError, ValidationError } from '@/lib/api/response';
import ClassSession from '@/models/class-session';
import ClassSeries from '@/models/class-series';
import User from '@/models/user';

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
  _context: { userId: Types.ObjectId; userRole: string },
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
  const series = await ClassSeries.findById(session.classSeriesId).lean();
  if (!series) {
    throw new NotFoundError('Class');
  }
  const tutor = await User.findById(series.tutorId).select('firstName lastName email').lean();
  if (!tutor) {
    throw new NotFoundError('Tutor');
  }

  return apiResponse.success({
    session: {
      id: session._id.toString(),
      classSeriesId: session.classSeriesId.toString(),
      startUtc: new Date(session.startUtc).toISOString(),
      endUtc: new Date(session.endUtc).toISOString(),
      status: session.status,
      isReschedule: Boolean((session as { isReschedule?: boolean }).isReschedule),
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
    ['admin'],
    withErrorHandler((r, c) => getHandler(r, c, params)),
  )(req);
}
