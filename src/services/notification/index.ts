/**
 * Unified Notification Service
 * Central service for handling all notifications across platforms
 */

import { connectToDatabase } from '@/lib/api/db';
import { PushToken } from '@/models/push-token.model';
import { Notification, NotificationType, INotificationData } from '@/models/notification.model';
import { sendExpoPush } from './expo-push';
import { sendWebPush, WebPushPayload } from './web-push';

export interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: INotificationData;
  // Optional overrides
  webOnly?: boolean;
  mobileOnly?: boolean;
  silent?: boolean;
}

export interface SendResult {
  notificationId: string;
  expo: { success: number; failed: number };
  web: { success: number; failed: number };
  totalSent: number;
  totalFailed: number;
}

/**
 * Send a notification to a user across all their registered devices
 */
export async function sendNotification(
  payload: NotificationPayload
): Promise<SendResult> {
  await connectToDatabase();
  
  const { userId, title, body, type, data, webOnly, mobileOnly, silent } = payload;

  // 1. Save notification to database (for in-app notification list)
  const notification = await Notification.create({
    userId,
    title,
    body,
    type,
    data,
  });

  // 2. Get user's active push tokens
  const tokens = await PushToken.find({
    userId,
    isActive: true,
  }).lean();

  // 3. Separate tokens by platform
  const expoTokens = mobileOnly || !webOnly 
    ? tokens.filter(t => t.platform === 'expo')
    : [];
  const webTokens = webOnly || !mobileOnly
    ? tokens.filter(t => t.platform === 'web')
    : [];

  // 4. Send to each platform in parallel
  const [expoResult, webResult] = await Promise.all([
    // Expo Push (mobile)
    sendExpoPush(
      expoTokens.map(t => ({ _id: t._id.toString(), token: t.token })),
      { title, body, data }
    ),
    // Web Push (browser)
    sendWebPush(
      webTokens.map(t => ({ _id: t._id.toString(), token: t.token })),
      { title, body, data, silent } as WebPushPayload
    ),
  ]);

  // 5. Update notification with push status
  const totalSent = expoResult.success + webResult.success;
  const totalFailed = expoResult.failed + webResult.failed;

  await Notification.findByIdAndUpdate(notification._id, {
    pushSentAt: new Date(),
    pushDelivered: totalSent > 0,
  });

  // 6. Update last used timestamp for successful tokens
  if (totalSent > 0) {
    await PushToken.updateMany(
      { userId, isActive: true },
      { lastUsedAt: new Date() }
    );
  }

  return {
    notificationId: notification._id.toString(),
    expo: { success: expoResult.success, failed: expoResult.failed },
    web: { success: webResult.success, failed: webResult.failed },
    totalSent,
    totalFailed,
  };
}

/**
 * Send notifications to multiple users (batch)
 */
export async function sendBatchNotifications(
  userIds: string[],
  payload: Omit<NotificationPayload, 'userId'>
): Promise<{ sent: number; failed: number }> {
  await connectToDatabase();
  
  let sent = 0;
  let failed = 0;

  // Process in chunks to avoid overwhelming the system
  const chunkSize = 50;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    
    const results = await Promise.allSettled(
      chunk.map(userId => sendNotification({ ...payload, userId }))
    );

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.totalSent > 0) {
        sent++;
      } else {
        failed++;
      }
    });

    // Small delay between chunks to avoid rate limiting
    if (i + chunkSize < userIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return { sent, failed };
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  await connectToDatabase();
  return Notification.getUnreadCount(userId);
}

/**
 * Get notifications for a user
 */
export async function getNotifications(
  userId: string,
  options: { limit?: number; skip?: number; unreadOnly?: boolean } = {}
): Promise<{ notifications: any[]; unreadCount: number }> {
  await connectToDatabase();
  
  const { limit = 20, skip = 0, unreadOnly = false } = options;

  const query: any = { userId };
  if (unreadOnly) {
    query.isRead = false;
  }

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.getUnreadCount(userId),
  ]);

  return { notifications, unreadCount };
}

/**
 * Mark a notification as read
 */
export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  await connectToDatabase();
  const result = await Notification.markAsRead(notificationId, userId);
  return !!result;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<number> {
  await connectToDatabase();
  const result = await Notification.markAllAsRead(userId);
  return result.modifiedCount || 0;
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<boolean> {
  await connectToDatabase();
  const result = await Notification.deleteOne({ _id: notificationId, userId });
  return result.deletedCount > 0;
}

/**
 * Register a push token for a user
 */
export async function registerPushToken(
  userId: string,
  platform: 'expo' | 'web' | 'fcm',
  token: string,
  deviceInfo?: {
    deviceName?: string;
    osVersion?: string;
    appVersion?: string;
    browser?: string;
  }
): Promise<{ success: boolean; tokenId?: string }> {
  await connectToDatabase();
  
  try {
    const pushToken = await PushToken.registerToken(userId, platform, token, deviceInfo);
    return { success: true, tokenId: pushToken._id.toString() };
  } catch (error) {
    console.error('Failed to register push token:', error);
    return { success: false };
  }
}

/**
 * Unregister a push token
 */
export async function unregisterPushToken(token: string): Promise<boolean> {
  await connectToDatabase();
  
  try {
    await PushToken.deactivateToken(token);
    return true;
  } catch (error) {
    console.error('Failed to unregister push token:', error);
    return false;
  }
}

// Re-export types
export type { NotificationType, INotificationData } from '@/models/notification.model';

