// GET /api/v1/tutor/pressure-test/[studentId]/[sessionId]
// Returns full detail for a single pressure-test session including all turns and feedback.
import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import Profile from "@/models/profile";
import PressureTestSession from "@/models/pressure-test-session";
import { logger } from "@/lib/api/logger";
import { Types } from "mongoose";

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { studentId: string; sessionId: string },
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const { studentId, sessionId } = params;

    if (!Types.ObjectId.isValid(studentId) || !Types.ObjectId.isValid(sessionId)) {
      return NextResponse.json(
        { code: "ValidationError", message: "Invalid student or session ID." },
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

    const session = await PressureTestSession.findOne({
      _id: new Types.ObjectId(sessionId),
      userId: studentObjectId,
    }).lean();

    if (!session) {
      return NextResponse.json(
        { code: "NotFoundError", message: "Session not found." },
        { status: 404 },
      );
    }

    const s = session as any;

    return NextResponse.json({
      code: "Success",
      data: {
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
        turns: (s.turns ?? []).map((t: any) => ({
          turnNumber: t.turnNumber,
          aiPrompt: t.aiPrompt,
          studentResponseText: t.studentResponseText,
          latencyMs: t.latencyMs,
          latencySeconds: Number((t.latencyMs / 1000).toFixed(1)),
        })),
      },
    });
  } catch (error: any) {
    logger.error("Error fetching tutor pressure-test session detail", {
      error: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { code: "ServerError", message: "Failed to fetch session detail." },
      { status: 500 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string; sessionId: string }> },
) {
  const resolvedParams = await params;
  return withRole(["tutor"], (req, context) =>
    handler(req, context, resolvedParams),
  )(req);
}
