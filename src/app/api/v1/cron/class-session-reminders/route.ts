// GET /api/v1/cron/class-session-reminders — Phase 7 class reminders (T−60m / T−10m FCM)
// Secure with CLASS_REMINDER_CRON_SECRET: Authorization: Bearer <secret> or x-cron-secret
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/api/db';
import { ClassReminderService } from '@/domain/classes/class-reminder.service';
import '@/models/class-session';
import '@/models/session-reminder-dispatch';

function authorize(req: NextRequest): boolean {
  const secret = process.env.CLASS_REMINDER_CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const header = req.headers.get('x-cron-secret');
  return bearer === secret || header === secret;
}

export async function GET(req: NextRequest) {
  if (!process.env.CLASS_REMINDER_CRON_SECRET) {
    return NextResponse.json(
      {
        code: 'NotConfigured',
        message: 'CLASS_REMINDER_CRON_SECRET is not set',
      },
      { status: 503 },
    );
  }

  if (!authorize(req)) {
    return NextResponse.json({ code: 'Unauthorized', message: 'Invalid cron secret' }, { status: 401 });
  }

  await connectToDatabase();
  const svc = new ClassReminderService();
  const result = await svc.runDueReminders();

  return NextResponse.json({
    code: 'Success',
    data: result,
  });
}
