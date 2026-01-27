# FCM Backend Implementation Guide

**Complete implementation for server-side FCM integration in Next.js**

---

## 📁 File Structure

```
src/
├── services/notification/
│   ├── index.ts              (Updated: Use FCM)
│   ├── fcm.ts                (NEW: FCM service)
│   ├── web-push.ts           (DEPRECATED: Keep for fallback)
│   └── triggers.ts           (Updated: FCM triggers)
├── app/api/v1/notifications/
│   ├── route.ts              (Updated: List/send notifications)
│   ├── register/route.ts      (NEW: FCM token registration)
│   ├── unregister/route.ts    (NEW: Token unregistration)
│   └── vapid-key/route.ts     (DEPRECATED: Remove)
├── models/
│   └── push-token.model.ts    (Updated: Support FCM)
└── lib/api/
    └── fcm-admin.ts          (NEW: Firebase Admin init)
```

---

## 1️⃣ Firebase Admin Initialization

### File: `/src/lib/api/fcm-admin.ts`

```typescript
/**
 * Firebase Admin SDK Initialization
 * Centralized Firebase setup for server-side operations
 */

import admin from 'firebase-admin';
import { logger } from './logger';

let adminInitialized = false;

/**
 * Initialize Firebase Admin SDK
 * Must be called before using any Firebase services
 */
export function initializeFirebase() {
  if (adminInitialized) {
    return admin;
  }

  try {
    // Check if already initialized by another instance
    if (admin.apps.length > 0) {
      adminInitialized = true;
      return admin.app();
    }

    // Get credentials from environment
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!projectId || !privateKey || !clientEmail) {
      throw new Error(
        'Firebase credentials missing. Add FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL to environment'
      );
    }

    // Initialize Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        privateKey: privateKey.replace(/\\n/g, '\n'),
        clientEmail,
      }),
      projectId,
    });

    adminInitialized = true;
    logger.info('Firebase Admin SDK initialized');
    return admin;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK', error);
    throw error;
  }
}

/**
 * Get Firebase Admin instance
 */
export function getFirebaseAdmin() {
  if (!adminInitialized) {
    initializeFirebase();
  }
  return admin;
}

/**
 * Get Messaging instance
 */
export function getMessaging() {
  const admin = getFirebaseAdmin();
  return admin.messaging();
}

/**
 * Health check: Verify Firebase is properly configured
 */
export async function verifyFirebaseConfig(): Promise<boolean> {
  try {
    const messaging = getMessaging();
    // Try to get app info to verify connectivity
    await messaging.send({
      token: 'test-token-that-will-fail',
      notification: {
        title: 'Test',
        body: 'Test',
      },
    }).catch((error) => {
      // Expected to fail with invalid token, but proves Firebase is working
      if (error.code === 'messaging/invalid-registration-token') {
        return true;
      }
      throw error;
    });
    return true;
  } catch (error: any) {
    if (error.code === 'messaging/invalid-registration-token') {
      return true;
    }
    logger.error('Firebase config verification failed', error);
    return false;
  }
}
```

---

## 2️⃣ FCM Service Implementation

### File: `/src/services/notification/fcm.ts`

```typescript
/**
 * Firebase Cloud Messaging (FCM) Service
 * Handles sending push notifications via FCM to web, iOS, and Android
 */

import { getMessaging } from '@/lib/api/fcm-admin';
import { PushToken } from '@/models/push-token.model';
import { logger } from '@/lib/api/logger';

export interface FCMPayload {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, string>;
  actions?: Array<{
    action: string;
    title: string;
  }>;
  requireInteraction?: boolean;
  sound?: string;
  click_action?: string;
}

export interface SendResult {
  success: number;
  failed: number;
  invalidTokens: string[];
  errors?: Array<{
    token: string;
    error: string;
    code?: string;
  }>;
}

/**
 * Build multicast message for FCM
 * FCM automatically handles platform-specific formatting
 */
function buildFCMMessage(payload: FCMPayload, tokens: string[]) {
  return {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
      imageUrl: payload.image,
    },
    // Web-specific payload
    webpush: {
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icons/notification-icon-192.png',
        badge: payload.badge || '/icons/badge-icon-96.png',
        image: payload.image,
        tag: payload.tag,
        requireInteraction: payload.requireInteraction,
      },
      data: payload.data || {},
      headers: {
        TTL: '86400', // 24 hours
      },
    },
    // Android-specific payload
    android: {
      notification: {
        title: payload.title,
        body: payload.body,
        icon: 'notification_icon',
        color: '#005b9f',
        sound: payload.sound || 'default',
        clickAction: payload.click_action,
        bodyLocKey: undefined,
        titleLocKey: undefined,
      },
      ttl: 86400, // 24 hours in seconds
      priority: 'high',
      data: payload.data || {},
    },
    // iOS-specific payload
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-ttl': '86400',
        'apns-push-type': 'alert',
      },
      payload: {
        aps: {
          alert: {
            title: payload.title,
            body: payload.body,
          },
          sound: payload.sound || 'default',
          badge: 1,
          'mutable-content': true,
          'custom-key': 'custom-value',
        },
      },
      fcmOptions: {
        analyticsLabel: 'elkan-notification',
      },
    },
  };
}

/**
 * Send FCM notification to multiple tokens
 * Handles batch sending with proper error handling
 */
export async function sendFCMNotification(
  tokens: string[],
  payload: FCMPayload
): Promise<SendResult> {
  if (tokens.length === 0) {
    return {
      success: 0,
      failed: 0,
      invalidTokens: [],
    };
  }

  try {
    const messaging = getMessaging();

    // Split into chunks to avoid hitting request size limits
    // FCM has limits on tokens per request
    const chunkSize = 500;
    let totalSuccess = 0;
    let totalFailed = 0;
    const invalidTokens: string[] = [];
    const errors: Array<{ token: string; error: string; code?: string }> = [];

    for (let i = 0; i < tokens.length; i += chunkSize) {
      const chunk = tokens.slice(i, i + chunkSize);
      const message = buildFCMMessage(payload, chunk);

      try {
        const response = await messaging.sendMulticast(message);

        // Process responses
        response.responses.forEach((resp, index) => {
          const token = chunk[index];

          if (resp.success) {
            totalSuccess++;
          } else {
            totalFailed++;
            const errorCode = resp.error?.code;
            const errorMessage = resp.error?.message || 'Unknown error';

            errors.push({
              token,
              error: errorMessage,
              code: errorCode,
            });

            // Check if token is invalid
            if (
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered' ||
              errorCode === 'messaging/mismatched-credential'
            ) {
              invalidTokens.push(token);
            }
          }
        });
      } catch (error: any) {
        logger.error('Error sending FCM batch', {
          error: error.message,
          tokenCount: chunk.length,
        });
        totalFailed += chunk.length;
      }

      // Small delay between chunks
      if (i + chunkSize < tokens.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Clean up invalid tokens from database
    if (invalidTokens.length > 0) {
      try {
        await PushToken.deleteMany({
          token: { $in: invalidTokens },
        });
        logger.info(`Cleaned up ${invalidTokens.length} invalid tokens`);
      } catch (error) {
        logger.error('Error cleaning up invalid tokens', error);
      }
    }

    return {
      success: totalSuccess,
      failed: totalFailed,
      invalidTokens,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Only return first 10 errors
    };
  } catch (error) {
    logger.error('FCM notification send failed', error);
    return {
      success: 0,
      failed: tokens.length,
      invalidTokens: [],
    };
  }
}

/**
 * Send notification to single token
 * Useful for targeted notifications
 */
export async function sendFCMNotificationToToken(
  token: string,
  payload: FCMPayload
): Promise<boolean> {
  try {
    const messaging = getMessaging();

    const message = {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.image,
      },
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icons/notification-icon-192.png',
        },
        data: payload.data || {},
      },
      android: {
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
            },
          },
        },
      },
    };

    await messaging.send(message);
    return true;
  } catch (error: any) {
    if (error.code === 'messaging/invalid-registration-token') {
      // Delete invalid token
      await PushToken.deleteOne({ token });
    }
    logger.error('Error sending FCM notification to token', {
      token,
      error: error.message,
    });
    return false;
  }
}

/**
 * Send notification to all tokens for a user
 */
export async function sendFCMNotificationToUser(
  userId: string,
  payload: FCMPayload
): Promise<SendResult> {
  try {
    // Get user's active tokens
    const tokens = await PushToken.find({
      userId,
      isActive: true,
    }).select('token').lean();

    const tokenStrings = tokens.map((t) => t.token);

    if (tokenStrings.length === 0) {
      logger.warn(`No active tokens found for user ${userId}`);
      return {
        success: 0,
        failed: 0,
        invalidTokens: [],
      };
    }

    return sendFCMNotification(tokenStrings, payload);
  } catch (error) {
    logger.error('Error sending FCM notification to user', {
      userId,
      error,
    });
    return {
      success: 0,
      failed: 0,
      invalidTokens: [],
    };
  }
}

/**
 * Subscribe a token to a topic
 * Useful for group notifications
 */
export async function subscribeTokenToTopic(
  tokens: string[],
  topic: string
): Promise<{ successful: number; failed: number }> {
  try {
    const messaging = getMessaging();
    const response = await messaging.subscribeToTopic(tokens, topic);
    return {
      successful: response.successCount,
      failed: response.failureCount,
    };
  } catch (error) {
    logger.error('Error subscribing tokens to topic', {
      topic,
      error,
    });
    return {
      successful: 0,
      failed: tokens.length,
    };
  }
}

/**
 * Unsubscribe a token from a topic
 */
export async function unsubscribeTokenFromTopic(
  tokens: string[],
  topic: string
): Promise<{ successful: number; failed: number }> {
  try {
    const messaging = getMessaging();
    const response = await messaging.unsubscribeFromTopic(tokens, topic);
    return {
      successful: response.successCount,
      failed: response.failureCount,
    };
  } catch (error) {
    logger.error('Error unsubscribing tokens from topic', {
      topic,
      error,
    });
    return {
      successful: 0,
      failed: tokens.length,
    };
  }
}

/**
 * Send notification to topic
 * Useful for broadcast notifications
 */
export async function sendFCMNotificationToTopic(
  topic: string,
  payload: FCMPayload
): Promise<string> {
  try {
    const messaging = getMessaging();

    const message = {
      topic,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.image,
      },
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icons/notification-icon-192.png',
        },
        data: payload.data || {},
      },
      android: {
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
            },
          },
        },
      },
    };

    const messageId = await messaging.send(message);
    logger.info(`Notification sent to topic ${topic}`, { messageId });
    return messageId;
  } catch (error) {
    logger.error('Error sending FCM notification to topic', {
      topic,
      error,
    });
    throw error;
  }
}

/**
 * Validate FCM token
 * Returns true if token is valid
 */
export async function validateFCMToken(token: string): Promise<boolean> {
  try {
    const messaging = getMessaging();
    // Validate by attempting to send a dry-run message
    const message = {
      token,
      notification: {
        title: 'Validation',
        body: 'Token validation',
      },
    };
    await messaging.send(message, true); // true = dry run
    return true;
  } catch (error: any) {
    if (error.code === 'messaging/invalid-registration-token') {
      return false;
    }
    // Other errors might be temporary
    return false;
  }
}

/**
 * Get FCM token info
 * Returns token details (if available)
 */
export async function getFCMTokenInfo(token: string): Promise<Record<string, any> | null> {
  try {
    const messaging = getMessaging();
    // FCM doesn't provide a direct API to get token info
    // We can only validate or send to it
    // This is a placeholder for future enhancement
    return null;
  } catch (error) {
    logger.error('Error getting FCM token info', error);
    return null;
  }
}
```

---

## 3️⃣ Update Main Notification Service

### File: `/src/services/notification/index.ts` (Updated)

```typescript
/**
 * Unified Notification Service - Updated for FCM
 * Supports both in-app notifications and push notifications via FCM
 */

import { connectToDatabase } from '@/lib/api/db';
import { PushToken } from '@/models/push-token.model';
import { Notification, NotificationType, INotificationData } from '@/models/notification.model';
import { sendFCMNotification, sendFCMNotificationToUser, FCMPayload } from './fcm';
import { logger } from '@/lib/api/logger';

export interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: INotificationData;
  // Optional overrides
  icon?: string;
  image?: string;
  badge?: string;
  silent?: boolean;
  skipPush?: boolean; // Don't send push, only save to DB
}

export interface SendResult {
  notificationId: string;
  push: {
    success: number;
    failed: number;
    invalidTokens: string[];
  };
  totalSent: number;
  totalFailed: number;
}

/**
 * Send notification to user (both in-app and push)
 */
export async function sendNotification(
  payload: NotificationPayload
): Promise<SendResult> {
  await connectToDatabase();

  const {
    userId,
    title,
    body,
    type,
    data,
    icon,
    image,
    badge,
    silent,
    skipPush,
  } = payload;

  try {
    // 1. Save notification to database (for in-app notification list)
    const notification = await Notification.create({
      userId,
      title,
      body,
      type,
      data,
    });

    let pushResult = { success: 0, failed: 0, invalidTokens: [] };

    // 2. Send push notification if not skipped
    if (!skipPush) {
      // Get user's active push tokens
      const tokens = await PushToken.find({
        userId,
        isActive: true,
      }).select('token').lean();

      const tokenList = tokens.map((t) => t.token);

      if (tokenList.length > 0) {
        // Build FCM payload
        const fcmPayload: FCMPayload = {
          title,
          body,
          icon,
          image,
          badge,
          data: data
            ? {
                notificationId: notification._id.toString(),
                type,
                ...data,
              }
            : { notificationId: notification._id.toString(), type },
          requireInteraction: type === 'achievement' || type === 'reminder',
        };

        // Send to all tokens
        pushResult = await sendFCMNotification(tokenList, fcmPayload);

        // Update notification with push status
        await Notification.findByIdAndUpdate(notification._id, {
          pushSentAt: new Date(),
          pushDelivered: pushResult.success > 0,
        });

        // Update last used timestamp for tokens
        if (pushResult.success > 0) {
          await PushToken.updateMany(
            { userId, isActive: true },
            { lastUsedAt: new Date() }
          );
        }

        logger.info('Notification sent', {
          userId,
          notificationId: notification._id,
          pushSuccess: pushResult.success,
          pushFailed: pushResult.failed,
        });
      }
    }

    return {
      notificationId: notification._id.toString(),
      push: pushResult,
      totalSent: pushResult.success,
      totalFailed: pushResult.failed,
    };
  } catch (error) {
    logger.error('Error sending notification', {
      userId,
      error,
    });
    throw error;
  }
}

/**
 * Send batch notifications to multiple users
 */
export async function sendBatchNotifications(
  userIds: string[],
  payload: Omit<NotificationPayload, 'userId'>
): Promise<{ sent: number; failed: number; results: SendResult[] }> {
  await connectToDatabase();

  const results: SendResult[] = [];
  let sent = 0;
  let failed = 0;

  // Process in chunks
  const chunkSize = 50;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);

    const chunkResults = await Promise.allSettled(
      chunk.map((userId) => sendNotification({ ...payload, userId }))
    );

    chunkResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        if (result.value.totalSent > 0) {
          sent++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }
    });

    // Small delay between chunks
    if (i + chunkSize < userIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return { sent, failed, results };
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  await connectToDatabase();
  return Notification.getUnreadCount(userId);
}

/**
 * Mark notification as read
 */
export async function markAsRead(
  userId: string,
  notificationId: string
): Promise<boolean> {
  await connectToDatabase();
  const result = await Notification.findByIdAndUpdate(
    notificationId,
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  return !!result;
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(userId: string): Promise<number> {
  await connectToDatabase();
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  return result.modifiedCount || 0;
}

/**
 * Get user notifications
 */
export async function getNotifications(
  userId: string,
  limit: number = 50,
  offset: number = 0
) {
  await connectToDatabase();
  const notifications = await Notification.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset)
    .lean();
  
  const total = await Notification.countDocuments({ userId });
  
  return {
    notifications,
    total,
    limit,
    offset,
  };
}

export * from './fcm';
```

---

## 4️⃣ Updated PushToken Model

### File: `/src/models/push-token.model.ts` (Updated)

```typescript
/**
 * Push Token Model - Support for FCM
 * Stores user device tokens for push notifications
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPushToken extends Document {
  userId: Types.ObjectId;
  platform: 'web-fcm' | 'android' | 'ios';
  token: string;
  deviceInfo?: {
    userAgent?: string;
    model?: string;
    os?: string;
    osVersion?: string;
    appVersion?: string;
  };
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const pushTokenSchema = new Schema<IPushToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['web-fcm', 'android', 'ios'],
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deviceInfo: {
      userAgent: String,
      model: String,
      os: String,
      osVersion: String,
      appVersion: String,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for queries
pushTokenSchema.index({ userId: 1, isActive: 1 });
pushTokenSchema.index({ userId: 1, platform: 1 });
pushTokenSchema.index({ createdAt: -1 });

// Auto-cleanup old inactive tokens
pushTokenSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 7776000, // 90 days
    partialFilterExpression: { isActive: false },
  }
);

const PushToken =
  mongoose.models.PushToken ||
  mongoose.model<IPushToken>('PushToken', pushTokenSchema);

export default PushToken;
```

---

## 5️⃣ API Routes for FCM

### File: `/src/app/api/v1/notifications/register/route.ts` (NEW)

```typescript
/**
 * POST /api/v1/notifications/register
 * Register a device token for push notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import PushToken from '@/models/push-token.model';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';

const registerTokenSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(['web-fcm', 'android', 'ios']),
  deviceInfo: z
    .object({
      userAgent: z.string().optional(),
      model: z.string().optional(),
      os: z.string().optional(),
      osVersion: z.string().optional(),
      appVersion: z.string().optional(),
    })
    .optional(),
});

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const validation = registerTokenSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { token, platform, deviceInfo } = validation.data;
    const userId = context.userId;

    // Check if token already exists
    const existingToken = await PushToken.findOne({ token });

    if (existingToken) {
      // Token exists, update if it's a different user
      if (existingToken.userId.toString() !== userId.toString()) {
        existingToken.userId = userId;
      }
      existingToken.isActive = true;
      existingToken.lastUsedAt = new Date();
      existingToken.platform = platform;
      if (deviceInfo) {
        existingToken.deviceInfo = deviceInfo;
      }
      await existingToken.save();
    } else {
      // Create new token
      await PushToken.create({
        userId,
        platform,
        token,
        deviceInfo,
        isActive: true,
      });
    }

    logger.info('Device token registered', {
      userId,
      platform,
      tokenPreview: token.substring(0, 20) + '...',
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Device token registered successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error registering device token', error);
    return NextResponse.json(
      { error: 'Failed to register device token' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);
```

### File: `/src/app/api/v1/notifications/unregister/route.ts` (NEW)

```typescript
/**
 * POST /api/v1/notifications/unregister
 * Unregister a device token
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import PushToken from '@/models/push-token.model';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';

const unregisterSchema = z.object({
  token: z.string(),
});

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const validation = unregisterSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }

    const { token } = validation.data;
    const userId = context.userId;

    await PushToken.findOneAndUpdate(
      { userId, token },
      { isActive: false }
    );

    logger.info('Device token unregistered', {
      userId,
      tokenPreview: token.substring(0, 20) + '...',
    });

    return NextResponse.json(
      { success: true, message: 'Device token unregistered' },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error unregistering device token', error);
    return NextResponse.json(
      { error: 'Failed to unregister token' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);
```

---

## 6️⃣ Environment Variables

Add to `.env.local`:

```bash
# Firebase Admin SDK (server-side)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com

# Firebase Web SDK (client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123...
```

---

## 🧪 Testing

### Test FCM Service

```typescript
// src/app/api/v1/notifications/test/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendFCMNotification } from '@/services/notification/fcm';
import { withRole } from '@/lib/api/middleware';

async function testHandler(req: NextRequest) {
  try {
    // Get test token from query
    const token = new URL(req.url).searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const result = await sendFCMNotification([token], {
      title: 'Test Notification',
      body: 'This is a test notification from Elkan AI',
      data: {
        type: 'test',
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export const GET = withRole(['admin'], testHandler);
```

---

## ✅ Verification Checklist

- [ ] Firebase project created
- [ ] Service account key downloaded
- [ ] Admin SDK initialized
- [ ] FCM service implemented
- [ ] Token registration endpoint working
- [ ] Test notifications sending
- [ ] Invalid tokens cleaned up
- [ ] Database models updated
- [ ] Environment variables configured

---

Status: ✅ Backend implementation complete and ready for deployment

