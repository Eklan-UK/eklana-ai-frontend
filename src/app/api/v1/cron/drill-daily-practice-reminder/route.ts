// GET /api/v1/cron/drill-daily-practice-reminder — daily 18:00 UTC practice blast
// Auth: CRON_SECRET (Vercel) or DRILL_REMINDER_CRON_SECRET (local)
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/api/db';
import { DrillReminderService } from '@/domain/drills/drill-reminder.service';
import {
  authorizeCron,
  isCronConfigured,
  sanitizeCronResult,
  shouldCronDebug,
} from '@/lib/api/cron-auth';
import '@/models/user';
import '@/models/drill-assignment';
import '@/models/profile';
import '@/models/user-streak';
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
  const svc = new DrillReminderService();
  const result = await svc.runDailyReminders();

  return NextResponse.json({
    code: 'Success',
    data: sanitizeCronResult(result, verbose),
  });
}
