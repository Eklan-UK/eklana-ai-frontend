// GET/POST /api/v1/activities/recent
// Track and retrieve user's recent activities
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import Activity from "@/models/activity";
import { Types } from "mongoose";
import { z } from "zod";

// Schema for creating activity
const createActivitySchema = z.object({
  type: z.enum(["drill", "pronunciation", "lesson"]),
  resourceId: z.string().refine((id) => Types.ObjectId.isValid(id), {
    message: "resourceId must be a valid ObjectId",
  }),
  action: z.enum(["viewed", "started", "completed"]),
  metadata: z
    .object({
      title: z.string().optional(),
      type: z.string().optional(),
      score: z.number().optional(),
      duration: z.number().optional(),
    })
    .optional(),
});

// POST handler - Create new activity
async function postHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const body = await req.json();
    const validated = createActivitySchema.parse(body);

    // Upsert activity to avoid duplicates for same resource+action within short time
    // This prevents spam if user refreshes the page multiple times
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    const existingActivity = await Activity.findOne({
      userId: context.userId,
      type: validated.type,
      resourceId: new Types.ObjectId(validated.resourceId),
      action: validated.action,
      createdAt: { $gte: oneMinuteAgo },
    }).lean();

    if (existingActivity) {
      // Update existing activity's timestamp
      await Activity.findByIdAndUpdate(existingActivity._id, {
        $set: { updatedAt: new Date(), metadata: validated.metadata },
      });

      return NextResponse.json(
        { code: "Success", message: "Activity updated" },
        { status: 200 }
      );
    }

    // Create new activity
    await Activity.create({
      userId: context.userId,
      type: validated.type,
      resourceId: new Types.ObjectId(validated.resourceId),
      action: validated.action,
      metadata: validated.metadata,
    });

    return NextResponse.json(
      { code: "Success", message: "Activity tracked" },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: "ValidationError",
          message: "Invalid request data",
          errors: error.issues,
        },
        { status: 400 }
      );
    }

    // Don't fail the request for activity tracking errors - it's non-critical
    console.error("Activity tracking error:", error.message);
    return NextResponse.json(
      { code: "Success", message: "Activity tracking skipped" },
      { status: 200 }
    );
  }
}

// GET handler - Get user's recent activities
async function getHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
    const type = searchParams.get("type");

    const query: Record<string, unknown> = { userId: context.userId };
    if (type) {
      query.type = type;
    }

    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json(
      {
        code: "Success",
        data: { activities },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error fetching activities:", error.message);
    return NextResponse.json(
      { code: "ServerError", message: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler);
export const GET = withAuth(getHandler);
