// POST /api/v1/admin/users/stripe-sync
// Looks up a user's Stripe subscription live and syncs it to the DB.
// Use this to recover a user whose webhook was missed or failed.
//
// Body: { "email": "student@example.com" }
//   OR  { "userId": "<mongoId>" }
//   OR  { "stripeCustomerId": "cus_..." }

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';
import {
  extendSubscriptionExpiresAt,
  shouldSkipStripeDowngrade,
} from '@/lib/api/subscription-reconciliation';
import { downgradeUserFromStripe } from '@/lib/api/stripe-subscription-apply';
import { billingPeriodFromStripePriceId } from '@/lib/api/stripe-billing-period';

const inputSchema = z
  .object({
    email: z.string().email().optional(),
    userId: z
      .string()
      .refine((id) => Types.ObjectId.isValid(id), { message: 'Invalid userId' })
      .optional(),
    stripeCustomerId: z.string().startsWith('cus_').optional(),
  })
  .refine((d) => d.email || d.userId || d.stripeCustomerId, {
    message: 'Provide email, userId, or stripeCustomerId',
  });

function fromUnix(ts: number): Date {
  return new Date(ts * 1000);
}

function getPeriodEnd(sub: Stripe.Subscription): Date | null {
  const ts = sub.items?.data?.[0]?.current_period_end;
  return typeof ts === 'number' ? fromUnix(ts) : null;
}

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
  if (!config.STRIPE_SECRET_KEY) {
    return NextResponse.json({ code: 'ConfigError', message: 'STRIPE_SECRET_KEY not set' }, { status: 500 });
  }

  const stripe = new Stripe(config.STRIPE_SECRET_KEY, { apiVersion: '2026-04-22.dahlia' });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: 'BadRequest', message: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'ValidationError', errors: parsed.error.issues },
      { status: 400 }
    );
  }

  await connectToDatabase();

  // ── 1. Find the user in our DB ──────────────────────────────────────────────
  let user: Awaited<ReturnType<typeof User.findOne>> | null = null;

  if (parsed.data.userId) {
    user = await User.findById(parsed.data.userId).exec();
  } else if (parsed.data.email) {
    user = await User.findOne({ email: parsed.data.email.toLowerCase() }).exec();
  } else if (parsed.data.stripeCustomerId) {
    user = await User.findOne({ stripeCustomerId: parsed.data.stripeCustomerId }).exec();
  }

  if (!user) {
    return NextResponse.json({ code: 'NotFound', message: 'User not found in database' }, { status: 404 });
  }

  // ── 2. Resolve Stripe customer ID ────────────────────────────────────────────
  let stripeCustomerId = user.stripeCustomerId;

  if (!stripeCustomerId) {
    // Try to find by email in Stripe
    const customers = await stripe.customers.list({ email: user.email, limit: 5 });
    if (customers.data.length === 0) {
      return NextResponse.json(
        {
          code: 'NotFound',
          message: `No Stripe customer found for email ${user.email}. The student may not have completed checkout.`,
          userId: String(user._id),
        },
        { status: 404 }
      );
    }
    // Use the most recently created customer
    stripeCustomerId = customers.data[0].id;
    logger.info('[stripe-sync] Resolved stripeCustomerId from email search', {
      userId: String(user._id),
      stripeCustomerId,
    });
  }

  // ── 3. Find active/trialing subscriptions in Stripe ──────────────────────────
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    limit: 10,
    expand: ['data.items.data'],
  });

  const activeSub = subscriptions.data.find(
    (s) => s.status === 'active' || s.status === 'trialing'
  );

  // ── 4. Sync user record ───────────────────────────────────────────────────────
  const before = {
    subscriptionPlan: user.subscriptionPlan,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionStatus: user.stripeSubscriptionStatus,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
  };

  user.stripeCustomerId = stripeCustomerId;

  if (activeSub) {
    const periodEnd = getPeriodEnd(activeSub) ?? new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);

    user.stripeSubscriptionId = activeSub.id;
    user.stripeSubscriptionStatus = activeSub.status;

    if (shouldSkipStripeDowngrade(user)) {
      extendSubscriptionExpiresAt(user, periodEnd);
      await user.save();
      logger.info('[stripe-sync] Stripe fields updated; Apple/manual expiry retained', {
        adminId: String(context.userId),
        userId: String(user._id),
      });
      return NextResponse.json({
        code: 'Success',
        message:
          'Stripe subscription synced. Premium retained via Apple or manual expiry (later period end).',
        before,
        after: {
          subscriptionPlan: user.subscriptionPlan,
          stripeCustomerId: user.stripeCustomerId,
          stripeSubscriptionId: user.stripeSubscriptionId,
          stripeSubscriptionStatus: user.stripeSubscriptionStatus,
          subscriptionExpiresAt: user.subscriptionExpiresAt,
          subscriptionPaymentMethod: user.subscriptionPaymentMethod,
        },
      });
    }

    user.subscriptionPlan = 'premium';
    user.subscriptionActivatedAt = user.subscriptionActivatedAt ?? fromUnix(activeSub.created);
    user.subscriptionExpiresAt = periodEnd;
    user.subscriptionPaymentMethod = 'stripe';
    const billingPeriod = billingPeriodFromStripePriceId(
      activeSub.items?.data?.[0]?.price?.id
    );
    if (billingPeriod) {
      user.subscriptionBillingPeriod = billingPeriod;
    }
    await user.save();

    logger.info('[stripe-sync] Synced subscription — activated premium', {
      adminId: String(context.userId),
      userId: String(user._id),
      subscriptionId: activeSub.id,
      periodEnd,
    });

    return NextResponse.json({
      code: 'Success',
      message: 'Subscription synced — student is now premium.',
      before,
      after: {
        subscriptionPlan: user.subscriptionPlan,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        stripeSubscriptionStatus: user.stripeSubscriptionStatus,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
      },
    });
  }

  // No active subscription — sync status and downgrade unless Apple/manual retains access
  const latestSub = subscriptions.data[0];
  if (latestSub) {
    user.stripeSubscriptionId = latestSub.id;
    user.stripeSubscriptionStatus = latestSub.status;
  }

  const downgraded = !shouldSkipStripeDowngrade(user);
  if (downgraded) {
    downgradeUserFromStripe(user);
  }

  await user.save();

  return NextResponse.json(
    {
      code: downgraded ? 'Downgraded' : 'NoActiveSubscription',
      message: downgraded
        ? `No active Stripe subscription. Student downgraded to free (latest status: ${latestSub?.status ?? 'none'}).`
        : `No active Stripe subscription but premium retained via Apple/manual expiry (latest: ${latestSub?.status ?? 'none'}).`,
      userId: String(user._id),
      stripeCustomerId,
      latestSubscriptionId: latestSub?.id ?? null,
      latestSubscriptionStatus: latestSub?.status ?? null,
      before,
      after: {
        subscriptionPlan: user.subscriptionPlan,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        stripeSubscriptionStatus: user.stripeSubscriptionStatus,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        subscriptionPaymentMethod: user.subscriptionPaymentMethod,
      },
    },
    { status: downgraded ? 200 : 422 }
  );
}

export const POST = withRole(['admin'], handler);
