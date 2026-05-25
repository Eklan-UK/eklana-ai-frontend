// POST /api/v1/apple/verify
// Immediate unlock after StoreKit purchase or restore on iOS.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';
import { isUserSubscribed } from '@/lib/api/user-subscription';
import { applyAppleSubscriptionToUser } from '@/lib/api/apple-subscription-apply';
import {
  isAppleIapConfigured,
  resolveAppleSubscription,
} from '@/services/apple-app-store.service';

const verifyBodySchema = z
  .object({
    transactionId: z.string().min(1).optional(),
    originalTransactionId: z.string().min(1).optional(),
    productId: z.string().min(1).optional(),
    signedTransactionInfo: z.string().min(1).optional(),
  })
  .refine(
    (body) =>
      body.transactionId ||
      body.originalTransactionId ||
      body.signedTransactionInfo,
    {
      message:
        'Provide transactionId, originalTransactionId, or signedTransactionInfo',
    }
  );

async function handler(
  req: NextRequest,
  context: { userId: { toString(): string }; userRole: string }
): Promise<NextResponse> {
  try {
    if (!isAppleIapConfigured()) {
      return NextResponse.json(
        {
          code: 'ConfigError',
          message: 'Apple In-App Purchase is not configured on the server.',
        },
        { status: 500 }
      );
    }

    const body = verifyBodySchema.parse(await req.json());

    if (
      body.productId &&
      body.productId !== config.APPLE_PRO_MONTHLY_PRODUCT_ID
    ) {
      return NextResponse.json(
        { code: 'ValidationError', message: 'Invalid product ID.' },
        { status: 400 }
      );
    }

    const verified = await resolveAppleSubscription(body);

    await connectToDatabase();
    const user = await User.findById(context.userId).exec();
    if (!user) {
      return NextResponse.json(
        { code: 'NotFoundError', message: 'User not found.' },
        { status: 404 }
      );
    }

    applyAppleSubscriptionToUser(user, verified);
    await user.save();

    const subscribed = isUserSubscribed(user);

    logger.info('[Apple Verify] Subscription applied', {
      userId: String(user._id),
      originalTransactionId: verified.originalTransactionId,
      appleSubscriptionStatus: verified.appleSubscriptionStatus,
      isSubscribed: subscribed,
    });

    return NextResponse.json(
      {
        success: true,
        isSubscribed: subscribed,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: 'ValidationError',
          message: 'Validation failed',
          errors: error.issues,
        },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    logger.warn('[Apple Verify] Verification failed', {
      userId: context.userId.toString(),
      error: message,
    });

    return NextResponse.json(
      {
        code: 'VerificationFailed',
        message: message || 'Could not verify App Store purchase.',
      },
      { status: 400 }
    );
  }
}

export const POST = withAuth(handler);
