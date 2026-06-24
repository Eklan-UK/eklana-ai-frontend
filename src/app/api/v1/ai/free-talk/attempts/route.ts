// GET/POST /api/v1/ai/free-talk/attempts — learner Free Talk attempt history + save after grading
import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { withPremium } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import { logger } from "@/lib/api/logger";
import FreeTalkAttempt from "@/models/free-talk-attempt";
import { uploadToCloudinary } from "@/services/cloudinary.service";

export const maxDuration = 120;

const gradeBehaviourSchema = z.object({
  id: z.number(),
  name: z.string(),
  result: z.enum(["full", "partial", "none"]),
  score: z.number(),
});

const gradeResultSchema = z.object({
  overallScore: z.number(),
  competencyLevel: z.string(),
  behaviours: z.array(gradeBehaviourSchema),
  rawScore: z.number(),
  maxScore: z.number(),
});

const attemptPayloadSchema = z.object({
  scenarioId: z.string().min(1).max(200),
  scenarioTitle: z.string().min(1).max(500),
  scenarioType: z.string().min(1).max(200),
  feedbackText: z.string().max(200_000).default(""),
  gradeResult: gradeResultSchema.nullable().optional(),
  durationMs: z.number().int().min(0).max(3_600_000).optional(),
  usedVoice: z.boolean().optional().default(false),
});

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

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

async function getHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const limitRaw = searchParams.get("limit");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw || "30", 10) || 30));

    const filter: Record<string, unknown> = { learnerId: context.userId };
    if (cursor && Types.ObjectId.isValid(cursor)) {
      filter._id = { $lt: new Types.ObjectId(cursor) };
    }

    const docs = await FreeTalkAttempt.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()
      .exec();

    const hasMore = docs.length > limit;
    const slice = hasMore ? docs.slice(0, limit) : docs;
    const nextCursor =
      hasMore && slice.length > 0 ? String(slice[slice.length - 1]!._id) : null;

    return NextResponse.json({
      success: true,
      attempts: slice.map((d) => serializeAttempt(d as Parameters<typeof serializeAttempt>[0])),
      nextCursor,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load attempts";
    logger.error("Free talk attempts GET failed", { error: message });
    return NextResponse.json(
      { success: false, message: "Failed to load attempts" },
      { status: 500 }
    );
  }
}

async function postHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const ct = req.headers.get("content-type") || "";
    let validated: z.infer<typeof attemptPayloadSchema>;
    let audioBuffer: Buffer | null = null;
    let audioMime: string | undefined;

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const payloadRaw = form.get("payload");
      if (typeof payloadRaw !== "string") {
        return NextResponse.json(
          { success: false, message: "Missing payload field" },
          { status: 400 }
        );
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(payloadRaw);
      } catch {
        return NextResponse.json(
          { success: false, message: "Invalid JSON in payload" },
          { status: 400 }
        );
      }
      validated = attemptPayloadSchema.parse(parsed);

      const file = form.get("audio");
      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_AUDIO_BYTES) {
          return NextResponse.json(
            { success: false, message: "Audio file is too large" },
            { status: 400 }
          );
        }
        const ab = await file.arrayBuffer();
        audioBuffer = Buffer.from(ab);
        audioMime = file.type || undefined;
      }
    } else {
      const body = await req.json();
      validated = attemptPayloadSchema.parse(body);
    }

    let audioUrl: string | undefined;
    let audioPublicId: string | undefined;

    if (audioBuffer && audioBuffer.length > 0) {
      try {
        const up = await uploadToCloudinary(audioBuffer, {
          folder: "eklan/free-talk/attempts",
          publicId: `ft_${Date.now()}_${context.userId}`,
          resourceType: "raw",
          transformation: [],
        });
        audioUrl = up.secureUrl;
        audioPublicId = up.publicId;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.warn("Free talk attempt audio upload failed", { error: msg });
      }
    }

    const doc = await FreeTalkAttempt.create({
      learnerId: context.userId,
      scenarioId: validated.scenarioId,
      scenarioTitle: validated.scenarioTitle,
      scenarioType: validated.scenarioType,
      feedbackText: validated.feedbackText,
      gradeResult: validated.gradeResult ?? null,
      audioUrl,
      audioPublicId,
      audioMimeType: audioMime,
      durationMs: validated.durationMs,
      usedVoice: validated.usedVoice,
    });

    logger.info("Free talk attempt saved", {
      attemptId: doc._id.toString(),
      learnerIdLen: context.userId.toString().length,
      hasAudio: Boolean(audioUrl),
    });

    let badgesUnlocked: import('@/lib/badges/badge-unlock').BadgeUnlockCelebration[] = [];
    try {
      const { triggerBadgeEvaluation } = await import('@/services/streak.service');
      badgesUnlocked = await triggerBadgeEvaluation(context.userId.toString());
    } catch {
      // badges must not fail attempt save
    }

    return NextResponse.json({
      success: true,
      attempt: serializeAttempt(doc),
      badgesUnlocked,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to save attempt";
    logger.error("Free talk attempts POST failed", { error: message });
    return NextResponse.json(
      { success: false, message: "Failed to save attempt" },
      { status: 500 }
    );
  }
}

export const GET = withPremium(getHandler);
export const POST = withPremium(postHandler);
