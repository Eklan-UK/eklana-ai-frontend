import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import config from "@/lib/api/config";
import { logger } from "@/lib/api/logger";
import {
  getGoogleCalendarOAuthRedirectUri,
  verifyCalendarConnectState,
} from "@/lib/api/google-calendar-oauth";
import {
  getGoogleCalendarConnectionStatusForUser,
  upsertGoogleCalendarRefreshToken,
} from "@/lib/api/google-calendar-connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tutorSettingsRedirect(search: string): NextResponse {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    config.BETTER_AUTH_URL ||
    "http://localhost:3000";
  const origin = base.replace(/\/$/, "");
  return NextResponse.redirect(`${origin}/tutor/settings${search}`);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    logger.warn("Google Calendar OAuth provider error", { oauthError });
    return tutorSettingsRedirect(
      `?calendar=error&reason=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code || !state) {
    return tutorSettingsRedirect("?calendar=error&reason=missing_params");
  }

  const verified = verifyCalendarConnectState(state);
  if (!verified) {
    return tutorSettingsRedirect("?calendar=error&reason=invalid_state");
  }

  const clientId = config.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = config.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return tutorSettingsRedirect("?calendar=error&reason=not_configured");
  }

  const redirectUri = getGoogleCalendarOAuthRedirectUri();
  const client = new OAuth2Client(clientId, clientSecret, redirectUri);

  try {
    const { tokens } = await client.getToken(code);
    const refresh = tokens.refresh_token?.trim();

    if (!refresh) {
      const existing = await getGoogleCalendarConnectionStatusForUser(
        verified.userId,
      );
      if (existing.connected) {
        return tutorSettingsRedirect("?calendar=connected");
      }
      logger.info("Calendar OAuth: no refresh_token and no stored connection", {
        userId: verified.userId,
      });
      return tutorSettingsRedirect("?calendar=error&reason=no_refresh_token");
    }

    await upsertGoogleCalendarRefreshToken(verified.userId, refresh);
    return tutorSettingsRedirect("?calendar=connected");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Google Calendar OAuth token exchange failed", { message });
    return tutorSettingsRedirect("?calendar=error&reason=token_exchange");
  }
}
