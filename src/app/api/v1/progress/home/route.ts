// GET /api/v1/progress/home — Accurate Sentence Usage & Response Speed (drill-based)
import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { withErrorHandler } from "@/lib/api/error-handler";
import { Types } from "mongoose";
import { apiResponse } from "@/lib/api/response";
import { computeHomeProgressMetrics } from "@/domain/progress/home-progress-metrics";

async function getHandler(
  _req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
) {
  const metrics = await computeHomeProgressMetrics(context.userId.toString());
  return apiResponse.success({ homeProgress: metrics });
}

export const GET = withRole(["user"], withErrorHandler(getHandler));
