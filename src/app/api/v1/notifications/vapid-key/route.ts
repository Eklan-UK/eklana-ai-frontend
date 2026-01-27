/**
 * VAPID Public Key API
 * GET - Get the public VAPID key for web push subscription
 */

import { NextResponse } from 'next/server';
import { getVapidPublicKey } from '@/services/notification/web-push';

export async function GET() {
  const publicKey = getVapidPublicKey();

  if (!publicKey) {
    return NextResponse.json(
      { error: 'Web Push not configured' },
      { status: 503 }
    );
  }

  return NextResponse.json({ publicKey });
}

