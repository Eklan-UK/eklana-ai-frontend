// GET /api/v1/daily-focus/[id]/progress - Get cached progress
// POST /api/v1/daily-focus/[id]/progress - Save progress
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import DailyFocusProgress from '@/models/daily-focus-progress';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';
import { apiResponse } from '@/lib/api/response';

const saveProgressSchema = z.object({
  currentQuestionIndex: z.number().min(0),
  answers: z.array(z.object({
    questionType: z.string(),
    questionIndex: z.number(),
    userAnswer: z.any(),
    isCorrect: z.boolean().optional(),
    isSubmitted: z.boolean(),
  })),
  isCompleted: z.boolean().optional(),
  finalScore: z.number().min(0).max(100).optional(),
});

// Helper to get today's date string (UTC)
function getTodayString(): string {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today.toISOString().split('T')[0];
}

// GET handler - Get cached progress
async function getHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { id: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const { id } = params;
    if (!Types.ObjectId.isValid(id)) {
      return apiResponse.validationError('Invalid daily focus ID');
    }

    const todayString = getTodayString();

    const progress = await DailyFocusProgress.findOne({
      userId: context.userId,
      dailyFocusId: new Types.ObjectId(id),
      dateString: todayString,
    }).lean().exec();

    if (!progress) {
      return apiResponse.success({ progress: null });
    }

    return apiResponse.success({ progress });
  } catch (error: any) {
    logger.error('Error fetching daily focus progress', error);
    return apiResponse.serverError(error);
  }
}

// POST handler - Save progress
async function postHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { id: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const { id } = params;
    if (!Types.ObjectId.isValid(id)) {
      return apiResponse.validationError('Invalid daily focus ID');
    }

    const body = await req.json();
    const validated = saveProgressSchema.parse(body);

    const todayString = getTodayString();

    // Upsert progress
    const progress = await DailyFocusProgress.findOneAndUpdate(
      {
        userId: context.userId,
        dailyFocusId: new Types.ObjectId(id),
        dateString: todayString,
      },
      {
        $set: {
          userId: context.userId,
          dailyFocusId: new Types.ObjectId(id),
          dateString: todayString,
          currentQuestionIndex: validated.currentQuestionIndex,
          answers: validated.answers,
          lastUpdatedAt: new Date(),
          isCompleted: validated.isCompleted || false,
          finalScore: validated.finalScore,
        },
        $setOnInsert: {
          startedAt: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
      }
    ).exec();

    return apiResponse.success({ progress });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError('Validation failed', error.issues);
    }
    logger.error('Error saving daily focus progress', error);
    return apiResponse.serverError(error);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return withAuth((req, context) =>
    getHandler(req, context, resolvedParams)
  )(req);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return withAuth((req, context) =>
    postHandler(req, context, resolvedParams)
  )(req);
}

