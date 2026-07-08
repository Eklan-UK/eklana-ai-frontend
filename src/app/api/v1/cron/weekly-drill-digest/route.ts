// GET /api/v1/cron/weekly-drill-digest — Monday 09:00 UTC weekly digest
// Auth: CRON_SECRET (Vercel) or WEEKLY_DRILL_DIGEST_CRON_SECRET (local)
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/api/db';
import { WeeklyDrillDigestService } from '@/domain/drills/weekly-drill-digest.service';
import {
  authorizeCron,
  isCronConfigured,
  sanitizeCronResult,
  shouldCronDebug,
} from '@/lib/api/cron-auth';
import '@/models/user';
import '@/models/drill-assignment';
import '@/models/drill';
import '@/models/profile';
import '@/models/weekly-drill-digest-dispatch';
import '@/models/push-token.model';
import '@/models/notification.model';

const ROUTE_SECRET_ENV = 'WEEKLY_DRILL_DIGEST_CRON_SECRET';

export async function GET(req: NextRequest) {
  if (!isCronConfigured(ROUTE_SECRET_ENV)) {
    return NextResponse.json(
      {
        code: 'NotConfigured',
        message:
          'Set CRON_SECRET (Vercel) or WEEKLY_DRILL_DIGEST_CRON_SECRET (local)',
      },
      { status: 503 },
    );
  }

  if (!authorizeCron(req, ROUTE_SECRET_ENV)) {
    return NextResponse.json(
      { code: 'Unauthorized', message: 'Invalid cron secret' },
      { status: 401 },
    );
  }

  await connectToDatabase();
  const verbose = shouldCronDebug(req);
  const learnerId = verbose
    ? req.nextUrl.searchParams.get('learnerId') ?? undefined
    : undefined;

  const svc = new WeeklyDrillDigestService();
  const result = await svc.runWeeklyDigest(new Date(), {
    debug: verbose,
    learnerId,
  });

  return NextResponse.json({
    code: 'Success',
    data: sanitizeCronResult(result, verbose),
  });
}
