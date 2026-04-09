import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { withRole } from "@/lib/api/middleware";
import { withErrorHandler } from "@/lib/api/error-handler";
import config from "@/lib/api/config";
import {
  getGoogleCalendarOAuthRedirectUri,
  signCalendarConnectState,
} from "@/lib/api/google-calendar-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId },
) {
  const clientId = config.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = config.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { code: "ServiceUnavailable", message: "Google Calendar OAuth is not configured" },
      { status: 503 },
    );
  }

  const redirectUri = getGoogleCalendarOAuthRedirectUri(req.headers);
  const state = signCalendarConnectState(context.userId.toString());

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    state,
    include_granted_scopes: "true",
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.redirect(url);
}

export const GET = withRole(["tutor"], withErrorHandler(getHandler));
