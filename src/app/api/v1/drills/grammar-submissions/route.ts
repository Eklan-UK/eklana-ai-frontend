// GET /api/v1/drills/grammar-submissions
// Get all pending grammar drill submissions for review (admin/tutor only)
import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { withRole } from "@/lib/api/middleware";
import { withErrorHandler } from "@/lib/api/error-handler";
import { connectToDatabase } from "@/lib/api/db";
import { parseQueryParams } from "@/lib/api/query-parser";
import { apiResponse } from "@/lib/api/response";
import { AttemptRepository } from "@/domain/attempts/attempt.repository";
import { resolveTutorScopedLearnerIds } from "@/lib/api/staff-learner-access";

async function getHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
) {
  await connectToDatabase();

  const scoped = await resolveTutorScopedLearnerIds(context);
  if (!scoped.ok) {
    return apiResponse.notFound("Submissions");
  }

  const queryParams = parseQueryParams(req);
  const statusParam = new URL(req.url).searchParams.get("status") || "pending";
  const status =
    statusParam === "reviewed" || statusParam === "all" || statusParam === "pending"
      ? statusParam
      : "pending";
  const limit = Math.min(queryParams.limit || 50, 100);
  const page = parseInt(new URL(req.url).searchParams.get("page") || "1");
  const offset = (page - 1) * limit;

  const attemptRepo = new AttemptRepository();
  const result = await attemptRepo.getGrammarSubmissions({
    status,
    limit,
    offset,
    learnerIds: scoped.learnerIds,
  });

  return apiResponse.success({
    attempts: result.attempts,
    pagination: {
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    },
  });
}

export const GET = withRole(["admin", "tutor"], withErrorHandler(getHandler));
