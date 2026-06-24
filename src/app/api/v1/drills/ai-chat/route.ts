import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { logger } from "@/lib/api/logger";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function handler(
  req: NextRequest,
  context: { userId: any; userRole: string }
): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { messages, currentDrill, drillType } = body;

    if (!messages || !currentDrill || !drillType) {
      return NextResponse.json(
        { code: "ValidationError", message: "messages, currentDrill, and drillType are required" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an AI assistant helping a language tutor refine a clinical English drill. The drill type is ${drillType}. The current drill content is: ${JSON.stringify(currentDrill)}.

If the tutor asks a question or makes a comment that does not request a change to the drill, respond conversationally in plain text — do not return JSON.

If the tutor requests a specific change to the drill content, return ONLY the complete updated drill as a valid JSON object matching the original structure. No markdown, no explanation, just the JSON.

Use your judgment to distinguish between questions/comments and change requests.`;

    logger.info("Refining drill via AI chat", { drillType });

    const completion = await openai.chat.completions.create({
      model: "gpt-5.5",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";

    try {
      const parsed = JSON.parse(raw);
      return NextResponse.json({ data: { drill: parsed, message: null } }, { status: 200 });
    } catch {
      return NextResponse.json({ data: { drill: null, message: raw } }, { status: 200 });
    }
  } catch (error: any) {
    logger.error("Error in AI chat drill refinement", { error: error.message });
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Failed to refine drill content",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export const POST = withRole(["admin", "tutor"], handler);
