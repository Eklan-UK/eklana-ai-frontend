/**
 * Home dashboard: Accurate Sentence Usage & Response Speed from drill attempts.
 */
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/api/db";
import DrillAttempt from "@/models/drill-attempt";
import { extractDrillQualityScore } from "@/domain/confidence/confidence.service";

const SENTENCE_TYPES = new Set(["sentence", "grammar", "sentence_writing"]);
const SPEED_TYPES = new Set(["roleplay", "listening"]);

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** 0–100: higher = faster responses (fluency and/or lower time-to-complete). */
function speedScoreFromAttempt(
  attempt: {
    timeSpent?: number;
    roleplayResults?: { sceneScores?: Array<{ fluencyScore?: number }> };
  },
  drillType: string,
): number | null {
  if (drillType === "roleplay") {
    const scenes = attempt.roleplayResults?.sceneScores;
    const fluencyVals =
      scenes
        ?.map((s) => s.fluencyScore)
        .filter((n): n is number => typeof n === "number" && n > 0) ?? [];
    if (fluencyVals.length > 0) {
      return Math.max(0, Math.min(100, avg(fluencyVals)));
    }
  }
  const t = attempt.timeSpent;
  if (t == null || t <= 0) return null;
  const maxSec = drillType === "listening" ? 600 : 900;
  return Math.max(0, Math.min(100, 100 - (t / maxSec) * 100));
}

export interface HomeProgressMetrics {
  accurateSentenceUsage: number;
  responseSpeed: number;
  sentenceWeeklyChange: number;
  speedWeeklyChange: number;
}

export async function computeHomeProgressMetrics(
  learnerId: string,
): Promise<HomeProgressMetrics> {
  await connectToDatabase();
  const oid = new Types.ObjectId(learnerId);

  const now = new Date();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const thisWeekStart = new Date(now.getTime() - weekMs);
  const lastWeekStart = new Date(now.getTime() - 2 * weekMs);

  const attempts = await DrillAttempt.find({
    learnerId: oid,
    completedAt: { $ne: null },
  })
    .populate("drillId", "type")
    .sort({ completedAt: -1 })
    .limit(200)
    .lean()
    .exec();

  const sentenceScoresThis: number[] = [];
  const sentenceScoresLast: number[] = [];
  const speedScoresThis: number[] = [];
  const speedScoresLast: number[] = [];

  for (const raw of attempts) {
    const a = raw as Record<string, unknown> & {
      drillId?: { type?: string } | null;
      completedAt?: Date;
    };
    const drillType =
      (a.drillId && typeof a.drillId === "object" && "type" in a.drillId
        ? (a.drillId as { type?: string }).type
        : undefined) ?? (a as { drillType?: string }).drillType;
    if (!drillType) continue;

    const completedAt = a.completedAt ? new Date(a.completedAt) : null;
    if (!completedAt) continue;

    const inThisWeek = completedAt >= thisWeekStart;
    const inLastWeekOnly =
      completedAt >= lastWeekStart && completedAt < thisWeekStart;

    if (SENTENCE_TYPES.has(drillType)) {
      const q = extractDrillQualityScore({
        ...(a as object),
        drillType,
      } as Parameters<typeof extractDrillQualityScore>[0]);
      if (q != null) {
        if (inThisWeek) sentenceScoresThis.push(q);
        else if (inLastWeekOnly) sentenceScoresLast.push(q);
      }
    }

    if (SPEED_TYPES.has(drillType)) {
      const sp = speedScoreFromAttempt(
        a as Parameters<typeof speedScoreFromAttempt>[0],
        drillType,
      );
      if (sp != null) {
        if (inThisWeek) speedScoresThis.push(sp);
        else if (inLastWeekOnly) speedScoresLast.push(sp);
      }
    }
  }

  const accurateSentenceUsage = Math.round(
    sentenceScoresThis.length
      ? avg(sentenceScoresThis)
      : sentenceScoresLast.length
        ? avg(sentenceScoresLast)
        : 0,
  );

  const responseSpeed = Math.round(
    speedScoresThis.length
      ? avg(speedScoresThis)
      : speedScoresLast.length
        ? avg(speedScoresLast)
        : 0,
  );

  const sentenceWeeklyChange =
    sentenceScoresThis.length && sentenceScoresLast.length
      ? Math.round(avg(sentenceScoresThis) - avg(sentenceScoresLast))
      : 0;

  const speedWeeklyChange =
    speedScoresThis.length && speedScoresLast.length
      ? Math.round(avg(speedScoresThis) - avg(speedScoresLast))
      : 0;

  return {
    accurateSentenceUsage: Math.max(0, Math.min(100, accurateSentenceUsage)),
    responseSpeed: Math.max(0, Math.min(100, responseSpeed)),
    sentenceWeeklyChange,
    speedWeeklyChange,
  };
}
