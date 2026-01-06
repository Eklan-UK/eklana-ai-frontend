// GET /api/v1/drills/learner/my-drills - Get learner's assigned drills
import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import DrillAssignment from "@/models/drill-assignment";
import Learner from "@/models/leaner";
import Drill from "@/models/drill";
import DrillAttempt from "@/models/drill-attempt";
import User from "@/models/user";
import { Types } from "mongoose";
import { logger } from "@/lib/api/logger";

async function getHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get learner profile
    const learner = await Learner.findOne({ userId: context.userId }).exec();
    if (!learner) {
      return NextResponse.json(
        {
          code: "NotFoundError",
          message: "Learner profile not found",
        },
        { status: 404 }
      );
    }

    // Build query
    const query: any = { learnerId: learner._id };
    if (status) {
      // Map frontend status to backend status format
      const statusMap: Record<string, string> = {
        pending: "pending",
        in_progress: "in-progress",
        completed: "completed",
        overdue: "overdue",
        skipped: "skipped",
      };
      query.status = statusMap[status] || status;
    }

    const _drill = await Drill.find();
    const _user = await User.find();
    // Get drill assignments
    const assignments = await DrillAssignment.find(query)
      .populate({
        path: "drillId",
        select:
          "title type difficulty date duration_days context audio_example_url target_sentences roleplay_scenes matching_pairs definition_items grammar_items sentence_writing_items article_title article_content",
      })
      .populate({
        path: "assignedBy",
        select: "firstName lastName email",
      })
      .sort({ assignedAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean()
      .exec();

    const total = await DrillAssignment.countDocuments(query);

    // Get drill attempts for each assignment
    const assignmentsWithAttempts = await Promise.all(
      assignments.map(async (assignment) => {
        const attempts = await DrillAttempt.find({
          drillAssignmentId: assignment._id,
        })
          .sort({ completedAt: -1 })
          .limit(1)
          .lean()
          .exec();

        return {
          ...assignment,
          latestAttempt: attempts[0] || null,
        };
      })
    );

    return NextResponse.json(
      {
        code: "Success",
        message: "Learner drills retrieved successfully",
        data: {
          drills: assignmentsWithAttempts.map((a) => ({
            assignmentId: a._id,
            drill: a.drillId,
            assignedBy: a.assignedBy,
            assignedAt: a.assignedAt,
            dueDate: a.dueDate,
            status: a.status,
            completedAt: a.completedAt,
            latestAttempt: a.latestAttempt
              ? {
                  score: a.latestAttempt.score,
                  timeSpent: a.latestAttempt.timeSpent,
                  completedAt: a.latestAttempt.completedAt,
                }
              : null,
          })),
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + assignments.length < total,
          },
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error("Error getting learner drills", {
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

export const GET = withRole(["user"], getHandler);
