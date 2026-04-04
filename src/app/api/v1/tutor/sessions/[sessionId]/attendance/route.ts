// GET /api/v1/tutor/sessions/[sessionId]/attendance — roster + attendance for tutor (Phase 4)
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse, NotFoundError } from '@/lib/api/response';
import { AttendanceRepository } from '@/domain/classes/attendance.repository';
import '@/models/class-session';
import '@/models/session-attendance';

async function getHandler(
  _req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { sessionId: string },
) {
  await connectToDatabase();
  const { sessionId } = params;

  const repo = new AttendanceRepository();
  const result = await repo.listForTutorSession(sessionId, context.userId);
  if (!result) {
    throw new NotFoundError('Session');
  }

  return apiResponse.success({
    sessionId,
    attendance: result.rows,
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
