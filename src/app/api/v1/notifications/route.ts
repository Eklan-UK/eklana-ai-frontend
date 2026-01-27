/**
 * Notifications API
 * GET - List notifications for the current user
 * POST - Create a notification (admin/system only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withRole } from '@/lib/api/middleware';
import { getNotifications, sendNotification } from '@/services/notification';
import { z } from 'zod';

// GET - List notifications
async function getHandler(
  req: NextRequest,
  context: { userId: any }
) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const { notifications, unreadCount } = await getNotifications(
      context.userId.toString(),
      { limit, skip, unreadOnly }
    );

    return NextResponse.json({
      notifications,
      unreadCount,
      pagination: {
        limit,
        skip,
        hasMore: notifications.length === limit,
      },
    });
  } catch (error) {
    console.error('Failed to get notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// POST - Create notification (admin only)
const createNotificationSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  type: z.enum([
    'drill_assigned',
    'drill_reminder',
    'drill_reviewed',
    'drill_completed',
    'daily_focus',
    'achievement',
    'message',
    'tutor_update',
    'system',
  ]),
  data: z.object({
    screen: z.string().optional(),
    resourceId: z.string().optional(),
    resourceType: z.string().optional(),
    url: z.string().optional(),
  }).optional(),
});

async function postHandler(
  req: NextRequest,
  context: { userId: any; userRole: string }
) {
  try {
    const body = await req.json();
    const validation = createNotificationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { userId, title, body: notificationBody, type, data } = validation.data;

    const result = await sendNotification({
      userId,
      title,
      body: notificationBody,
      type,
      data,
    });

    return NextResponse.json({
      success: true,
      notificationId: result.notificationId,
      delivery: {
        expo: result.expo,
        web: result.web,
        total: {
          sent: result.totalSent,
          failed: result.totalFailed,
        },
      },
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const POST = withRole(['admin'], postHandler);

