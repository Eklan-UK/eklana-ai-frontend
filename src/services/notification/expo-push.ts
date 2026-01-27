/**
 * Expo Push Notification Service
 * Handles sending push notifications to Expo/React Native apps
 */

import { PushToken } from '@/models/push-token.model';

// Expo push notification types
interface ExpoPushMessage {
  to: string;
  sound?: 'default' | null;
  title: string;
  body: string;
  data?: Record<string, any>;
  ttl?: number;
  expiration?: number;
  priority?: 'default' | 'normal' | 'high';
  badge?: number;
  channelId?: string;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
}

interface ExpoPushReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: string;
  };
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Check if a token is a valid Expo push token
 */
export function isExpoPushToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

/**
 * Chunk an array into smaller arrays
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Send push notifications to Expo tokens
 */
export async function sendExpoPush(
  tokens: Array<{ _id: string; token: string }>,
  payload: {
    title: string;
    body: string;
    data?: Record<string, any>;
    badge?: number;
  }
): Promise<{ success: number; failed: number; invalidTokens: string[] }> {
  if (tokens.length === 0) {
    return { success: 0, failed: 0, invalidTokens: [] };
  }

  const messages: ExpoPushMessage[] = tokens
    .filter(t => isExpoPushToken(t.token))
    .map(t => ({
      to: t.token,
      sound: 'default' as const,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      priority: 'high' as const,
      badge: payload.badge,
    }));

  if (messages.length === 0) {
    return { success: 0, failed: 0, invalidTokens: [] };
  }

  // Expo recommends sending in chunks of 100
  const chunks = chunkArray(messages, 100);
  const invalidTokens: string[] = [];
  let success = 0;
  let failed = 0;

  for (const chunk of chunks) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        console.error('Expo push error:', await response.text());
        failed += chunk.length;
        continue;
      }

      const result = await response.json();
      const tickets: ExpoPushTicket[] = result.data || [];

      // Process tickets to find invalid tokens
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'ok') {
          success++;
        } else {
          failed++;
          
          // Check for invalid token errors
          const errorType = ticket.details?.error;
          if (
            errorType === 'DeviceNotRegistered' ||
            errorType === 'InvalidCredentials'
          ) {
            const tokenObj = tokens.find(t => t.token === chunk[index].to);
            if (tokenObj) {
              invalidTokens.push(tokenObj._id);
            }
          }
        }
      });
    } catch (error) {
      console.error('Expo push chunk error:', error);
      failed += chunk.length;
    }
  }

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
 * Get push receipts for sent notifications (for debugging)
 */
export async function getExpoPushReceipts(
  ticketIds: string[]
): Promise<Record<string, ExpoPushReceipt>> {
  if (ticketIds.length === 0) {
    return {};
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: ticketIds }),
    });

    if (!response.ok) {
      console.error('Failed to get Expo receipts:', await response.text());
      return {};
    }

    const result = await response.json();
    return result.data || {};
  } catch (error) {
    console.error('Error getting Expo receipts:', error);
    return {};
  }
}

