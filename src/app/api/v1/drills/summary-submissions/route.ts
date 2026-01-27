// GET /api/v1/drills/summary-submissions
// Get summary drill submissions for review
import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { withErrorHandler } from "@/lib/api/error-handler";
import { connectToDatabase } from "@/lib/api/db";
import { parseQueryParams } from "@/lib/api/query-parser";
import { apiResponse } from "@/lib/api/response";
import { AttemptRepository } from "@/domain/attempts/attempt.repository";

async function getHandler(
  req: NextRequest,
  context: { userId: any; userRole: string }
) {
  await connectToDatabase();

  const queryParams = parseQueryParams(req);
  const status = (queryParams as any).status || "pending";
  const limit = Math.min(queryParams.limit || 50, 100);
  const page = parseInt(new URL(req.url).searchParams.get("page") || "1");
  const offset = (page - 1) * limit;

  const attemptRepo = new AttemptRepository();
  const result = await attemptRepo.getSummarySubmissions({
    status: status as 'pending' | 'reviewed' | 'all',
    limit,
    offset,
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
