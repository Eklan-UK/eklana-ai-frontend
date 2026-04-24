// POST /api/v1/ai/session/summary — linguistic summary + persist AiSession
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import { Types } from "mongoose";
import { z } from "zod";
import AiSession from "@/models/ai-session";
import type { AiSessionMode, SessionSummaryContext, TranscriptTurn } from "@/types/ai-session-summary";
import { generateSessionSummaryFromTranscript } from "@/services/summary.service";
import { logger } from "@/lib/api/logger";

const EMPTY_TURN_PLACEHOLDER = "(no text in this turn)";

/**
 * Zod allows `content: ""`; Mongoose `required: true` on subdocs rejects empty/whitespace-only strings.
 * Ensures every saved turn has non-empty `content` for persistence and summarization.
 */
function toPersistedTranscript(
	messages: { role: "user" | "model"; content: string }[],
): TranscriptTurn[] {
	return messages.map((m) => {
		const raw = typeof m.content === "string" ? m.content : "";
		const content = raw.trim() === "" ? EMPTY_TURN_PLACEHOLDER : raw;
		return { role: m.role, content };
	});
}

const messageSchema = z.object({
  role: z.enum(["user", "model"]),
  content: z.string(),
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1),
  mode: z.enum(["free", "topic", "drill"]),
  topic: z.string().optional(),
  drillId: z.string().optional(),
  /** Short human-readable session focus (e.g. drill title + type) for tailored summaries. */
  focusLabel: z.string().max(240).optional(),
});

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
): Promise<NextResponse> {
  try {
    const json = await req.json();
    const validated = bodySchema.parse(json);

    const userTurns = validated.messages.filter((m) => m.role === "user");
    if (userTurns.length === 0) {
      return NextResponse.json(
        {
          code: "ValidationError",
          message: "At least one user message is required to summarize",
        },
        { status: 400 },
      );
    }

    const transcript: TranscriptTurn[] = toPersistedTranscript(validated.messages);

    await connectToDatabase();

    const summaryContext: SessionSummaryContext = {
      mode: validated.mode as AiSessionMode,
      topic: validated.topic?.trim() || undefined,
      focusLabel: validated.focusLabel?.trim() || undefined,
    };

    const summary = await generateSessionSummaryFromTranscript(transcript, summaryContext);

    const drillOid =
      validated.drillId && Types.ObjectId.isValid(validated.drillId)
        ? new Types.ObjectId(validated.drillId)
        : undefined;

    const doc = await AiSession.create({
      userId: context.userId,
      mode: validated.mode as AiSessionMode,
      topic: validated.topic?.trim() || undefined,
      drillId: drillOid,
      transcriptSnapshot: transcript,
      summary,
      endedAt: new Date(),
    });

    logger.info("AiSession summary saved", {
      sessionId: doc._id.toString(),
      userId: context.userId.toString(),
      mode: validated.mode,
    });

    return NextResponse.json(
      {
        code: "Success",
        data: {
          summary,
          sessionId: doc._id.toString(),
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: "ValidationError",
          message: "Validation failed",
          errors: error.issues,
        },
        { status: 400 },
      );
    }
    const msg = error instanceof Error ? error.message : "Server error";
    logger.error("POST ai/session/summary", { error: msg });
    return NextResponse.json(
      {
        code: "ServerError",
        message: msg.includes("429") || msg.includes("quota") || msg.includes("503")
          ? "AI is temporarily busy. Please try again in a moment."
          : msg,
      },
      { status: 500 },
    );
  }
}

export const POST = withAuth(handler);
