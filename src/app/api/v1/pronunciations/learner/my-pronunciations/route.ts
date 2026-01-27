// GET /api/v1/pronunciations/learner/my-pronunciations
// Get pronunciations assigned to the current learner
import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { withErrorHandler } from "@/lib/api/error-handler";
import { connectToDatabase } from "@/lib/api/db";
import { parseQueryParams } from "@/lib/api/query-parser";
import { apiResponse } from "@/lib/api/response";
import { PronunciationAssignmentRepository } from "@/domain/pronunciations/pronunciation-assignment.repository";

async function handler(
  req: NextRequest,
  context: { userId: any; userRole: string }
) {
  await connectToDatabase();

  const queryParams = parseQueryParams(req);
  const status = queryParams.status;

  const assignmentRepo = new PronunciationAssignmentRepository();

  // Get learner's assignments
  const assignments = await assignmentRepo.findMany({
    learnerId: context.userId.toString(),
    status,
    limit: queryParams.limit,
    offset: queryParams.offset,
  });

  const total = await assignmentRepo.findMany({
    learnerId: context.userId.toString(),
    status,
    limit: 10000, // Get all for count
    offset: 0,
  }).then(results => results.length);

  // Format response
  const pronunciations = assignments.map((assignment: any) => ({
    assignmentId: assignment._id,
    pronunciation: assignment.pronunciationId,
    assignedBy: assignment.assignedBy,
    assignedAt: assignment.assignedAt,
    dueDate: assignment.dueDate,
    status: assignment.status,
    completedAt: assignment.completedAt,
    attemptsCount: assignment.attemptsCount,
    bestScore: assignment.bestScore,
    lastAttemptAt: assignment.lastAttemptAt,
  }));

  return apiResponse.success({
    pronunciations,
    pagination: {
      total,
      limit: queryParams.limit,
      offset: queryParams.offset,
      hasMore: queryParams.offset + pronunciations.length < total,
    },
  });
}

export const GET = withRole(["user"], withErrorHandler(handler));
