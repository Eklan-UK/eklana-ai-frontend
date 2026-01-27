// POST /api/v1/daily-focus/[id]/complete - Submit completion
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { StreakService } from '@/services/streak.service';
import DailyFocus from '@/models/daily-focus';
import DailyFocusProgress from '@/models/daily-focus-progress';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';
import { apiResponse } from '@/lib/api/response';

const completeDailyFocusSchema = z.object({
  score: z.number().min(0).max(100),
  correctAnswers: z.number().min(0),
  totalQuestions: z.number().min(1),
  timeSpent: z.number().min(0).optional(),
  answers: z.array(z.any()).optional(),
});

// Helper to get today's date string (UTC)
function getTodayString(): string {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today.toISOString().split('T')[0];
}

// Helper to calculate new average score for daily focus
async function calculateNewAverage(dailyFocusId: string): Promise<number> {
  const DailyFocusCompletion = (await import('@/models/daily-focus-completion')).default;
  const result = await DailyFocusCompletion.aggregate([
    { $match: { dailyFocusId: new Types.ObjectId(dailyFocusId), isFirstCompletion: true } },
    { $group: { _id: null, avgScore: { $avg: '$score' } } },
  ]).exec();

  return result.length > 0 ? Math.round(result[0].avgScore) : 0;
}

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
    const validated = completeDailyFocusSchema.parse(body);

    // Verify daily focus exists
    const dailyFocus = await DailyFocus.findById(id).lean().exec();
    if (!dailyFocus) {
      return apiResponse.notFound('Daily focus');
    }

    // Validate score >= 70%
    if (validated.score < 70) {
      return apiResponse.error(
        'ValidationError',
        'Score must be at least 70% to complete daily focus',
        400
      );
    }

    // Validate all questions answered
    if (validated.correctAnswers + (validated.totalQuestions - validated.correctAnswers) !== validated.totalQuestions) {
      return apiResponse.error(
        'ValidationError',
        'All questions must be answered',
        400
      );
    }

    // Record completion (only if first completion today)
    const { streakUpdated, badgeUnlocked } = await StreakService.recordCompletion(
      context.userId.toString(),
      id,
      validated.score,
      validated.correctAnswers,
      validated.totalQuestions,
      validated.timeSpent || 0,
      validated.answers
    );

    // Update daily focus analytics
    const newAverage = await calculateNewAverage(id);
    await DailyFocus.findByIdAndUpdate(id, {
      $inc: { totalCompletions: streakUpdated ? 1 : 0 },
      $set: {
        averageScore: newAverage,
      },
    }).exec();

    // Mark progress as completed
    const todayString = getTodayString();
    await DailyFocusProgress.findOneAndUpdate(
      {
        userId: context.userId,
        dailyFocusId: new Types.ObjectId(id),
        dateString: todayString,
      },
      {
        $set: {
          isCompleted: true,
          finalScore: validated.score,
        },
      }
    ).exec();

    logger.info('Daily focus completed', {
      userId: context.userId,
      dailyFocusId: id,
      score: validated.score,
      streakUpdated,
      badgeUnlocked: badgeUnlocked?.badgeId || null,
    });

    return apiResponse.success({
      message: 'Daily focus completed successfully',
      score: validated.score,
      streakUpdated,
      badgeUnlocked: badgeUnlocked ? {
        badgeId: badgeUnlocked.badgeId,
        badgeName: badgeUnlocked.badgeName,
        milestone: badgeUnlocked.milestone,
      } : null,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError('Validation failed', error.issues);
    }
    logger.error('Error completing daily focus', error);
    return apiResponse.serverError(error);
  }
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

