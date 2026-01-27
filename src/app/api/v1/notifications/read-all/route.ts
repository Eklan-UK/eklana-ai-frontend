/**
 * Mark All Notifications as Read
 * POST - Mark all notifications as read for the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { markAllAsRead } from '@/services/notification';

async function handler(
  req: NextRequest,
  context: { userId: any }
) {
  try {
    const count = await markAllAsRead(context.userId.toString());

    return NextResponse.json({
      success: true,
      markedCount: count,
    });
  } catch (error) {
    console.error('Failed to mark all as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);

