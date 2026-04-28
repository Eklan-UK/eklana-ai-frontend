// GET /api/v1/tutor/pressure-test/[studentId]
// Returns aggregate pressure-test overview + paginated session list for a student.
// Access restricted to the tutor who has this student assigned in their Profile.
import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import Profile from "@/models/profile";
import User from "@/models/user";
import PressureTestSession from "@/models/pressure-test-session";
import { logger } from "@/lib/api/logger";
import { Types } from "mongoose";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function trendDirection(recent: number, previous: number): "improving" | "declining" | "stable" {
  const diff = recent - previous;
  if (diff > 3) return "improving";
  if (diff < -3) return "declining";
  return "stable";
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1));
}

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { studentId: string },
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const { studentId } = params;

    if (!studentId || !Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { code: "ValidationError", message: "Invalid student ID." },
        { status: 400 },
      );
    }

    const studentObjectId = new Types.ObjectId(studentId);

    // Verify this student is assigned to the requesting tutor
    const profile = await Profile.findOne({
      userId: studentObjectId,
      tutorId: context.userId,
    })
      .lean()
      .exec();

    if (!profile) {
      return NextResponse.json(
        { code: "NotFoundError", message: "Student not found or not assigned to you." },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      MAX_LIMIT,
    );
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);

    const [sessions, total, sessionsFor2s] = await Promise.all([
      PressureTestSession.find({ userId: studentObjectId })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .select(
          "drillId level levelBefore levelAfter progressToNextLevel " +
            "overallResponseSpeed overallAccuracy overallPronunciation overallConfidence " +
            "strengths weaknesses nextSteps turnFeedback createdAt",
        )
        .lean(),
      PressureTestSession.countDocuments({ userId: studentObjectId }),
      // Option A: fast/slow rollups from PressureTestSession turns only (not Matching/Sentence DrillAttempt).
      PressureTestSession.find({ userId: studentObjectId })
        .select("turns.speedSuccess")
        .lean(),
    ]);

    let pressure2s: { fast: number; slow: number; total: number } | null = null;
    {
      let fast = 0;
      let slow = 0;
      for (const doc of sessionsFor2s as Array<{ turns?: Array<{ speedSuccess?: boolean }> }>) {
        for (const t of doc.turns || []) {
          if (t.speedSuccess === true) fast++;
          else if (t.speedSuccess === false) slow++;
        }
      }
      const t = fast + slow;
      if (t > 0) {
        pressure2s = { fast, slow, total: t };
      }
    }

    // Fetch student name for context
    const studentUser = await User.findById(studentObjectId)
      .select("firstName lastName email pressureTestLevel")
      .lean();

    const currentLevel =
      (studentUser as any)?.pressureTestLevel ??
      (sessions.length > 0 ? (sessions[0] as any).levelAfter ?? 1 : 1);

    // Compute averages and trends across all sessions for the analytics header
    let averages = null;
    let trends = null;

    if (total > 0) {
      const allSessions = await PressureTestSession.find({ userId: studentObjectId })
        .select("overallResponseSpeed overallAccuracy overallPronunciation overallConfidence")
        .sort({ createdAt: -1 })
        .lean();

      const speeds = allSessions.map((s) => s.overallResponseSpeed);
      const accuracies = allSessions.map((s) => s.overallAccuracy);
      const pronunciations = allSessions.map((s) => s.overallPronunciation);
      const confidences = allSessions.map((s) => s.overallConfidence);

      averages = {
        responseSpeed: avg(speeds),
        accuracy: Math.round(avg(accuracies)),
        pronunciation: Math.round(avg(pronunciations)),
        confidence: Math.round(avg(confidences)),
      };

      // Trend: recent 5 vs previous 5
      if (allSessions.length >= 6) {
        const r = allSessions.slice(0, 5);
        const p = allSessions.slice(5, 10);
        trends = {
          responseSpeed: trendDirection(avg(r.map((s) => s.overallResponseSpeed)), avg(p.map((s) => s.overallResponseSpeed))),
          accuracy: trendDirection(avg(r.map((s) => s.overallAccuracy)), avg(p.map((s) => s.overallAccuracy))),
          pronunciation: trendDirection(avg(r.map((s) => s.overallPronunciation)), avg(p.map((s) => s.overallPronunciation))),
          confidence: trendDirection(avg(r.map((s) => s.overallConfidence)), avg(p.map((s) => s.overallConfidence))),
        };
      }
    }

    return NextResponse.json({
      code: "Success",
      data: {
        student: {
          id: studentObjectId,
          name: `${(studentUser as any)?.firstName ?? ""} ${(studentUser as any)?.lastName ?? ""}`.trim() || "Unknown",
          email: (studentUser as any)?.email ?? "",
        },
        currentLevel,
        totalSessions: total,
        /** Option A: 2s mental-gap rollups (PressureTestSession only; not Matching/Sentence Drills). */
        pressure2s,
        averages,
        trends,
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
    logger.error("Error fetching tutor pressure-test overview", {
      error: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { code: "ServerError", message: "Failed to fetch pressure test data." },
      { status: 500 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const resolvedParams = await params;
  return withRole(["tutor"], (req, context) =>
    handler(req, context, resolvedParams),
  )(req);
}
