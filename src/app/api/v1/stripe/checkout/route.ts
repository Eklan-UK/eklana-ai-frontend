// POST /api/v1/stripe/checkout
// Creates a Stripe Checkout Session for the Pro subscription.
// Returns { url } — the client redirects the browser to this URL.
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';
import type { BillingPeriod } from '@/domain/subscriptions/subscription.types';
import {
  isEligibleForTrial,
  hasPriorStripeSubscriptions,
} from '@/lib/api/stripe-trial-eligibility';
import { subscriptionDataForCheckout } from '@/lib/api/stripe-checkout-session';
import {
  applyZeroPauseChallengeExpiry,
  resolveCheckoutPriceForUser,
} from '@/lib/api/zero-pause-pricing';
import { syncStripeForZeroPauseMaintainerPricing } from '@/lib/api/stripe-challenge-pricing-sync';

function getStripe(): Stripe {
  if (!config.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  return new Stripe(config.STRIPE_SECRET_KEY, {
    apiVersion: '2026-04-22.dahlia',
  });
}

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3000'
  );
}

async function restorePublicPricingAfterChallengeExpiry(
  stripe: Stripe,
  user: {
    _id: unknown;
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
    stripeScheduleId?: string | null;
    subscriptionBillingPeriod?: 'monthly' | 'quarterly' | 'annual' | null;
    zeroPausePriorStripePriceId?: string | null;
    zeroPausePriorBillingPeriod?: 'monthly' | 'quarterly' | 'annual' | null;
    save: () => Promise<unknown>;
  }
): Promise<void> {
  if (!user.stripeSubscriptionId && !user.stripeCustomerId) return;
  try {
    const result = await syncStripeForZeroPauseMaintainerPricing(stripe, user);
    await user.save();
    logger.info('Challenge expiry: restored public pricing at renewal', {
      userId: String(user._id),
      result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Challenge expiry: failed to restore public pricing', {
      userId: String(user._id),
      error: message,
    });
  }
}

async function handler(
  req: NextRequest,
  context: { userId: any; userRole: string }
): Promise<NextResponse> {
  try {
    if (!config.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { code: 'ConfigError', message: 'Payment service is not configured.' },
        { status: 500 }
      );
    }

    let billingPeriod: BillingPeriod = 'monthly';
    try {
      const body = await req.json();
      if (body?.billingPeriod != null) {
        if (!['monthly', 'quarterly', 'annual'].includes(body.billingPeriod)) {
          return NextResponse.json(
            { code: 'ValidationError', message: 'Invalid billingPeriod.' },
            { status: 400 }
          );
        }
        billingPeriod = body.billingPeriod;
      }
    } catch {
      // empty / invalid JSON body → default monthly (current UI posts empty body)
    }

    await connectToDatabase();
    const user = await User.findById(context.userId)
      .select(
        'email firstName lastName stripeCustomerId createdAt subscriptionActivatedAt subscriptionProvider stripeSubscriptionId stripeScheduleId subscriptionBillingPeriod appleOriginalTransactionId zeroPauseProducts zeroPauseDate zeroPauseEndDate zeroPausePriorStripePriceId zeroPausePriorBillingPeriod'
      )
      .exec();

    if (!user) {
      return NextResponse.json(
        { code: 'NotFoundError', message: 'User not found.' },
        { status: 404 }
      );
    }

    const stripe = getStripe();

    const { expired } = applyZeroPauseChallengeExpiry(user);
    if (expired) {
      await user.save();
      await restorePublicPricingAfterChallengeExpiry(stripe, user);
    }

    const priceResolution = resolveCheckoutPriceForUser(user, billingPeriod);
    if (priceResolution.status === 'challenge_period_not_allowed') {
      return NextResponse.json(
        {
          code: 'ValidationError',
          message: priceResolution.message,
        },
        { status: 400 }
      );
    }
    if (priceResolution.status === 'price_not_configured') {
      return NextResponse.json(
        {
          code: 'ConfigError',
          message: priceResolution.message,
        },
        { status: 500 }
      );
    }

    const { priceId, billingPeriod: resolvedPeriod, challengePricing } =
      priceResolution;

    // Create or reuse Stripe Customer — persist before session create
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim() || user.email,
        metadata: { userId: String(user._id) },
      });
      stripeCustomerId = customer.id;
      user.stripeCustomerId = stripeCustomerId;
      await user.save();
    }

    const eligibleForTrial =
      isEligibleForTrial(user) &&
      !(await hasPriorStripeSubscriptions(stripe, stripeCustomerId));

    const appUrl = getAppUrl();
    const subscriptionData = subscriptionDataForCheckout(
      eligibleForTrial,
      String(user._id)
    );
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      client_reference_id: String(user._id),
      metadata: { userId: String(user._id) },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      ...(subscriptionData && { subscription_data: subscriptionData }),
      success_url: `${appUrl}/account/settings/subscriptions?checkout=success`,
      cancel_url: `${appUrl}/account/settings/subscriptions`,
      allow_promotion_codes: true,
    });

    logger.info('Stripe Checkout Session created', {
      userId: String(user._id),
      sessionId: session.id,
      billingPeriod: resolvedPeriod,
      priceId,
      eligibleForTrial,
      challengePricing,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error: any) {
    logger.error('Error creating Stripe Checkout Session', {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      {
        code: 'ServerError',
        message: 'Could not start checkout. Please try again or contact support.',
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);
