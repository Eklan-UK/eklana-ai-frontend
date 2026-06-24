import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import RoleplayDrillProgress from '@/models/roleplay-drill-progress';
import { AssignmentRepository } from '@/domain/assignments/assignment.repository';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';
import { apiResponse } from '@/lib/api/response';
import { ensureRoleplayProgressIndexes } from '@/lib/drill/ensure-roleplay-progress-indexes';

const turnProgressSchema = z.record(
  z.string(),
  z.object({
    passed: z.boolean(),
    score: z.number().nullable(),
    attempts: z.number().min(0),
  }),
);

const saveProgressSchema = z
  .object({
    source: z.enum(['assignment', 'weekly_challenge']),
    assignmentId: z.string().optional(),
    challengeId: z.string().optional(),
    challengeItemIndex: z.number().int().min(0).optional(),
    weekStartDate: z.string().optional(),
    currentSceneIndex: z.number().int().min(0),
    currentTurnIndex: z.number().int().min(0),
    pausedAtSceneBreak: z.boolean(),
    completedSceneIndex: z.number().int().min(0).optional(),
    turnProgress: turnProgressSchema,
    sessionAnalytics: z.array(
      z.object({
        sceneIndex: z.number().int().min(0),
        turnIndex: z.number().int().min(0),
        text: z.string(),
        score: z.number(),
        textScore: z.any().optional().nullable(),
        attempts: z.number().min(0),
        timestamp: z.union([z.string(), z.date()]),
      }),
    ),
    roleMode: z.enum(['original', 'swapped']),
    originalRoleProgress: turnProgressSchema.optional(),
    swappedRoleProgress: turnProgressSchema.optional(),
    startedAt: z.union([z.string(), z.date()]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.source === 'assignment') {
      if (!data.assignmentId || !Types.ObjectId.isValid(data.assignmentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Valid assignmentId is required for assignment source',
          path: ['assignmentId'],
        });
      }
    }
    if (data.source === 'weekly_challenge') {
      if (!data.challengeId || !Types.ObjectId.isValid(data.challengeId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Valid challengeId is required for weekly_challenge source',
          path: ['challengeId'],
        });
      }
      if (data.challengeItemIndex == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'challengeItemIndex is required for weekly_challenge source',
          path: ['challengeItemIndex'],
        });
      }
    }
  });

type AuthContext = { userId: Types.ObjectId; userRole: string };

function buildProgressFilter(
  userId: Types.ObjectId,
  params: {
    source?: string | null;
    assignmentId?: string | null;
    challengeId?: string | null;
    challengeItemIndex?: string | null;
  },
): Record<string, unknown> | null {
  const base = { userId };

  if (params.source === 'assignment' && params.assignmentId && Types.ObjectId.isValid(params.assignmentId)) {
    return {
      ...base,
      source: 'assignment',
      drillAssignmentId: new Types.ObjectId(params.assignmentId),
    };
  }

  if (
    params.source === 'weekly_challenge' &&
    params.challengeId &&
    Types.ObjectId.isValid(params.challengeId) &&
    params.challengeItemIndex != null &&
    params.challengeItemIndex !== ''
  ) {
    const idx = Number(params.challengeItemIndex);
    if (!Number.isInteger(idx) || idx < 0) return null;
    return {
      ...base,
      source: 'weekly_challenge',
      challengeId: new Types.ObjectId(params.challengeId),
      challengeItemIndex: idx,
    };
  }

  return null;
}

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
    const filter = buildProgressFilter(context.userId, {
      source: searchParams.get('source'),
      assignmentId: searchParams.get('assignmentId'),
      challengeId: searchParams.get('challengeId'),
      challengeItemIndex: searchParams.get('challengeItemIndex'),
    });

    if (!filter) {
      return apiResponse.validationError(
        'Provide source=assignment&assignmentId=… or source=weekly_challenge&challengeId=…&challengeItemIndex=…',
      );
    }

    const progress = await RoleplayDrillProgress.findOne(filter).lean().exec();

    return apiResponse.success({ progress: progress ?? null });
  } catch (error: unknown) {
    logger.error('Error fetching roleplay drill progress', error);
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
    const validated = saveProgressSchema.parse(body);

    const filter: Record<string, unknown> = {
      userId: context.userId,
      source: validated.source,
      drillId: new Types.ObjectId(drillId),
    };

    const update: Record<string, unknown> = {
      userId: context.userId,
      source: validated.source,
      drillId: new Types.ObjectId(drillId),
      currentSceneIndex: validated.currentSceneIndex,
      currentTurnIndex: validated.currentTurnIndex,
      pausedAtSceneBreak: validated.pausedAtSceneBreak,
      completedSceneIndex: validated.completedSceneIndex ?? null,
      turnProgress: validated.turnProgress,
      sessionAnalytics: validated.sessionAnalytics.map((a) => ({
        ...a,
        timestamp: new Date(a.timestamp),
      })),
      roleMode: validated.roleMode,
      originalRoleProgress: validated.originalRoleProgress ?? {},
      swappedRoleProgress: validated.swappedRoleProgress ?? {},
      lastUpdatedAt: new Date(),
    };

    if (validated.source === 'assignment' && validated.assignmentId) {
      filter.drillAssignmentId = new Types.ObjectId(validated.assignmentId);
      update.drillAssignmentId = new Types.ObjectId(validated.assignmentId);

      const assignmentRepo = new AssignmentRepository();
      await assignmentRepo.updateStatus(validated.assignmentId, 'in-progress');
    }

    const unsetFields: Record<string, 1> = {};

    if (validated.source === 'weekly_challenge') {
      filter.challengeId = new Types.ObjectId(validated.challengeId!);
      filter.challengeItemIndex = validated.challengeItemIndex;
      update.challengeId = new Types.ObjectId(validated.challengeId!);
      update.challengeItemIndex = validated.challengeItemIndex;
      update.weekStartDate = validated.weekStartDate ?? null;
      unsetFields.drillAssignmentId = 1;
    } else {
      // Assignment docs must not carry challenge fields — null values collide on the
      // weekly_challenge unique index (userId + null + null).
      unsetFields.challengeId = 1;
      unsetFields.challengeItemIndex = 1;
      unsetFields.weekStartDate = 1;
    }

    const startedAt = validated.startedAt ? new Date(validated.startedAt) : new Date();

    await ensureRoleplayProgressIndexes();

    const collection = RoleplayDrillProgress.collection;
    const unsetPayload = Object.fromEntries(
      Object.keys(unsetFields).map((key) => [key, '']),
    );

    if (validated.source === 'assignment') {
      await collection.updateMany(
        {
          userId: context.userId,
          source: { $ne: 'weekly_challenge' },
        },
        { $unset: { challengeId: '', challengeItemIndex: '', weekStartDate: '' } },
      );
    }

    const upsertDoc = async () =>
      collection.findOneAndUpdate(
        filter,
        {
          $set: update,
          ...(Object.keys(unsetPayload).length > 0 ? { $unset: unsetPayload } : {}),
          $setOnInsert: { startedAt },
        },
        { upsert: true, returnDocument: 'after' },
      );

    let progress;
    try {
      progress = await upsertDoc();
    } catch (upsertError: unknown) {
      const isDupKey =
        upsertError &&
        typeof upsertError === 'object' &&
        'code' in upsertError &&
        (upsertError as { code?: number }).code === 11000;

      if (!isDupKey || validated.source !== 'assignment') throw upsertError;

      await ensureRoleplayProgressIndexes();
      await collection.updateMany(
        { userId: context.userId },
        { $unset: { challengeId: '', challengeItemIndex: '', weekStartDate: '' } },
      );

      progress = await upsertDoc();
    }

    return apiResponse.success({ progress });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError('Validation failed', error.issues);
    }
    logger.error('Error saving roleplay drill progress', error);
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
    const filter = buildProgressFilter(context.userId, {
      source: searchParams.get('source'),
      assignmentId: searchParams.get('assignmentId'),
      challengeId: searchParams.get('challengeId'),
      challengeItemIndex: searchParams.get('challengeItemIndex'),
    });

    if (!filter) {
      return apiResponse.validationError(
        'Provide source=assignment&assignmentId=… or source=weekly_challenge&challengeId=…&challengeItemIndex=…',
      );
    }

    await RoleplayDrillProgress.deleteOne(filter).exec();

    return apiResponse.success({ deleted: true });
  } catch (error: unknown) {
    logger.error('Error deleting roleplay drill progress', error);
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
