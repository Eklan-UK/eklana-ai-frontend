import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import config from "@/lib/api/config";
import { logger } from "@/lib/api/logger";
import {
  getGoogleCalendarOAuthRedirectUri,
  verifyCalendarConnectState,
} from "@/lib/api/google-calendar-oauth";
import {
  getPublicBaseUrlFallback,
  resolvePublicBaseUrlFromHeaders,
} from "@/lib/public-base-url";
import {
  getGoogleCalendarConnectionStatusForUser,
  upsertGoogleCalendarRefreshToken,
} from "@/lib/api/google-calendar-connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tutorSettingsRedirect(req: NextRequest, search: string): NextResponse {
  const resolved =
    resolvePublicBaseUrlFromHeaders(req.headers) ?? getPublicBaseUrlFallback();
  const origin = resolved.replace(/\/$/, "");
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
      req,
      `?calendar=error&reason=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code || !state) {
    return tutorSettingsRedirect(req, "?calendar=error&reason=missing_params");
  }

  const verified = verifyCalendarConnectState(state);
  if (!verified) {
    return tutorSettingsRedirect(req, "?calendar=error&reason=invalid_state");
  }

  const clientId = config.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = config.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return tutorSettingsRedirect(req, "?calendar=error&reason=not_configured");
  }

  const redirectUri = getGoogleCalendarOAuthRedirectUri(req.headers);
  const client = new OAuth2Client(clientId, clientSecret, redirectUri);

  try {
    const { tokens } = await client.getToken(code);
    const refresh = tokens.refresh_token?.trim();

    if (!refresh) {
      const existing = await getGoogleCalendarConnectionStatusForUser(
        verified.userId,
      );
      if (existing.connected) {
        return tutorSettingsRedirect(req, "?calendar=connected");
      }
      logger.info("Calendar OAuth: no refresh_token and no stored connection", {
        userId: verified.userId,
      });
      return tutorSettingsRedirect(req, "?calendar=error&reason=no_refresh_token");
    }

    await upsertGoogleCalendarRefreshToken(verified.userId, refresh);
    return tutorSettingsRedirect(req, "?calendar=connected");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Google Calendar OAuth token exchange failed", { message });
    return tutorSettingsRedirect(req, "?calendar=error&reason=token_exchange");
  }
}
