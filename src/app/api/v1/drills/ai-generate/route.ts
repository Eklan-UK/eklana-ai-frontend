import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { logger } from "@/lib/api/logger";
import { generateDrill } from "@/domain/drills/ai-drill-generator.service";

async function handler(
  req: NextRequest,
  context: { userId: any; userRole: string }
): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { drillType, difficulty, context: drillContext, prompt, studentId } = body;

    if (!drillType || !prompt) {
      return NextResponse.json(
        {
          code: "ValidationError",
          message: "drillType and prompt are required",
        },
        { status: 400 }
      );
    }

    logger.info("Generating AI drill content", {
      drillType,
      difficulty,
      studentId,
    });

    const generated = await generateDrill({
      drillType,
      difficulty: difficulty ?? "intermediate",
      context: drillContext ?? "",
      prompt,
    });

    return NextResponse.json(
      {
        code: "Success",
        message: "Drill content generated successfully",
        data: generated,
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error("Error generating AI drill content", { error: error.message });
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Failed to generate drill content",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export const POST = withRole(["admin", "tutor"], handler);
