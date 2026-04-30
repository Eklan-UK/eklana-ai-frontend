// POST /api/v1/learner/sessions/[sessionId]/reserve-slot — learners may not self-reschedule
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { apiResponse } from '@/lib/api/response';

const FORBIDDEN_MSG =
  'Only an administrator or the assigned tutor can change the session time.';

async function postHandler(
  _req: NextRequest,
  _context: { userId: Types.ObjectId; userRole: string },
  _params: { sessionId: string },
) {
  return apiResponse.error('Forbidden', FORBIDDEN_MSG, 403);
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
