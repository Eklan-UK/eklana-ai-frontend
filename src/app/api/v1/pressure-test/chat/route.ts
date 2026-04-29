import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { withAuth } from "@/lib/api/middleware";
import config from "@/lib/api/config";
import { logger } from "@/lib/api/logger";
import { connectToDatabase } from "@/lib/api/db";
import Drill from "@/models/drill";
import { buildSystemPrompt, tokenLimit } from "@/lib/api/pressure-test-prompts";

const MAX_GEMINI_STREAM_ATTEMPTS = 3;

/** 503/429 and similar: safe to retry with a fresh `startChat` + stream. */
function isTransientGeminiError(error: unknown): boolean {
  const s = String((error as { message?: string })?.message || error);
  return (
    /\b503\b/i.test(s) ||
    /\b429\b/i.test(s) ||
    /Service Unavailable/i.test(s) ||
    /UNAVAILABLE/i.test(s) ||
    /high demand/i.test(s) ||
    /overloaded/i.test(s) ||
    /Resource has been exhausted|RESOURCE_EXHAUSTED|quota/i.test(s)
  );
}

function userFacingStreamErrorMessage(error: unknown): string {
  if (isTransientGeminiError(error)) {
    return "The AI service is busy right now. Please try again in a few seconds.";
  }
  return String((error as { message?: string })?.message || error || "Stream failed");
}

const pressureTestChatMetadataSchema = z
  .object({
    latency_ms: z.number().min(0),
    is_pressure_test: z.boolean().optional(),
    scenario_id: z.string().min(1),
  })
  .strict();

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        content: z.string().min(1),
      }),
    )
    .min(1),
  level: z.number().int().min(1).max(20),
  turnNumber: z.number().int().min(1).max(3),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(32).max(4000).optional(),
  drillId: z.string().optional(),
  sessionId: z.string().optional(),
  /**
   * When true, the server does not use prior `messages` as chat history: only the last
   * user turn is sent to Gemini, so a buggy or stale client cannot continue an old thread.
   */
  isNewSession: z.boolean().optional(),
  /** Alias: same semantics as isNewSession (turn-1 clean thread). */
  reset: z.boolean().optional(),
  /** Optional client-reported turn timing (e.g. mental-translation gap after the prior AI stream). */
  metadata: pressureTestChatMetadataSchema.optional(),
});


async function handler(
  req: NextRequest,
  context: { userId: unknown; userRole: string },
): Promise<NextResponse> {
  void context.userId;
  void context.userRole;

  try {
    if (!config.GEMINI_API_KEY) {
      return NextResponse.json(
        { code: "ConfigError", message: "Gemini API key is not configured." },
        { status: 500 },
      );
    }

    const body = await req.json();
    const validated = chatSchema.parse(body);
    const lastMessage = validated.messages[validated.messages.length - 1];

    const isFreshStart = validated.isNewSession === true || validated.reset === true;

    if (validated.metadata) {
      logger.info("pressure-test chat metadata", {
        userId: String(context.userId),
        turnNumber: validated.turnNumber,
        drillId: validated.drillId,
        sessionId: validated.sessionId,
        isNewSession: validated.isNewSession,
        metadata: validated.metadata,
      });
    }

    if (lastMessage.role !== "user") {
      return NextResponse.json(
        { code: "ValidationError", message: "Last message must be from user." },
        { status: 400 },
      );
    }
    if (validated.turnNumber > 3) {
      return NextResponse.json(
        { code: "ValidationError", message: "Pressure test supports up to 3 turns." },
        { status: 400 },
      );
    }

    // Load drill for scenario + system instructions only (not “previous session” storage).
    // We never fetch stored chat history from the DB; history comes only from the request body
    // unless isNewSession / reset forces a clean Gemini history below.
    let drill: any = null;
    if (validated.drillId) {
      try {
        await connectToDatabase();
        drill = await Drill.findById(validated.drillId).lean();
      } catch (err) {
        logger.warn("Could not fetch drill for pressure-test chat", { drillId: validated.drillId, err });
      }
    }

    const systemInstruction = buildSystemPrompt(validated.level, validated.turnNumber, drill);

    const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: config.GEMINI_CHAT_MODEL,
      generationConfig: {
        temperature: validated.temperature ?? 0.75,
        maxOutputTokens: validated.maxTokens ?? tokenLimit(validated.level, validated.turnNumber),
      },
      systemInstruction,
    });

    // Gemini requires history to start with a "user" role.
    // For a fresh turn-1 / begin flow, isNewSession (or reset) ignores the client’s prior entries so the model
    // does not “continue” a stale or spurious past thread.
    let history: { role: "user" | "model"; parts: { text: string }[] }[] = [];
    if (isFreshStart) {
      history = [];
    } else {
      const rawHistory = validated.messages.slice(0, -1);
      const firstUserIdx = rawHistory.findIndex((m) => m.role === "user");
      const historyMessages = firstUserIdx >= 0 ? rawHistory.slice(firstUserIdx) : [];
      history = historyMessages.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));
    }

    const encoder = new TextEncoder();

    let streamClosed = false;
    const stream = new ReadableStream<Uint8Array>({
      cancel() {
        streamClosed = true;
      },
      async start(controller) {
        const send = (obj: { type: string; data: unknown }) => {
          if (streamClosed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          } catch {
            streamClosed = true;
          }
        };
        const closeStream = () => {
          if (streamClosed) return;
          streamClosed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };
        try {
          for (let attempt = 1; attempt <= MAX_GEMINI_STREAM_ATTEMPTS; attempt++) {
            if (streamClosed) return;
            try {
              // Fresh session each attempt so a failed/cancelled stream does not poison history.
              const chat = model.startChat({ history });
              const result = await chat.sendMessageStream(lastMessage.content);
              for await (const chunk of result.stream) {
                if (streamClosed) break;
                const text = chunk.text();
                if (text) send({ type: "text", data: text });
              }
              if (streamClosed) return;
              send({ type: "done", data: null });
              closeStream();
              return;
            } catch (error: any) {
              if (streamClosed) return;
              if (isTransientGeminiError(error) && attempt < MAX_GEMINI_STREAM_ATTEMPTS) {
                const delayMs =
                  400 * 2 ** (attempt - 1) + Math.floor(Math.random() * 350);
                logger.warn("pressure-test chat: retrying after transient Gemini error", {
                  attempt,
                  maxAttempts: MAX_GEMINI_STREAM_ATTEMPTS,
                  delayMs,
                  error: String(error?.message).slice(0, 280),
                });
                await new Promise((r) => setTimeout(r, delayMs));
                continue;
              }
              throw error;
            }
          }
        } catch (error: any) {
          if (streamClosed) {
            return;
          }
          logger.error("Error in pressure-test chat stream", {
            error: error?.message,
            stack: error?.stack,
          });
          send({
            type: "error",
            data: { message: userFacingStreamErrorMessage(error) },
          });
          closeStream();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { code: "ValidationError", message: "Validation failed", errors: error.issues },
        { status: 400 },
      );
    }
    const err = error as { message?: string; stack?: string };
    logger.error("Error in pressure-test chat handler", { error: err.message, stack: err.stack });
    return NextResponse.json(
      {
        code: "ServerError",
        message:
          err.message?.includes("429") || err.message?.includes("quota")
            ? "AI service is temporarily busy. Please wait a moment and try again."
            : "Failed to generate pressure-test response.",
      },
      { status: 500 },
    );
  }
}

export const POST = withAuth(handler);
