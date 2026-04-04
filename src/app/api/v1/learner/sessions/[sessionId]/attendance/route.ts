// POST /api/v1/learner/sessions/[sessionId]/attendance — record join / attendance (Phase 4)
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { AttendanceRepository } from '@/domain/classes/attendance.repository';
import '@/models/class-session';
import '@/models/session-attendance';

async function postHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { sessionId: string },
) {
  await connectToDatabase();
  const { sessionId } = params;
  let body: { status?: 'present' | 'late' } = {};
  try {
    const raw = await req.json();
    if (raw && typeof raw === 'object') body = raw;
  } catch {
    /* empty body */
  }

  const status = body.status === 'late' ? 'late' : 'present';
  const repo = new AttendanceRepository();
  await repo.recordLearnerAttendance({
    sessionId,
    learnerId: context.userId,
    status,
    source: 'manual',
  });

  return apiResponse.success({ recorded: true, status });
}

export async function POST(
  req: NextRequest,
  segment: { params: Promise<{ sessionId: string }> },
) {
  const params = await segment.params;
  return withRole(
    ['user'],
    withErrorHandler((r, c) => postHandler(r, c, params)),
  )(req);
}
