// GET /api/v1/learner/sessions/join?t=<signed-token>
// Records attendance (join_token) then redirects to Google Meet — used from reminder emails.
import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/api/db';
import { verifyClassJoinToken } from '@/lib/api/class-join-token';
import { AttendanceRepository } from '@/domain/classes/attendance.repository';
import ClassSession from '@/models/class-session';
import { ValidationError } from '@/lib/api/response';
import { TUTOR_JOIN_EARLY_MINUTES } from '@/domain/classes/class.mapper';
import '@/models/class-series';
import '@/models/class-enrollment';
import '@/models/session-attendance';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t');
  if (!token) {
    return NextResponse.json(
      { code: 'ValidationError', message: 'Missing join token' },
      { status: 400 },
    );
  }

  const payload = verifyClassJoinToken(token);
  if (!payload) {
    return NextResponse.json(
      { code: 'Unauthorized', message: 'Invalid or expired join link' },
      { status: 401 },
    );
  }

  if (!Types.ObjectId.isValid(payload.sessionId) || !Types.ObjectId.isValid(payload.learnerId)) {
    return NextResponse.json(
      { code: 'ValidationError', message: 'Invalid join link' },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const session = await ClassSession.findById(payload.sessionId).lean();
  if (!session || session.status === 'cancelled') {
    return NextResponse.json(
      { code: 'NotFound', message: 'Session not found' },
      { status: 404 },
    );
  }

  const meetingUrl = session.meetingUrl?.trim();
  if (!meetingUrl) {
    return NextResponse.json(
      { code: 'NotFound', message: 'Meeting link is not available' },
      { status: 404 },
    );
  }

  const now = Date.now();
  const startMs = new Date(session.startUtc).getTime();
  const endMs = new Date(session.endUtc).getTime();
  const earlyMs = TUTOR_JOIN_EARLY_MINUTES * 60 * 1000;

  if (now < startMs - earlyMs) {
    return NextResponse.json(
      {
        code: 'TooEarly',
        message: `Join link activates ${TUTOR_JOIN_EARLY_MINUTES} minutes before class start`,
      },
      { status: 403 },
    );
  }

  if (now > endMs) {
    return NextResponse.json(
      { code: 'Expired', message: 'This class has already ended' },
      { status: 410 },
    );
  }

  const repo = new AttendanceRepository();
  try {
    await repo.recordLearnerAttendance({
      sessionId: payload.sessionId,
      learnerId: new Types.ObjectId(payload.learnerId),
      status: 'present',
      source: 'join_token',
    });
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      return NextResponse.json(
        { code: 'Forbidden', message: err.message },
        { status: 403 },
      );
    }
    throw err;
  }

  return NextResponse.redirect(meetingUrl, 302);
}
