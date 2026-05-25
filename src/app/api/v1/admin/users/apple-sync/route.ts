// GET  /api/v1/admin/users/apple-sync?originalTransactionId=...
//      Look up a user by Apple original transaction id (support / audit).
// POST /api/v1/admin/users/apple-sync
//      Re-sync subscription state from the App Store Server API (missed webhook recovery).
//
// POST body: { "originalTransactionId": "..." }
//         OR { "email": "student@example.com" }
//         OR { "userId": "<mongoId>" }

import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';
import { isUserSubscribed } from '@/lib/api/user-subscription';
import { applyAppleSubscriptionToUser } from '@/lib/api/apple-subscription-apply';
import {
  isAppleIapConfigured,
  resolveAppleSubscription,
} from '@/services/apple-app-store.service';

const postSchema = z
  .object({
    email: z.string().email().optional(),
    userId: z
      .string()
      .refine((id) => Types.ObjectId.isValid(id), { message: 'Invalid userId' })
      .optional(),
    originalTransactionId: z.string().min(1).optional(),
  })
  .refine((d) => d.email || d.userId || d.originalTransactionId, {
    message: 'Provide email, userId, or originalTransactionId',
  });

function appleFieldsFromUser(user: {
  _id: Types.ObjectId;
  email: string;
  subscriptionPlan?: string;
  subscriptionExpiresAt?: Date | null;
  subscriptionPaymentMethod?: string | null;
  appleOriginalTransactionId?: string;
  appleLatestTransactionId?: string;
  appleSubscriptionStatus?: string;
  subscriptionProvider?: string;
}) {
  return {
    userId: String(user._id),
    email: user.email,
    subscriptionPlan: user.subscriptionPlan,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
    subscriptionPaymentMethod: user.subscriptionPaymentMethod,
    appleOriginalTransactionId: user.appleOriginalTransactionId ?? null,
    appleLatestTransactionId: user.appleLatestTransactionId ?? null,
    appleSubscriptionStatus: user.appleSubscriptionStatus ?? null,
    subscriptionProvider: user.subscriptionProvider ?? null,
    isSubscribed: isUserSubscribed(user as Parameters<typeof isUserSubscribed>[0]),
  };
}

async function findUserByInput(input: {
  email?: string;
  userId?: string;
  originalTransactionId?: string;
}) {
  if (input.userId) {
    return User.findById(input.userId).exec();
  }
  if (input.email) {
    return User.findOne({ email: input.email.toLowerCase() }).exec();
  }
  if (input.originalTransactionId) {
    return User.findOne({
      appleOriginalTransactionId: input.originalTransactionId,
    }).exec();
  }
  return null;
}

async function getHandler(req: NextRequest): Promise<NextResponse> {
  const originalTransactionId = new URL(req.url).searchParams.get(
    'originalTransactionId'
  );

  if (!originalTransactionId) {
    return NextResponse.json(
      {
        code: 'ValidationError',
        message: 'Query parameter originalTransactionId is required',
      },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const user = await User.findOne({ appleOriginalTransactionId: originalTransactionId }).exec();

  if (!user) {
    return NextResponse.json(
      {
        code: 'NotFound',
        message: `No user with appleOriginalTransactionId ${originalTransactionId}`,
      },
      { status: 404 }
    );
  }

  logger.info('[apple-sync] Lookup by originalTransactionId', {
    userId: String(user._id),
    originalTransactionId,
  });

  return NextResponse.json({
    code: 'Success',
    data: appleFieldsFromUser(user),
  });
}

async function postHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
  if (!isAppleIapConfigured()) {
    return NextResponse.json(
      { code: 'ConfigError', message: 'Apple IAP is not configured on the server' },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: 'BadRequest', message: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'ValidationError', errors: parsed.error.issues },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const user = await findUserByInput(parsed.data);

  if (!user) {
    return NextResponse.json(
      { code: 'NotFound', message: 'User not found in database' },
      { status: 404 }
    );
  }

  const lookupId =
    parsed.data.originalTransactionId || user.appleOriginalTransactionId;

  if (!lookupId) {
    return NextResponse.json(
      {
        code: 'ValidationError',
        message:
          'User has no appleOriginalTransactionId. Pass originalTransactionId from a StoreKit purchase.',
      },
      { status: 422 }
    );
  }

  const before = appleFieldsFromUser(user);

  try {
    const verified = await resolveAppleSubscription({
      originalTransactionId: lookupId,
    });
    applyAppleSubscriptionToUser(user, verified);
    await user.save();

    logger.info('[apple-sync] Synced from App Store', {
      adminId: String(context.userId),
      userId: String(user._id),
      originalTransactionId: verified.originalTransactionId,
      appleSubscriptionStatus: verified.appleSubscriptionStatus,
    });

    return NextResponse.json({
      code: 'Success',
      message: 'Apple subscription synced from App Store.',
      before,
      after: appleFieldsFromUser(user),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[apple-sync] App Store sync failed', {
      userId: String(user._id),
      lookupId,
      error: message,
    });
    return NextResponse.json(
      { code: 'SyncFailed', message },
      { status: 422 }
    );
  }
}

export const GET = withRole(['admin'], getHandler);
export const POST = withRole(['admin'], postHandler);
