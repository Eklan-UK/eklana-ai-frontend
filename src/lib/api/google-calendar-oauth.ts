import crypto from "crypto";
import config from "./config";
import {
  getPublicBaseUrlFallback,
  resolvePublicBaseUrlFromHeaders,
} from "@/lib/public-base-url";

const STATE_TTL_MS = 10 * 60 * 1000;

function signingSecret(): string {
  const s = config.BETTER_AUTH_SECRET || config.JWT_ACCESS_SECRET;
  if (!s) {
    throw new Error(
      "BETTER_AUTH_SECRET or JWT_ACCESS_SECRET is required for Google Calendar OAuth state",
    );
  }
  return s;
}

/** Public URL of this API (prefer request Host when available for one build / multi-host). */
export function getGoogleCalendarOAuthBaseUrl(reqHeaders?: Headers): string {
  if (reqHeaders) {
    const r = resolvePublicBaseUrlFromHeaders(reqHeaders);
    if (r) return r.replace(/\/$/, "");
  }
  return getPublicBaseUrlFallback().replace(/\/$/, "");
}

/** Redirect URI registered on the Calendar OAuth client in Google Cloud Console. */
export function getGoogleCalendarOAuthRedirectUri(reqHeaders?: Headers): string {
  return `${getGoogleCalendarOAuthBaseUrl(reqHeaders)}/api/v1/tutor/google-calendar/callback`;
}

export function signCalendarConnectState(userId: string): string {
  const payload = {
    uid: userId,
    exp: Date.now() + STATE_TTL_MS,
    n: crypto.randomBytes(16).toString("hex"),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const sig = crypto
    .createHmac("sha256", signingSecret())
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyCalendarConnectState(
  state: string,
): { userId: string } | null {
  try {
    const dot = state.indexOf(".");
    if (dot < 1) return null;
    const payloadB64 = state.slice(0, dot);
    const sig = state.slice(dot + 1);
    const expected = crypto
      .createHmac("sha256", signingSecret())
      .update(payloadB64)
      .digest("base64url");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as { uid?: string; exp?: number };
    if (!payload.uid || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return { userId: payload.uid };
  } catch {
    return null;
  }
}
