/**
 * Single Notification API
 * PATCH - Mark notification as read
 * DELETE - Delete notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { markAsRead, deleteNotification } from '@/services/notification';

// PATCH - Mark as read
async function patchHandler(
  req: NextRequest,
  context: { userId: any }
) {
  try {
    // Get id from URL
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop();
    
    if (!id) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    const success = await markAsRead(id, context.userId.toString());

    if (!success) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}

// DELETE - Delete notification
async function deleteHandler(
  req: NextRequest,
  context: { userId: any }
) {
  try {
    // Get id from URL
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop();
    
    if (!id) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    const success = await deleteNotification(id, context.userId.toString());

    if (!success) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete notification:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}

export const PATCH = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler);

