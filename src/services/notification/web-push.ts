/**
 * Web Push Notification Service
 * Handles sending push notifications to web browsers
 */

import webpush from 'web-push';
import { PushToken } from '@/models/push-token.model';

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    `mailto:${process.env.SUPPORT_EMAIL || 'support@elkan.com'}`,
    vapidPublicKey,
    vapidPrivateKey
  );
}

export interface WebPushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
}

/**
 * Check if web push is configured
 */
export function isWebPushConfigured(): boolean {
  return !!(vapidPublicKey && vapidPrivateKey);
}

/**
 * Get the public VAPID key for client-side subscription
 */
export function getVapidPublicKey(): string | null {
  return vapidPublicKey || null;
}

/**
 * Send push notifications to web push subscriptions
 */
export async function sendWebPush(
  tokens: Array<{ _id: string; token: string }>,
  payload: WebPushPayload
): Promise<{ success: number; failed: number; invalidTokens: string[] }> {
  if (tokens.length === 0) {
    return { success: 0, failed: 0, invalidTokens: [] };
  }

  if (!isWebPushConfigured()) {
    console.warn('Web Push not configured - missing VAPID keys');
    return { success: 0, failed: tokens.length, invalidTokens: [] };
  }

  const webPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/icons/notification-icon.png',
    badge: payload.badge || '/icons/badge-icon.png',
    data: payload.data,
    actions: payload.actions,
    requireInteraction: payload.requireInteraction,
    silent: payload.silent,
    tag: payload.tag,
  });

  const invalidTokens: string[] = [];
  let success = 0;
  let failed = 0;

  // Send to each subscription in parallel
  const results = await Promise.allSettled(
    tokens.map(async (t) => {
      try {
        // Web push tokens are stored as JSON stringified PushSubscription
        const subscription = JSON.parse(t.token);
        
        await webpush.sendNotification(subscription, webPayload);
        return { success: true, tokenId: t._id };
      } catch (error: any) {
        // Handle specific error codes
        if (error.statusCode === 410 || error.statusCode === 404) {
          // Subscription has expired or is invalid
          return { success: false, tokenId: t._id, invalid: true };
        }
        
        console.error(`Web push error for token ${t._id}:`, error.message);
        return { success: false, tokenId: t._id, invalid: false };
      }
    })
  );

  // Process results
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      if (result.value.success) {
        success++;
      } else {
        failed++;
        if (result.value.invalid) {
          invalidTokens.push(result.value.tokenId);
        }
      }
    } else {
      failed++;
    }
  });

  // Deactivate invalid tokens
  if (invalidTokens.length > 0) {
    await PushToken.updateMany(
      { _id: { $in: invalidTokens } },
      { isActive: false }
    );
  }

  return { success, failed, invalidTokens };
}

/**
 * Generate VAPID keys (run once to get keys for .env)
 * Usage: node -e "require('./web-push').generateVapidKeys()"
 */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const keys = webpush.generateVAPIDKeys();
  console.log('Add these to your .env file:');
  console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
  return keys;
}

