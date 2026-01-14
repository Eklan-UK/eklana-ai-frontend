// POST /api/v1/drills/attempts/[attemptId]/summary-review
// Review a summary drill attempt (tutor/admin only)
import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import DrillAttempt from "@/models/drill-attempt";
import Drill from "@/models/drill";
import User from "@/models/user";
import { logger } from "@/lib/api/logger";
import { Types } from "mongoose";
import { z } from "zod";
import { sendDrillReviewNotification } from "@/lib/api/email.service";

const reviewSchema = z.object({
  feedback: z.string().min(1, "Feedback is required"),
  isAcceptable: z.boolean(),
  correctedVersion: z.string().optional(),
});

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string; params?: { attemptId?: string } }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    // Ensure models are registered
    void Drill.modelName;
    void User.modelName;

    // Extract attemptId from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const attemptIdIndex = pathParts.indexOf("attempts") + 1;
    const attemptId = pathParts[attemptIdIndex] || context.params?.attemptId;

    // Validate attempt ID
    if (!attemptId || !Types.ObjectId.isValid(attemptId)) {
      return NextResponse.json(
        {
          code: "InvalidRequest",
          message: "Invalid or missing attempt ID",
        },
        { status: 400 }
      );
    }

    const body = await req.json();
    const validated = reviewSchema.parse(body);

    // Find the attempt
    const attempt = await DrillAttempt.findById(attemptId)
      .populate("drillId", "type")
      .exec();

    if (!attempt) {
      return NextResponse.json(
        {
          code: "NotFound",
          message: "Attempt not found",
        },
        { status: 404 }
      );
    }

    // Verify it's a summary drill
    const drillType = attempt.drillId && (attempt.drillId as any).type;
    if (drillType && drillType !== "summary") {
      return NextResponse.json(
        {
          code: "InvalidRequest",
          message: "This endpoint is only for summary drills",
        },
        { status: 400 }
      );
    }

    // Verify it has summaryResults
    if (!attempt.summaryResults) {
      return NextResponse.json(
        {
          code: "InvalidRequest",
          message: "This attempt does not have summary results",
        },
        { status: 400 }
      );
    }

    // Calculate score based on acceptability
    const score = validated.isAcceptable ? 100 : 50;

    // Update the attempt with review
    attempt.summaryResults.reviewStatus = "reviewed";
    attempt.summaryResults.review = {
      feedback: validated.feedback,
      isAcceptable: validated.isAcceptable,
      correctedVersion: validated.isAcceptable ? undefined : validated.correctedVersion,
      reviewedAt: new Date(),
      reviewedBy: context.userId,
    };
    attempt.score = score;
    attempt.updatedAt = new Date();

    await attempt.save();

    logger.info("Summary drill reviewed", {
      attemptId: attempt._id.toString(),
      reviewerId: context.userId.toString(),
      isAcceptable: validated.isAcceptable,
      score,
    });

    // Get the updated attempt with populated fields
    const updatedAttempt = await DrillAttempt.findById(attemptId)
      .populate("drillId", "title type")
      .populate("learnerId", "firstName lastName email")
      .lean()
      .exec();

    // Send notification to student (async, don't block response)
    if (updatedAttempt) {
      const reviewer = await User.findById(context.userId).select("firstName lastName email").lean().exec();
      const learner = updatedAttempt.learnerId as any;
      const drill = updatedAttempt.drillId as any;
      
      if (learner?.email && drill) {
        sendDrillReviewNotification({
          studentEmail: learner.email,
          studentName: learner.firstName || "Student",
          drillTitle: drill.title,
          drillType: drill.type,
          tutorName: reviewer?.firstName || reviewer?.email || "Your tutor",
          score,
          feedback: validated.feedback,
          isAcceptable: validated.isAcceptable,
        }).catch((err) => {
          logger.error("Failed to send review notification", { error: err.message });
        });
      }
    }

    return NextResponse.json(
      {
        code: "Success",
        message: "Review submitted successfully",
        data: {
          attempt: updatedAttempt,
        },
      },
      { status: 200 }
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

    logger.error("Error reviewing summary drill", {
      error: error.message,
      stack: error.stack,
    });

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

export const POST = withRole(["admin", "tutor"], handler);

