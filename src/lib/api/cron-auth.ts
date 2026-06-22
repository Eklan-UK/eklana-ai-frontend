import type { NextRequest } from 'next/server';

/**
 * Cron route authentication.
 *
 * Production (Vercel Cron): set CRON_SECRET — Vercel sends Authorization: Bearer <CRON_SECRET>.
 * Local dev: set route-specific secrets (CLASS_REMINDER_CRON_SECRET, etc.) or reuse CRON_SECRET.
 */
export function isCronConfigured(routeSecretEnv: string): boolean {
  return Boolean(process.env.CRON_SECRET || process.env[routeSecretEnv]);
}

function bearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
}

export function authorizeCron(req: NextRequest, routeSecretEnv: string): boolean {
  const vercelSecret = process.env.CRON_SECRET;
  const routeSecret = process.env[routeSecretEnv];
  const bearer = bearerToken(req);
  const headerSecret = req.headers.get('x-cron-secret');

  if (vercelSecret && bearer === vercelSecret) return true;
  if (routeSecret && (bearer === routeSecret || headerSecret === routeSecret)) {
    return true;
  }
  return false;
}

/** Verbose cron payloads (debug arrays, error strings) — local only. */
export function shouldCronDebug(req: NextRequest): boolean {
  if (process.env.CRON_DEBUG !== 'true') return false;
  return req.nextUrl.searchParams.get('debug') === '1';
}

export type CronServiceResult = {
  examined?: number;
  sent?: number;
  skipped?: number;
  errors?: string[];
  debug?: unknown[];
};

/** Strip session/learner IDs from production responses. */
export function sanitizeCronResult(
  result: CronServiceResult,
  verbose: boolean,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    examined: result.examined ?? 0,
    sent: result.sent ?? 0,
    skipped: result.skipped ?? 0,
    errorCount: result.errors?.length ?? 0,
  };
  if (verbose) {
    if (result.errors?.length) base.errors = result.errors;
    if (result.debug?.length) base.debug = result.debug;
  }
  return base;
}
