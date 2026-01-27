// GET /api/v1/drills/learner/my-drills - Get learner's assigned drills
import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { withErrorHandler } from "@/lib/api/error-handler";
import { connectToDatabase } from "@/lib/api/db";
import { parseQueryParams } from "@/lib/api/query-parser";
import { apiResponse } from "@/lib/api/response";
import { AssignmentRepository } from "@/domain/assignments/assignment.repository";
import { AttemptRepository } from "@/domain/attempts/attempt.repository";

async function getHandler(
  req: NextRequest,
  context: { userId: any; userRole: string }
) {
  await connectToDatabase();

  const queryParams = parseQueryParams(req);
  const status = queryParams.status;

  // Initialize repositories
  const assignmentRepo = new AssignmentRepository();
  const attemptRepo = new AttemptRepository();

  // Get learner's assignments
  const result = await assignmentRepo.findByLearnerId(context.userId.toString(), {
    status,
    limit: queryParams.limit,
    offset: queryParams.offset,
  });

  // Get latest attempts for all assignments
  const assignmentIds = result.assignments.map((a: any) => a._id.toString());
  const attemptMap = await attemptRepo.getLatestAttemptsForAssignments(assignmentIds);

  // Combine assignments with their latest attempts
  const drills = result.assignments.map((assignment: any) => {
    const attemptData = attemptMap.get(assignment._id.toString());
    return {
      assignmentId: assignment._id,
      drill: assignment.drillId,
      assignedBy: assignment.assignedBy,
      assignedAt: assignment.assignedAt,
      dueDate: assignment.dueDate,
      status: assignment.status,
      completedAt: assignment.completedAt,
      latestAttempt: attemptData
        ? {
            score: attemptData.score,
            timeSpent: attemptData.timeSpent,
            completedAt: attemptData.completedAt,
            reviewStatus: attemptData.reviewStatus,
            correctCount: attemptData.correctCount,
            totalCount: attemptData.totalCount,
          }
        : null,
    };
  });

  return apiResponse.success({
    drills,
    pagination: {
      total: result.total,
      limit: queryParams.limit,
      offset: queryParams.offset,
      hasMore: queryParams.offset + result.assignments.length < result.total,
    },
  });
}

export const GET = withRole(["user"], withErrorHandler(getHandler));
