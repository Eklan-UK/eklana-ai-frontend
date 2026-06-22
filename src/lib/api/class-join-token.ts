import crypto from 'crypto';
import config from './config';

export interface ClassJoinTokenPayload {
  sessionId: string;
  learnerId: string;
  /** Unix ms — token invalid after session end */
  exp: number;
}

function signingSecret(): string {
  const s = config.BETTER_AUTH_SECRET || config.JWT_ACCESS_SECRET;
  if (!s) {
    throw new Error(
      'BETTER_AUTH_SECRET or JWT_ACCESS_SECRET is required for class join links',
    );
  }
  return s;
}

export function signClassJoinToken(payload: ClassJoinTokenPayload): string {
  const body = {
    sid: payload.sessionId,
    lid: payload.learnerId,
    exp: payload.exp,
  };
  const payloadB64 = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', signingSecret())
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifyClassJoinToken(token: string): ClassJoinTokenPayload | null {
  try {
    const dot = token.indexOf('.');
    if (dot < 1) return null;
    const payloadB64 = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = crypto
      .createHmac('sha256', signingSecret())
      .update(payloadB64)
      .digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as { sid?: string; lid?: string; exp?: number };
    if (!parsed.sid || !parsed.lid || typeof parsed.exp !== 'number') return null;
    if (Date.now() > parsed.exp) return null;
    return {
      sessionId: parsed.sid,
      learnerId: parsed.lid,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

/** Tracked join link for class reminder emails — records attendance then redirects to Meet. */
export function buildClassEmailJoinUrl(params: {
  sessionId: string;
  learnerId: string;
  sessionEndUtc: Date;
  baseUrl?: string;
}): string {
  const appUrl = (params.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
  const token = signClassJoinToken({
    sessionId: params.sessionId,
    learnerId: params.learnerId,
    exp: new Date(params.sessionEndUtc).getTime(),
  });
  return `${appUrl}/api/v1/learner/sessions/join?t=${encodeURIComponent(token)}`;
}
