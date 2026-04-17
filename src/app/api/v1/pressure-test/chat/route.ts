import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { withAuth } from "@/lib/api/middleware";
import config from "@/lib/api/config";
import { logger } from "@/lib/api/logger";
import { connectToDatabase } from "@/lib/api/db";
import Drill from "@/models/drill";
import { buildSystemPrompt, tokenLimit } from "@/lib/api/pressure-test-prompts";

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

    // Fetch drill for richer, context-aware prompts
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
    // Drop any leading model/AI messages (e.g. the client-side seed messages).
    const rawHistory = validated.messages.slice(0, -1);
    const firstUserIdx = rawHistory.findIndex((m) => m.role === "user");
    const historyMessages = firstUserIdx >= 0 ? rawHistory.slice(firstUserIdx) : [];
    const history = historyMessages.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history });
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: { type: string; data: unknown }) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };
        try {
          const result = await chat.sendMessageStream(lastMessage.content);
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) send({ type: "text", data: text });
          }
          send({ type: "done", data: null });
          controller.close();
        } catch (error: any) {
          logger.error("Error in pressure-test chat stream", {
            error: error?.message,
            stack: error?.stack,
          });
          send({ type: "error", data: { message: error?.message || "Stream failed" } });
          controller.close();
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
