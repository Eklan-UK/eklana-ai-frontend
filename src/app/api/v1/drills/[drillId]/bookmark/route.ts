// POST /api/v1/drills/[drillId]/bookmark - Bookmark drill (shared admin library)
// DELETE /api/v1/drills/[drillId]/bookmark - Unbookmark drill
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse, ValidationError } from '@/lib/api/response';
import { DrillService } from '@/domain/drills/drill.service';
import { DrillRepository } from '@/domain/drills/drill.repository';
import { AssignmentRepository } from '@/domain/assignments/assignment.repository';
import { AttemptRepository } from '@/domain/attempts/attempt.repository';

async function setBookmark(
  req: NextRequest,
  context: { userId: string; userRole: string },
  params: { drillId: string },
  bookmarked: boolean
) {
  await connectToDatabase();

  const { drillId } = params;
  if (!Types.ObjectId.isValid(drillId)) {
    throw new ValidationError('Invalid drill ID format');
  }

  const drillRepo = new DrillRepository();
  const assignmentRepo = new AssignmentRepository();
  const attemptRepo = new AttemptRepository();
  const drillService = new DrillService(drillRepo, assignmentRepo, attemptRepo);

  const drill = await drillService.setDrillBookmarked(drillId, bookmarked, {
    userId: context.userId,
    userRole: context.userRole,
  });

  return apiResponse.success({ drill });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ drillId: string }> }
) {
  const resolvedParams = await params;
  return withRole(
    ['admin', 'tutor'],
    withErrorHandler((req, context) => setBookmark(req, context, resolvedParams, true))
  )(req);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ drillId: string }> }
) {
  const resolvedParams = await params;
  return withRole(
    ['admin', 'tutor'],
    withErrorHandler((req, context) => setBookmark(req, context, resolvedParams, false))
  )(req);
}
