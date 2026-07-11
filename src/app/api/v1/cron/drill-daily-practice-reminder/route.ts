// GET /api/v1/cron/drill-daily-practice-reminder — hourly local 6 PM practice nudge
// Auth: CRON_SECRET (Vercel) or DRILL_REMINDER_CRON_SECRET (local)
// Debug (CRON_DEBUG=true): ?debug=1&learnerId=<id>&timezone=<IANA> for single-learner tests
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/api/db';
import { DrillReminderService } from '@/domain/drills/drill-reminder.service';
import {
  authorizeCron,
  isCronConfigured,
  sanitizeCronResult,
  shouldCronDebug,
} from '@/lib/api/cron-auth';
import { validateTimezone } from '@/lib/timezone/validate-timezone';
import '@/models/user';
import '@/models/drill-assignment';
import '@/models/drill-attempt';
import '@/models/profile';
import '@/models/daily-practice-reminder-dispatch';
import '@/models/push-token.model';
import '@/models/notification.model';

const ROUTE_SECRET_ENV = 'DRILL_REMINDER_CRON_SECRET';

export async function GET(req: NextRequest) {
  if (!isCronConfigured(ROUTE_SECRET_ENV)) {
    return NextResponse.json(
      {
        code: 'NotConfigured',
        message: 'Set CRON_SECRET (Vercel) or DRILL_REMINDER_CRON_SECRET (local)',
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
  const timezoneParam = verbose
    ? req.nextUrl.searchParams.get('timezone') ?? undefined
    : undefined;

  if (timezoneParam && !validateTimezone(timezoneParam)) {
    return NextResponse.json(
      { code: 'ValidationError', message: 'Invalid IANA timezone' },
      { status: 400 },
    );
  }

  const svc = new DrillReminderService();
  const result = await svc.runDailyReminders(new Date(), {
    debug: verbose,
    learnerId,
    timezoneOverride: timezoneParam,
  });

  return NextResponse.json({
    code: 'Success',
    data: sanitizeCronResult(result, verbose),
  });
}
