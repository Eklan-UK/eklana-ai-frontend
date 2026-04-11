// GET /api/v1/daily-focus/today - Today's daily focus (personalized when multiple candidates exist)
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import DailyFocus from "@/models/daily-focus";
import Profile from "@/models/profile";
import DrillAttempt from "@/models/drill-attempt";
import PronunciationAttempt from "@/models/pronunciation-attempt";
import { logger } from "@/lib/api/logger";
import { Types } from "mongoose";
import type { FocusType } from "@/domain/daily-focus/personalize";
import {
  buildPersonalizationSummary,
  drillTypeToFocusType,
  mergeGoalWeights,
  pickBestDailyFocus,
  computePronunciationBoost,
  weaknessWeightsFromAvgScores,
  type PersonalizationSignals,
} from "@/domain/daily-focus/personalize";

function countQuestions(df: {
  fillInBlankQuestions?: unknown[];
  matchingQuestions?: unknown[];
  multipleChoiceQuestions?: unknown[];
  vocabularyQuestions?: unknown[];
}): number {
  return (
    (df.fillInBlankQuestions?.length || 0) +
    (df.matchingQuestions?.length || 0) +
    (df.multipleChoiceQuestions?.length || 0) +
    (df.vocabularyQuestions?.length || 0)
  );
}

async function loadTodaysFocusPool(
  now: Date,
): Promise<Array<Record<string, unknown> & { focusType: FocusType }>> {
  const todayStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const todayEnd = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

  let pool = await DailyFocus.find({
    date: { $gte: todayStart, $lte: todayEnd },
    isActive: true,
  })
    .populate("createdBy", "firstName lastName")
    .lean()
    .exec();

  if (!pool.length) {
    const todayString = now.toISOString().split("T")[0];
    const allActive = await DailyFocus.find({ isActive: true })
      .populate("createdBy", "firstName lastName")
      .lean()
      .exec();
    pool = allActive.filter((df: { date?: Date }) => {
      const dfDate = new Date(df.date as Date).toISOString().split("T")[0];
      return dfDate === todayString;
    }) as typeof pool;
  }

  return pool as Array<Record<string, unknown> & { focusType: FocusType }>;
}

async function avgDrillScoresByFocus(
  learnerId: Types.ObjectId,
): Promise<Partial<Record<FocusType, number>>> {
  const rows = await DrillAttempt.aggregate([
    { $match: { learnerId } },
    { $sort: { completedAt: -1 } },
    { $limit: 100 },
    {
      $lookup: {
        from: "drills",
        localField: "drillId",
        foreignField: "_id",
        as: "drill",
      },
    },
    { $unwind: { path: "$drill", preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: "$drill.type",
        avgScore: { $avg: "$score" },
        n: { $sum: 1 },
      },
    },
  ]).exec();

  const byFocus: Partial<Record<FocusType, number[]>> = {};
  for (const r of rows) {
    const ft = drillTypeToFocusType(String(r._id));
    if (!ft) continue;
    if (!byFocus[ft]) byFocus[ft] = [];
    if (typeof r.avgScore === "number") {
      byFocus[ft]!.push(r.avgScore);
    }
  }

  const out: Partial<Record<FocusType, number>> = {};
  for (const ft of Object.keys(byFocus) as FocusType[]) {
    const arr = byFocus[ft];
    if (!arr?.length) continue;
    out[ft] = arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  return out;
}

async function avgPronunciationScore(
  learnerId: Types.ObjectId,
): Promise<number | null> {
  const agg = await PronunciationAttempt.aggregate([
    { $match: { learnerId } },
    {
      $group: {
        _id: null,
        avg: { $avg: "$textScore" },
      },
    },
  ]).exec();
  const v = agg[0]?.avg;
  return typeof v === "number" ? v : null;
}

async function getHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
): Promise<NextResponse> {
  try {
    await connectToDatabase();
    const now = new Date();
    const userId = context.userId;

    const pool = await loadTodaysFocusPool(now);

    if (!pool.length) {
      logger.info("No daily focus found for today");
      return NextResponse.json(
        {
          code: "NotFound",
          message: "No daily focus available for today",
          dailyFocus: null,
          personalization: null,
        },
        { status: 200 },
      );
    }

    const profile = await Profile.findOne({ userId })
      .select("learningGoals")
      .lean()
      .exec();

    const learningGoals = profile?.learningGoals as string[] | undefined;
    const goalWeights = mergeGoalWeights(learningGoals);
    const primaryGoalId = learningGoals?.[0];

    const avgByDrillFocus = await avgDrillScoresByFocus(userId);
    const weaknessWeights = weaknessWeightsFromAvgScores(avgByDrillFocus);

    const pronAvg = await avgPronunciationScore(userId);
    const pronunciationBoost = computePronunciationBoost(pronAvg);

    const signals: PersonalizationSignals = {
      goalWeights,
      weaknessWeights,
      pronunciationBoost,
      primaryGoalId,
    };

    const candidates = pool.filter((p) => p._id != null) as Array<{
      _id: Types.ObjectId;
      focusType: FocusType;
    }>;

    const { winner } = pickBestDailyFocus(candidates, signals);
    const dailyFocus = winner ?? candidates[0]!;

    const hadGoalWeights = Object.keys(goalWeights).length > 0;
    const hadWeakness = Object.keys(weaknessWeights).length > 0;
    const hadPronunciationSignal = pronunciationBoost > 0;

    const { summary, signalsUsed } = buildPersonalizationSummary({
      winnerFocusType: dailyFocus.focusType as FocusType,
      signals,
      hadGoalWeights,
      hadWeakness,
      hadPronunciationSignal,
    });

    const questionTotal = countQuestions(
      dailyFocus as {
        fillInBlankQuestions?: unknown[];
        matchingQuestions?: unknown[];
        multipleChoiceQuestions?: unknown[];
        vocabularyQuestions?: unknown[];
      },
    );

    return NextResponse.json(
      {
        code: "Success",
        dailyFocus: {
          ...dailyFocus,
          totalQuestions: questionTotal,
        },
        personalization: {
          summary,
          signalsUsed,
          candidateCount: pool.length,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error fetching today's daily focus", error);
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Internal Server Error",
        error: message,
      },
      { status: 500 },
    );
  }
}

export const GET = withAuth(getHandler);
