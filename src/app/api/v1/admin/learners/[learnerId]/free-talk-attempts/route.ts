// GET /api/v1/admin/learners/[learnerId]/free-talk-attempts
import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import { logger } from "@/lib/api/logger";
import FreeTalkAttempt from "@/models/free-talk-attempt";
import {
  assertStaffCanReadLearner,
  resolveLearnerIdToUserIdString,
} from "@/lib/api/staff-learner-access";

export const maxDuration = 60;

function serializeAttempt(doc: {
  _id: Types.ObjectId;
  scenarioId: string;
  scenarioTitle: string;
  scenarioType: string;
  feedbackText: string;
  gradeResult: unknown;
  audioUrl?: string;
  audioMimeType?: string;
  durationMs?: number;
  usedVoice: boolean;
  createdAt: Date;
}) {
  return {
    id: doc._id.toString(),
    scenarioId: doc.scenarioId,
    scenarioTitle: doc.scenarioTitle,
    scenarioType: doc.scenarioType,
    feedbackText: doc.feedbackText,
    gradeResult: doc.gradeResult,
    audioUrl: doc.audioUrl ?? null,
    audioMimeType: doc.audioMimeType ?? null,
    durationMs: doc.durationMs ?? null,
    usedVoice: doc.usedVoice,
    completedAt: doc.createdAt.toISOString(),
  };
}

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { learnerId: string }
): Promise<NextResponse> {
  try {
    const { learnerId } = params;

    if (!learnerId || !Types.ObjectId.isValid(learnerId)) {
      return NextResponse.json(
        { code: "ValidationError", message: "Invalid learner ID" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const canonicalLearnerId = await resolveLearnerIdToUserIdString(learnerId);
    const access = await assertStaffCanReadLearner(context, canonicalLearnerId);
    if (access === "forbidden") {
      return NextResponse.json(
        { code: "NotFound", message: "Learner not found or access denied" },
        { status: 404 }
      );
    }

    const learnerOid = new Types.ObjectId(canonicalLearnerId);
    const { searchParams } = new URL(req.url);
    const limitRaw = searchParams.get("limit");
    const limit = Math.min(200, Math.max(1, parseInt(limitRaw || "100", 10) || 100));

    // Match ObjectId-stored learnerId; include string form for any legacy rows.
    const learnerFilter = {
      $or: [{ learnerId: learnerOid }, { learnerId: canonicalLearnerId }],
    };

    const docs = await FreeTalkAttempt.find(learnerFilter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean()
      .exec();

    return NextResponse.json({
      code: "Success",
      data: {
        attempts: docs.map((d) =>
          serializeAttempt(d as Parameters<typeof serializeAttempt>[0])
        ),
        nextCursor: null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load attempts";
    logger.error("Admin free talk attempts GET failed", { error: message });
    return NextResponse.json(
      { code: "ServerError", message: "Failed to load attempts" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ learnerId: string }> }
) {
  const resolved = await params;
  return withRole(["admin", "tutor"], (r, context) => handler(r, context, resolved))(req);
}
