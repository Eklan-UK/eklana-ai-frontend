// GET /api/v1/drills/learner/my-drills - Get learner's assigned drills
import { NextRequest } from "next/server";
import type { Types } from "mongoose";
import { withRole } from "@/lib/api/middleware";
import { withErrorHandler } from "@/lib/api/error-handler";
import { parseQueryParams } from "@/lib/api/query-parser";
import { apiResponse } from "@/lib/api/response";
import { getLearnerMyDrillsPayload } from "@/lib/server/learner-my-drills.server";

async function getHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
) {
  const queryParams = parseQueryParams(req);
  const payload = await getLearnerMyDrillsPayload(context.userId, {
    status: queryParams.status,
    limit: queryParams.limit,
    offset: queryParams.offset,
  });

  return apiResponse.success(payload);
}

export const GET = withRole(["user"], withErrorHandler(getHandler));
