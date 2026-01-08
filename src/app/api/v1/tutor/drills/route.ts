// GET /api/v1/tutor/drills
// Get all drills created by the authenticated tutor
import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import Drill from "@/models/drill";
import config from "@/lib/api/config";
import { logger } from "@/lib/api/logger";
import { Types } from "mongoose";

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(
      searchParams.get("limit") || String(config.defaultResLimit)
    );
    const offset = parseInt(
      searchParams.get("offset") || String(config.defaultResOffset)
    );
    const type = searchParams.get("type");
    const difficulty = searchParams.get("difficulty");
    const studentEmail = searchParams.get("studentEmail");
    const isActive = searchParams.get("isActive");

    // Build query - use createdById directly (no need to fetch tutor email)
    const query: any = { createdById: context.userId };
    if (type) query.type = type;
    if (difficulty) query.difficulty = difficulty;
    if (isActive !== null) query.is_active = isActive === "true";
    if (studentEmail) query.assigned_to = studentEmail;

    const total = await Drill.countDocuments(query).exec();
    // Only select metadata fields, not large content arrays
    const drills = await Drill.find(query)
      .select(
        "title type difficulty date duration_days context audio_example_url created_date is_active assigned_to createdById"
      )
      .limit(limit)
      .skip(offset)
      .sort({ created_date: -1 })
      .lean()
      .exec();

    return NextResponse.json(
      {
        limit,
        offset,
        total,
        drills,
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error("Error fetching tutor drills", error);
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Internal Server Error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export const GET = withRole(["tutor"], handler);
