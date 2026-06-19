// GET /api/v1/cron/class-session-nps — post-session NPS form emails
// Secure with CLASS_NPS_CRON_SECRET: Authorization: Bearer <secret> or x-cron-secret
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/api/db';
import { ClassNpsService } from '@/domain/classes/class-nps.service';
import '@/models/class-session';
import '@/models/session-nps-dispatch';
import '@/models/nps-form';

function authorize(req: NextRequest): boolean {
  const secret = process.env.CLASS_NPS_CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const header = req.headers.get('x-cron-secret');
  return bearer === secret || header === secret;
}

export async function GET(req: NextRequest) {
  if (!process.env.CLASS_NPS_CRON_SECRET) {
    return NextResponse.json(
      {
        code: 'NotConfigured',
        message: 'CLASS_NPS_CRON_SECRET is not set',
      },
      { status: 503 },
    );
  }

  if (!authorize(req)) {
    return NextResponse.json({ code: 'Unauthorized', message: 'Invalid cron secret' }, { status: 401 });
  }

  await connectToDatabase();
  const svc = new ClassNpsService();
  const result = await svc.runDueNpsEmails();

  return NextResponse.json({
    code: 'Success',
    data: result,
  });
}
