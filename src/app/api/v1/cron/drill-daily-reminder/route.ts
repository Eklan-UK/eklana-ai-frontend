// GET /api/v1/cron/drill-daily-reminder — Daily practice nudge for every learner
// Secure with DRILL_REMINDER_CRON_SECRET: Authorization: Bearer <secret> or x-cron-secret
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/api/db';
import { DrillReminderService } from '@/domain/drills/drill-reminder.service';
import '@/models/fcm-token';
import '@/models/drill-assignment';
import '@/models/profile';

function authorize(req: NextRequest): boolean {
  const secret = process.env.DRILL_REMINDER_CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const header = req.headers.get('x-cron-secret');
  return bearer === secret || header === secret;
}

export async function GET(req: NextRequest) {
  if (!process.env.DRILL_REMINDER_CRON_SECRET) {
    return NextResponse.json(
      {
        code: 'NotConfigured',
        message: 'DRILL_REMINDER_CRON_SECRET is not set',
      },
      { status: 503 },
    );
  }

  if (!authorize(req)) {
    return NextResponse.json(
      { code: 'Unauthorized', message: 'Invalid cron secret' },
      { status: 401 },
    );
  }

  await connectToDatabase();
  const svc = new DrillReminderService();
  const result = await svc.runDailyReminders();

  return NextResponse.json({ code: 'Success', data: result });
}
