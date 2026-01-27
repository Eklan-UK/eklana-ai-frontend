/**
 * Push Token Registration API
 * POST - Register a push token for the current user
 * DELETE - Unregister a push token
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { registerPushToken, unregisterPushToken } from '@/services/notification';
import { z } from 'zod';

const registerSchema = z.object({
  platform: z.enum(['expo', 'web', 'fcm']),
  token: z.string().min(1, 'Token is required'),
  deviceInfo: z.object({
    deviceName: z.string().optional(),
    osVersion: z.string().optional(),
    appVersion: z.string().optional(),
    browser: z.string().optional(),
  }).optional(),
});

// POST - Register push token
async function postHandler(
  req: NextRequest,
  context: { userId: any }
) {
  try {
    const body = await req.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { platform, token, deviceInfo } = validation.data;

    const result = await registerPushToken(
      context.userId.toString(),
      platform,
      token,
      deviceInfo
    );

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to register push token' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tokenId: result.tokenId,
    });
  } catch (error) {
    console.error('Failed to register push token:', error);
    return NextResponse.json(
      { error: 'Failed to register push token' },
      { status: 500 }
    );
  }
}

// DELETE - Unregister push token
async function deleteHandler(
  req: NextRequest,
  context: { userId: any }
) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const success = await unregisterPushToken(token);

    return NextResponse.json({ success });
  } catch (error) {
    console.error('Failed to unregister push token:', error);
    return NextResponse.json(
      { error: 'Failed to unregister push token' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler);
export const DELETE = withAuth(deleteHandler);

