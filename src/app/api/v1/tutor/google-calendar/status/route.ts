import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { withRole } from "@/lib/api/middleware";
import { withErrorHandler } from "@/lib/api/error-handler";
import { apiResponse } from "@/lib/api/response";
import { getGoogleCalendarConnectionStatusForUser } from "@/lib/api/google-calendar-connection";

async function getHandler(
  _req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
) {
  const status = await getGoogleCalendarConnectionStatusForUser(
    context.userId.toString(),
  );
  return apiResponse.success({
    connected: status.connected,
  });
}

export const GET = withRole(["tutor"], withErrorHandler(getHandler));
