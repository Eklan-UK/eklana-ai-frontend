// GET /api/v1/cron/class-session-nps — post-session NPS form emails
// Auth: CRON_SECRET (Vercel) or CLASS_NPS_CRON_SECRET (local)
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/api/db';
import { ClassNpsService } from '@/domain/classes/class-nps.service';
import {
  authorizeCron,
  isCronConfigured,
  sanitizeCronResult,
  shouldCronDebug,
} from '@/lib/api/cron-auth';
import '@/models/class-session';
import '@/models/session-nps-dispatch';
import '@/models/nps-form';

const ROUTE_SECRET_ENV = 'CLASS_NPS_CRON_SECRET';

export async function GET(req: NextRequest) {
  if (!isCronConfigured(ROUTE_SECRET_ENV)) {
    return NextResponse.json(
      {
        code: 'NotConfigured',
        message: 'Set CRON_SECRET (Vercel) or CLASS_NPS_CRON_SECRET (local)',
      },
      { status: 503 },
    );
  }

  if (!authorizeCron(req, ROUTE_SECRET_ENV)) {
    return NextResponse.json({ code: 'Unauthorized', message: 'Invalid cron secret' }, { status: 401 });
  }

  await connectToDatabase();
  const verbose = shouldCronDebug(req);
  const svc = new ClassNpsService();
  const result = await svc.runDueNpsEmails(new Date(), { debug: verbose });

  return NextResponse.json({
    code: 'Success',
    data: sanitizeCronResult(result, verbose),
  });
}
