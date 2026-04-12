// GET /api/v1/ai/session/summaries — recent post-session summaries for current user
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import { Types } from "mongoose";
import AiSession from "@/models/ai-session";
import { logger } from "@/lib/api/logger";

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10)),
    );
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    const [items, total] = await Promise.all([
      AiSession.find({ userId: context.userId })
        .sort({ endedAt: -1 })
        .skip(offset)
        .limit(limit)
        .select("mode topic drillId summary endedAt createdAt")
        .lean()
        .exec(),
      AiSession.countDocuments({ userId: context.userId }).exec(),
    ]);

    return NextResponse.json(
      {
        code: "Success",
        data: {
          sessions: items.map((s) => ({
            id: s._id.toString(),
            mode: s.mode,
            topic: s.topic,
            drillId: s.drillId?.toString(),
            summary: s.summary,
            endedAt: s.endedAt,
            createdAt: s.createdAt,
          })),
          total,
          limit,
          offset,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Server error";
    logger.error("GET ai/session/summaries", { error: msg });
    return NextResponse.json(
      { code: "ServerError", message: msg },
      { status: 500 },
    );
  }
}

export const GET = withAuth(handler);
