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
import {
  resolveStripePriceId,
  subscriptionDataForCheckout,
} from '@/lib/api/stripe-checkout-session';

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

    const priceId = resolveStripePriceId(billingPeriod);
    if (!priceId) {
      return NextResponse.json(
        {
          code: 'ConfigError',
          message: `Subscription price is not configured for billing period: ${billingPeriod}.`,
        },
        { status: 500 }
      );
    }

    await connectToDatabase();
    const user = await User.findById(context.userId)
      .select(
        'email firstName lastName stripeCustomerId createdAt subscriptionActivatedAt subscriptionProvider stripeSubscriptionId appleOriginalTransactionId'
      )
      .exec();

    if (!user) {
      return NextResponse.json(
        { code: 'NotFoundError', message: 'User not found.' },
        { status: 404 }
      );
    }

    const stripe = getStripe();

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
      billingPeriod,
      priceId,
      eligibleForTrial,
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
