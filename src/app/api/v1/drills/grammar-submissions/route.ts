// GET /api/v1/drills/grammar-submissions
// Get all pending grammar drill submissions for review (admin/tutor only)
import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import DrillAttempt from "@/models/drill-attempt";
import Drill from "@/models/drill";
import User from "@/models/user";
import { Types } from "mongoose";

async function getHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    // Ensure models are registered before populate
    void Drill.modelName;
    void User.modelName;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "pending"; // pending, reviewed, all
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    // Build query for grammar drill attempts with patterns (new format)
    const query: Record<string, any> = {
      "grammarResults.patterns": { $exists: true, $ne: null, $not: { $size: 0 } },
    };

    if (status === "pending") {
      query["grammarResults.reviewStatus"] = "pending";
    } else if (status === "reviewed") {
      query["grammarResults.reviewStatus"] = "reviewed";
    }
    // If status is "all", no filter on reviewStatus

    // Get attempts with populated data
    const attempts = await DrillAttempt.find(query)
      .populate("learnerId", "firstName lastName email")
      .populate("drillId", "title type grammar_items")
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    // Get total count for pagination
    const total = await DrillAttempt.countDocuments(query);

    // Group attempts by learner for easier display
    const submissionsByLearner: Record<string, any> = {};

    for (const attempt of attempts) {
      const learner = attempt.learnerId as any;
      if (!learner?._id) continue;

      const learnerId = learner._id.toString();

      if (!submissionsByLearner[learnerId]) {
        submissionsByLearner[learnerId] = {
          learner: {
            _id: learnerId,
            name: `${learner.firstName || ""} ${learner.lastName || ""}`.trim() || "Unknown",
            email: learner.email,
          },
          submissions: [],
        };
      }

      submissionsByLearner[learnerId].submissions.push({
        attemptId: attempt._id,
        drill: attempt.drillId,
        grammarResults: attempt.grammarResults,
        completedAt: attempt.completedAt,
        score: attempt.score,
        timeSpent: attempt.timeSpent,
      });
    }

    return NextResponse.json(
      {
        code: "Success",
        data: {
          submissions: Object.values(submissionsByLearner),
          attempts, // Also include raw attempts for flexibility
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error fetching grammar submissions:", error);
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Failed to fetch submissions",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export const GET = withRole(["admin", "tutor"], getHandler);

