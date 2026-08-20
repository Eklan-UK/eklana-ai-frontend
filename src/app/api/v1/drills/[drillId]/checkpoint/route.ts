import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import DrillCheckpoint from '@/models/drill-checkpoint';
import { AssignmentRepository } from '@/domain/assignments/assignment.repository';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';
import { apiResponse } from '@/lib/api/response';
import { toUserIdQuery } from '@/lib/api/user-id';

const saveCheckpointSchema = z.object({
  assignmentId: z.string().refine((v) => Types.ObjectId.isValid(v), {
    message: 'Valid assignmentId is required',
  }),
  drillType: z.enum([
    'vocabulary',
    'pronunciation',
    'matching',
    'definition',
    'grammar',
    'sentence',
    'sentence_writing',
    'fill_blank',
    'key_phrases',
    'listening',
    'summary',
  ]),
  resumeFromIndex: z.number().int().min(0),
  completedItemCount: z.number().int().min(0),
  partialResults: z.record(z.string(), z.unknown()).default({}),
  startedAt: z.union([z.string(), z.date()]).optional(),
});

type AuthContext = { userId: string; userRole: string };

async function getHandler(
  req: NextRequest,
  context: AuthContext,
  drillId: string,
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    if (!Types.ObjectId.isValid(drillId)) {
      return apiResponse.validationError('Invalid drill ID');
    }

    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get('assignmentId');

    if (!assignmentId || !Types.ObjectId.isValid(assignmentId)) {
      return apiResponse.validationError('Valid assignmentId query param is required');
    }

    const checkpoint = await DrillCheckpoint.findOne({
      // DrillCheckpoint.userId is Schema.Types.Mixed (see model comment), so
      // Mongoose will NOT auto-cast a raw hex string into a real ObjectId
      // here — toUserIdQuery ensures legacy (ObjectId-keyed) learners still
      // match their pre-existing checkpoint rows.
      userId: toUserIdQuery(context.userId),
      drillId: new Types.ObjectId(drillId),
      drillAssignmentId: new Types.ObjectId(assignmentId),
    })
      .lean()
      .exec();

    return apiResponse.success({ checkpoint: checkpoint ?? null });
  } catch (error: unknown) {
    logger.error('Error fetching drill checkpoint', error);
    return apiResponse.serverError(error);
  }
}

async function postHandler(
  req: NextRequest,
  context: AuthContext,
  drillId: string,
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    if (!Types.ObjectId.isValid(drillId)) {
      return apiResponse.validationError('Invalid drill ID');
    }

    const body = await req.json();
    const validated = saveCheckpointSchema.parse(body);

    const filter = {
      // See getHandler comment — DrillCheckpoint.userId is Mixed, so it must
      // be explicitly cast via toUserIdQuery for legacy ObjectId learners.
      userId: toUserIdQuery(context.userId),
      drillId: new Types.ObjectId(drillId),
      drillAssignmentId: new Types.ObjectId(validated.assignmentId),
    };

    const startedAt = validated.startedAt ? new Date(validated.startedAt) : new Date();

    const checkpoint = await DrillCheckpoint.findOneAndUpdate(
      filter,
      {
        $set: {
          ...filter,
          drillType: validated.drillType,
          resumeFromIndex: validated.resumeFromIndex,
          completedItemCount: validated.completedItemCount,
          partialResults: validated.partialResults,
          lastUpdatedAt: new Date(),
        },
        $setOnInsert: { startedAt },
      },
      { upsert: true, new: true },
    )
      .lean()
      .exec();

    const assignmentRepo = new AssignmentRepository();
    await assignmentRepo.updateStatus(validated.assignmentId, 'in-progress');

    return apiResponse.success({ checkpoint });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError('Validation failed', error.issues);
    }
    logger.error('Error saving drill checkpoint', error);
    return apiResponse.serverError(error);
  }
}

async function deleteHandler(
  req: NextRequest,
  context: AuthContext,
  drillId: string,
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    if (!Types.ObjectId.isValid(drillId)) {
      return apiResponse.validationError('Invalid drill ID');
    }

    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get('assignmentId');

    if (!assignmentId || !Types.ObjectId.isValid(assignmentId)) {
      return apiResponse.validationError('Valid assignmentId query param is required');
    }

    await DrillCheckpoint.deleteOne({
      userId: toUserIdQuery(context.userId),
      drillId: new Types.ObjectId(drillId),
      drillAssignmentId: new Types.ObjectId(assignmentId),
    }).exec();

    return apiResponse.success({ deleted: true });
  } catch (error: unknown) {
    logger.error('Error deleting drill checkpoint', error);
    return apiResponse.serverError(error);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ drillId: string }> },
) {
  const { drillId } = await params;
  return withAuth((req, context) => getHandler(req, context, drillId))(req);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ drillId: string }> },
) {
  const { drillId } = await params;
  return withAuth((req, context) => postHandler(req, context, drillId))(req);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ drillId: string }> },
) {
  const { drillId } = await params;
  return withAuth((req, context) => deleteHandler(req, context, drillId))(req);
}
