// GET /api/v1/drills/summary-submissions
// Get summary drill submissions for review
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
    
    // Ensure models are registered
    void Drill.modelName;
    void User.modelName;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "pending";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    // Build query
    const query: Record<string, any> = {
      summaryResults: { $exists: true, $ne: null },
      "summaryResults.summaryProvided": true,
    };

    if (status === "pending") {
      query["summaryResults.reviewStatus"] = { $in: ["pending", null] };
    } else if (status === "reviewed") {
      query["summaryResults.reviewStatus"] = "reviewed";
    }
    // "all" status doesn't add any filter

    const attempts = await DrillAttempt.find(query)
      .populate("learnerId", "firstName lastName email")
      .populate("drillId", "title type article_title")
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    const total = await DrillAttempt.countDocuments(query);

    // Group by learner
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
        summaryResults: attempt.summaryResults,
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
          attempts,
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
    console.error("Error fetching summary submissions:", error);
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

