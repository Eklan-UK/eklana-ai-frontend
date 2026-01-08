import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { logger } from "@/lib/api/logger";
import { documentParserService } from "@/services/document-parser.service";

async function handler(
  req: NextRequest,
  context: { userId: any; userRole: string }
): Promise<NextResponse> {
  try {
    // Role already checked by withRole middleware
    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        {
          code: "ValidationError",
          message: "No text provided",
        },
        { status: 400 }
      );
    }

    // Parse clipboard text
    const parsed = await documentParserService.parseClipboard(text);

    logger.info("Clipboard data parsed successfully", {
      detectedType: parsed.type,
      confidence: parsed.confidence,
    });

    return NextResponse.json(
      {
        code: "Success",
        message: "Clipboard data parsed successfully",
        data: parsed,
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error("Error parsing clipboard data", error);
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Failed to parse clipboard data",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export const POST = withRole(["tutor", "admin"], handler);
