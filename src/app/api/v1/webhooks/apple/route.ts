// POST /api/v1/webhooks/apple
// App Store Server Notifications V2 — renewals, cancellations, refunds, grace period.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import {
  NotificationTypeV2,
  type Data,
  type JWSTransactionDecodedPayload,
} from '@apple/app-store-server-library';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import {
  applyAppleStatusFromWebhook,
  downgradeUserFromApple,
} from '@/lib/api/apple-subscription-apply';
import { shouldSkipAppleDowngrade } from '@/lib/api/subscription-reconciliation';
import {
  isAppleIapConfigured,
  mapAppleStatus,
  resolveSubscriptionExpiryDates,
  verifyAndDecodeNotificationJws,
  verifyAndDecodeRenewalInfoJws,
  verifyAndDecodeTransactionJws,
  type AppleSubscriptionStatusString,
} from '@/services/apple-app-store.service';
import { Status } from '@apple/app-store-server-library';

async function findUserByAppleOriginalTransactionId(originalTransactionId: string) {
  return User.findOne({ appleOriginalTransactionId: originalTransactionId }).exec();
}

async function decodeTransactionFromNotification(
  data: Data
): Promise<JWSTransactionDecodedPayload | null> {
  if (!data.signedTransactionInfo) return null;
  return verifyAndDecodeTransactionJws(data.signedTransactionInfo);
}

async function decodeRenewalFromNotification(data: Data) {
  if (!data.signedRenewalInfo) return null;
  return verifyAndDecodeRenewalInfoJws(data.signedRenewalInfo);
}

function resolveStatus(
  notificationType: string | undefined,
  subtype: string | undefined,
  data?: Data
): AppleSubscriptionStatusString | 'noop' {
  const fromType = statusFromNotificationType(notificationType, subtype);
  if (fromType !== 'noop') return fromType;
  if (data?.status != null) {
    const fromData = mapAppleStatus(data.status as Status);
    if (fromData !== 'unknown') return fromData;
  }
  return 'noop';
}

function statusFromNotificationType(
  notificationType: string | undefined,
  subtype?: string
): AppleSubscriptionStatusString | 'noop' {
  switch (notificationType) {
    case NotificationTypeV2.SUBSCRIBED:
    case NotificationTypeV2.DID_RENEW:
    case NotificationTypeV2.OFFER_REDEEMED:
    case NotificationTypeV2.RENEWAL_EXTENDED:
    case NotificationTypeV2.REFUND_REVERSED:
      return 'active';
    case NotificationTypeV2.DID_FAIL_TO_RENEW:
      return subtype === 'GRACE_PERIOD' ? 'billing_grace' : 'billing_retry';
    case NotificationTypeV2.EXPIRED:
    case NotificationTypeV2.REVOKE:
    case NotificationTypeV2.REFUND:
    case NotificationTypeV2.GRACE_PERIOD_EXPIRED:
      return 'expired';
    case NotificationTypeV2.TEST:
      return 'noop';
    default:
      return 'noop';
  }
}

async function handleNotification(
  notificationType: string | undefined,
  subtype: string | undefined,
  transaction: JWSTransactionDecodedPayload | null,
  data?: Data
): Promise<void> {
  const originalTransactionId = transaction?.originalTransactionId;
  if (!originalTransactionId) {
    logger.warn('[Apple Webhook] Missing originalTransactionId in notification');
    return;
  }

  await connectToDatabase();
  const user = await findUserByAppleOriginalTransactionId(originalTransactionId);
  if (!user) {
    logger.warn('[Apple Webhook] User not found for originalTransactionId', {
      originalTransactionId,
      notificationType,
    });
    return;
  }

  if (transaction?.transactionId) {
    user.appleLatestTransactionId = transaction.transactionId;
  }

  const mapped = resolveStatus(notificationType, subtype, data);
  if (mapped === 'noop') {
    logger.info('[Apple Webhook] Unhandled or test notification', {
      notificationType,
      subtype,
      originalTransactionId,
    });
    return;
  }

  const renewal = data ? await decodeRenewalFromNotification(data) : null;
  const expiresAt = resolveSubscriptionExpiryDates(transaction, renewal);

  if (mapped === 'expired') {
    if (shouldSkipAppleDowngrade(user)) {
      logger.info('[Apple Webhook] Skipped downgrade — other rail still active', {
        userId: String(user._id),
        notificationType,
      });
      user.appleSubscriptionStatus = mapped;
      await user.save();
      return;
    }
    downgradeUserFromApple(user);
    await user.save();
    logger.info('[Apple Webhook] Downgraded to free', {
      userId: String(user._id),
      notificationType,
    });
    return;
  }

  applyAppleStatusFromWebhook(user, mapped, expiresAt);
  await user.save();

  logger.info('[Apple Webhook] Subscription updated', {
    userId: String(user._id),
    notificationType,
    subtype,
    appleSubscriptionStatus: user.appleSubscriptionStatus,
  });
}

/** Ops smoke test: confirms the route is deployed. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/v1/webhooks/apple',
    methods: ['POST'],
    configured: isAppleIapConfigured(),
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAppleIapConfigured()) {
    logger.error('[Apple Webhook] Apple IAP env vars are not configured');
    return NextResponse.json({ code: 'ConfigError' }, { status: 500 });
  }

  const rawBody = await req.text();

  let signedPayload: string;
  try {
    const parsed = JSON.parse(rawBody) as { signedPayload?: string };
    if (!parsed.signedPayload) {
      return NextResponse.json(
        { code: 'BadRequest', message: 'Missing signedPayload' },
        { status: 400 }
      );
    }
    signedPayload = parsed.signedPayload;
  } catch {
    return NextResponse.json(
      { code: 'BadRequest', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  try {
    const decoded = await verifyAndDecodeNotificationJws(signedPayload);
    const notificationType = decoded.notificationType as string | undefined;
    const subtype = decoded.subtype as string | undefined;

    logger.info('[Apple Webhook] Received notification', {
      notificationType,
      subtype,
      notificationUUID: decoded.notificationUUID,
    });

    const notificationData = decoded.data;
    const transaction = notificationData
      ? await decodeTransactionFromNotification(notificationData)
      : null;

    await handleNotification(notificationType, subtype, transaction, notificationData);
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));
    logger.error('[Apple Webhook] Processing failed', {
      error: e.message,
      stack: e.stack,
    });
    return NextResponse.json({ code: 'ServerError' }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
