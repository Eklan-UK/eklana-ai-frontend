// GET /api/v1/drills/learner/my-drills - Get learner's assigned drills
import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import DrillAssignment from "@/models/drill-assignment";
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

    // Build query - use userId directly since learnerId now references User
    const query: any = { learnerId: context.userId };
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

    // Get drill assignments with minimal populate (only metadata, not content)
    // Content fields are loaded separately when drill is opened
    const assignments = await DrillAssignment.find(query)
      .populate(
        "drillId",
        "title type difficulty date duration_days context audio_example_url"
      )
      .populate("assignedBy", "firstName lastName email")
      .sort({ assignedAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean()
      .exec();

    const total = await DrillAssignment.countDocuments(query);

    // Get drill attempts efficiently using aggregation or batch query
    // Instead of N queries, we'll fetch attempts for all assignments at once
    const assignmentIds = assignments.map((a) => a._id);

    // Get latest attempt for each assignment using aggregation
    const latestAttempts = await DrillAttempt.aggregate([
      {
        $match: {
          drillAssignmentId: { $in: assignmentIds },
        },
      },
      {
        $sort: { completedAt: -1, createdAt: -1 },
      },
      {
        $group: {
          _id: "$drillAssignmentId",
          latestAttempt: { $first: "$$ROOT" },
        },
      },
    ]);

    // Create a map for quick lookup
    const attemptMap = new Map(
      latestAttempts.map((item) => [
        item._id.toString(),
        {
          score: item.latestAttempt.score,
          timeSpent: item.latestAttempt.timeSpent,
          completedAt: item.latestAttempt.completedAt,
        },
      ])
    );

    // Combine assignments with their latest attempts
    const assignmentsWithAttempts = assignments.map((assignment) => ({
      ...assignment,
      latestAttempt: attemptMap.get(assignment._id.toString()) || null,
    }));

    return NextResponse.json(
      {
        code: "Success",
        message: "User drills retrieved successfully",
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
    logger.error("Error getting user drills", {
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
