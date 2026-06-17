import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { withRole } from "@/lib/api/middleware";
import { logger } from "@/lib/api/logger";

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
        {
          code: "ValidationError",
          message: "messages, currentDrill, and drillType are required",
        },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an AI assistant helping a language tutor refine a clinical English drill. The drill type is ${drillType}. The current drill content is: ${JSON.stringify(currentDrill)}. When the tutor requests changes, return the complete updated drill content as a JSON object matching the original structure. Return only valid JSON, no markdown, no explanation.`;

    logger.info("AI chat drill refinement", { drillType, messageCount: messages.length });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });

    const rawContent = response.choices[0]?.message?.content ?? "";

    try {
      const parsed = JSON.parse(rawContent);
      return NextResponse.json({ code: "Success", data: parsed }, { status: 200 });
    } catch {
      return NextResponse.json({ code: "Success", data: rawContent }, { status: 200 });
    }
  } catch (error: any) {
    logger.error("Error in AI chat drill refinement", { error: error.message });
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Failed to process chat request",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export const POST = withRole(["admin", "tutor"], handler);
