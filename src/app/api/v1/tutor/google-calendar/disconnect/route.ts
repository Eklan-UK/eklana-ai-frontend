import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { withRole } from "@/lib/api/middleware";
import { withErrorHandler } from "@/lib/api/error-handler";
import { apiResponse } from "@/lib/api/response";
import { deleteGoogleCalendarConnectionForUser } from "@/lib/api/google-calendar-connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function deleteHandler(
  _req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
) {
  await deleteGoogleCalendarConnectionForUser(context.userId.toString());
  return apiResponse.success({ disconnected: true });
}

export const DELETE = withRole(["tutor"], withErrorHandler(deleteHandler));
