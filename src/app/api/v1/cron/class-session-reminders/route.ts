// GET /api/v1/cron/class-session-reminders — class reminders (FCM + email)
// Auth: CRON_SECRET (Vercel) or CLASS_REMINDER_CRON_SECRET (local)
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/api/db';
import { ClassReminderService } from '@/domain/classes/class-reminder.service';
import {
  authorizeCron,
  isCronConfigured,
  sanitizeCronResult,
  shouldCronDebug,
} from '@/lib/api/cron-auth';
import '@/models/class-session';
import '@/models/session-reminder-dispatch';

const ROUTE_SECRET_ENV = 'CLASS_REMINDER_CRON_SECRET';

export async function GET(req: NextRequest) {
  if (!isCronConfigured(ROUTE_SECRET_ENV)) {
    return NextResponse.json(
      {
        code: 'NotConfigured',
        message: 'Set CRON_SECRET (Vercel) or CLASS_REMINDER_CRON_SECRET (local)',
      },
      { status: 503 },
    );
  }

  if (!authorizeCron(req, ROUTE_SECRET_ENV)) {
    return NextResponse.json({ code: 'Unauthorized', message: 'Invalid cron secret' }, { status: 401 });
  }

  await connectToDatabase();
  const verbose = shouldCronDebug(req);
  const svc = new ClassReminderService();
  const result = await svc.runDueReminders(new Date(), { debug: verbose });

  return NextResponse.json({
    code: 'Success',
    data: sanitizeCronResult(result, verbose),
  });
}
