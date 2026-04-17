import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import { logger } from "@/lib/api/logger";
import PressureTestSession from "@/models/pressure-test-session";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

async function handler(
  req: NextRequest,
  context: { userId: { toString(): string }; userRole: string },
): Promise<NextResponse> {
  void context.userRole;

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      MAX_LIMIT,
    );
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);

    await connectToDatabase();

    const userId = context.userId.toString();

    const [sessions, total] = await Promise.all([
      PressureTestSession.find({ userId })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .select(
          "drillId level levelBefore levelAfter progressToNextLevel " +
          "overallResponseSpeed overallAccuracy overallPronunciation overallConfidence " +
          "strengths weaknesses nextSteps turnFeedback createdAt",
        )
        .lean(),
      PressureTestSession.countDocuments({ userId }),
    ]);

    // Summary stats across all sessions
    let averages = null;
    if (total > 0) {
      const allSessions = await PressureTestSession.find({ userId })
        .select("overallResponseSpeed overallAccuracy overallPronunciation overallConfidence levelAfter")
        .lean();

      const count = allSessions.length;
      const sum = allSessions.reduce(
        (acc, s) => ({
          speed: acc.speed + s.overallResponseSpeed,
          accuracy: acc.accuracy + s.overallAccuracy,
          pronunciation: acc.pronunciation + s.overallPronunciation,
          confidence: acc.confidence + s.overallConfidence,
        }),
        { speed: 0, accuracy: 0, pronunciation: 0, confidence: 0 },
      );

      averages = {
        responseSpeed: Number((sum.speed / count).toFixed(1)),
        accuracy: Math.round(sum.accuracy / count),
        pronunciation: Math.round(sum.pronunciation / count),
        confidence: Math.round(sum.confidence / count),
      };
    }

    const currentLevel =
      sessions.length > 0 ? (sessions[0] as any).levelAfter ?? (sessions[0] as any).level : 1;

    return NextResponse.json({
      code: "Success",
      data: {
        currentLevel,
        totalSessions: total,
        averages,
        sessions: sessions.map((s: any) => ({
          sessionId: s._id,
          date: s.createdAt,
          drillId: s.drillId ?? null,
          level: s.level,
          levelBefore: s.levelBefore ?? s.level,
          levelAfter: s.levelAfter ?? s.level,
          levelChanged: (s.levelAfter ?? s.level) !== (s.levelBefore ?? s.level),
          scores: {
            responseSpeed: s.overallResponseSpeed,
            accuracy: s.overallAccuracy,
            pronunciation: s.overallPronunciation,
            confidence: s.overallConfidence,
          },
          progressToNextLevel: s.progressToNextLevel,
          strengths: s.strengths ?? [],
          weaknesses: s.weaknesses ?? [],
          nextSteps: s.nextSteps ?? [],
          turnFeedback: s.turnFeedback ?? [],
        })),
        pagination: { total, limit, offset },
      },
    });
  } catch (error: any) {
    logger.error("Error fetching pressure test sessions", { error: error?.message });
    return NextResponse.json(
      { code: "ServerError", message: "Failed to fetch session history." },
      { status: 500 },
    );
  }
}

export const GET = withAuth(handler);
