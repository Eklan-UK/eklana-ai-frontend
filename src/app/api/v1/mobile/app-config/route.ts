/**
 * Mobile Force Update App-Config API
 * GET - Public, unauthenticated app-config for the mobile force-update gate.
 * See MOBILE_FORCE_UPDATE_CONTRACT.md.
 */

import { NextResponse } from 'next/server';
import { getMobileAppConfig } from '@/lib/mobile/app-config';

export async function GET() {
  const response = NextResponse.json(getMobileAppConfig());
  response.headers.set('Cache-Control', 'public, max-age=60');
  return response;
}
