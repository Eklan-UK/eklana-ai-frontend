/**
 * Shared unified push + legacy FCM fallback delivery.
 * Always creates an in-app Notification record via sendNotification().
 */

import { connectToDatabase } from '@/lib/api/db';
import FCMToken from '@/models/fcm-token';
import { PushToken } from '@/models/push-token.model';
import {
  sendNotificationToUsers,
  NotificationType as FcmNotificationType,
} from '@/lib/fcm-trigger';
import {
  sendNotification,
  type SendResult,
} from '@/services/notification';
import type {
  NotificationType,
  INotificationData,
} from '@/models/notification.model';

type FcmAnalytics = Awaited<ReturnType<typeof sendNotificationToUsers>>;

export interface UnifiedDeliveryResult {
  /** True when push succeeded or an in-app notification was created. */
  delivered: boolean;
  /** True when Expo, VAPID web, or legacy FCM reported at least one success. */
  pushDelivered: boolean;
  inAppCreated: boolean;
  unified: SendResult;
  fcm: FcmAnalytics | null;
}

export interface UnifiedDeliveryParams {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: INotificationData;
  fcmType: FcmNotificationType;
  /** Extra FCM data fields (merged over stringified `data`). */
  fcmData?: Record<string, string>;
  actionUrl?: string;
}

function buildFcmDataPayload(
  data?: INotificationData,
  fcmData?: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (data) {
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        out[key] = String(value);
      }
    }
  }
  if (fcmData) {
    Object.assign(out, fcmData);
  }
  return out;
}

function isPushDelivered(unified: SendResult, fcm: FcmAnalytics | null): boolean {
  if (unified.totalSent > 0) return true;
  return (fcm?.successCount ?? 0) > 0;
}

function isDeliverySuccessful(
  unified: SendResult,
  fcm: FcmAnalytics | null,
): boolean {
  if (isPushDelivered(unified, fcm)) return true;
  // sendNotification always persists an in-app record
  return Boolean(unified.notificationId);
}

/**
 * Waterfall delivery — no duplicates on web:
 *   1. Always fire unified path (in-app + Expo + modern Web Push).
 *   2. Legacy FCM only when user has no active modern web push token.
 */
export async function sendUnifiedWithFcmFallback(
  params: UnifiedDeliveryParams,
): Promise<UnifiedDeliveryResult> {
  await connectToDatabase();

  const { userId, title, body, type, data, fcmType, fcmData, actionUrl } = params;

  const unified = await sendNotification({
    userId,
    title,
    body,
    type,
    data,
  });

  const hasModernWebToken = await PushToken.exists({
    userId,
    platform: 'web',
    isActive: true,
  });

  let fcm: FcmAnalytics | null = null;
  if (!hasModernWebToken) {
    const fcmTokens = await FCMToken.find({
      userId,
      isActive: true,
    })
      .select('token')
      .lean()
      .exec();

    if (fcmTokens.length > 0) {
      fcm = await sendNotificationToUsers(
        [userId],
        fcmTokens.map((t) => t.token),
        {
          title,
          body,
          type: fcmType,
          actionUrl,
          data: buildFcmDataPayload(data, fcmData),
        },
      );
    }
  }

  const inAppCreated = Boolean(unified.notificationId);
  const pushDelivered = isPushDelivered(unified, fcm);
  const delivered = isDeliverySuccessful(unified, fcm);

  return { delivered, pushDelivered, inAppCreated, unified, fcm };
}
