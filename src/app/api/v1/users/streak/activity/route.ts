// POST /api/v1/users/streak/activity — idempotent “count today” for login (UTC day)
import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { withErrorHandler } from "@/lib/api/error-handler";
import { connectToDatabase } from "@/lib/api/db";
import { StreakService } from "@/services/streak.service";
import { apiResponse } from "@/lib/api/response";

async function postHandler(
  req: NextRequest,
  context: { userId: any; userRole: string }
) {
  await connectToDatabase();
  await StreakService.recordActivityDay(context.userId.toString());
  return apiResponse.success({ recorded: true });
}

export const POST = withRole(["user"], withErrorHandler(postHandler));
