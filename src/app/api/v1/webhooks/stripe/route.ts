// Generated with: stripe-webhooks skill
// https://github.com/hookdeck/webhook-skills

// POST /api/v1/webhooks/stripe
// Receives signed Stripe webhook events and syncs subscription state to MongoDB.
// IMPORTANT: Next.js App Router — must read raw body via req.text() before any parsing.
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';

function getStripe(): Stripe {
  if (!config.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  return new Stripe(config.STRIPE_SECRET_KEY, {
    apiVersion: '2026-04-22.dahlia',
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert Stripe's Unix timestamp (seconds) to a JS Date. */
function fromUnix(ts: number): Date {
  return new Date(ts * 1000);
}

/**
 * In Stripe API 2026-04-22 (dahlia) `current_period_end` moved from the
 * Subscription root to each SubscriptionItem. Read it from the first item.
 */
function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const ts = subscription.items?.data?.[0]?.current_period_end;
  return typeof ts === 'number' ? fromUnix(ts) : null;
}

/** Find user by stripeCustomerId. */
async function findUserByCustomer(customerId: string) {
  return User.findOne({ stripeCustomerId: customerId }).exec();
}

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe
): Promise<void> {
  if (session.mode !== 'subscription' || !session.customer || !session.subscription) {
    return;
  }

  const customerId = String(session.customer);
  const subscriptionId = String(session.subscription);

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const periodEnd = getSubscriptionPeriodEnd(subscription);
  const status = subscription.status;

  await connectToDatabase();
  const user = await findUserByCustomer(customerId);
  if (!user) {
    logger.warn('[Stripe Webhook] checkout.session.completed — user not found for customer', { customerId });
    return;
  }

  user.subscriptionPlan = 'premium';
  user.stripeSubscriptionId = subscriptionId;
  user.stripeSubscriptionStatus = status;
  user.subscriptionActivatedAt = new Date();
  user.subscriptionExpiresAt = periodEnd;
  user.subscriptionPaymentMethod = 'stripe';
  await user.save();

  logger.info('[Stripe Webhook] checkout.session.completed — subscription activated', {
    userId: String(user._id),
    subscriptionId,
    periodEnd,
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const customerId = String(subscription.customer);
  const periodEnd = getSubscriptionPeriodEnd(subscription);
  const status = subscription.status;

  await connectToDatabase();
  const user = await findUserByCustomer(customerId);
  if (!user) {
    logger.warn('[Stripe Webhook] subscription.updated — user not found', { customerId });
    return;
  }

  user.stripeSubscriptionId = subscription.id;
  user.stripeSubscriptionStatus = status;

  // Idempotency: only extend expiry if the incoming period end is later than stored.
  if (periodEnd !== null) {
    const storedExpiry = user.subscriptionExpiresAt ? user.subscriptionExpiresAt.getTime() : 0;
    if (periodEnd.getTime() > storedExpiry) {
      user.subscriptionExpiresAt = periodEnd;
    }
  }

  // Active/trialing = premium; past_due keeps premium (grace period); others downgrade.
  if (status === 'active' || status === 'trialing') {
    user.subscriptionPlan = 'premium';
  } else if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
    user.subscriptionPlan = 'free';
    user.subscriptionExpiresAt = null;
  }

  await user.save();

  logger.info('[Stripe Webhook] subscription.updated', {
    userId: String(user._id),
    status,
    periodEnd,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = String(subscription.customer);

  await connectToDatabase();
  const user = await findUserByCustomer(customerId);
  if (!user) {
    logger.warn('[Stripe Webhook] subscription.deleted — user not found', { customerId });
    return;
  }

  user.subscriptionPlan = 'free';
  user.stripeSubscriptionId = undefined;
  user.stripeSubscriptionStatus = 'canceled';
  user.subscriptionExpiresAt = null;
  user.subscriptionActivatedAt = null;
  await user.save();

  logger.info('[Stripe Webhook] subscription.deleted — downgraded to free', {
    userId: String(user._id),
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.customer || !invoice.subscription) return;

  const customerId = String(invoice.customer);
  const periodEnd = invoice.lines?.data?.[0]?.period?.end
    ? fromUnix(invoice.lines.data[0].period.end)
    : null;

  if (!periodEnd) return;

  await connectToDatabase();
  const user = await findUserByCustomer(customerId);
  if (!user) {
    logger.warn('[Stripe Webhook] invoice.paid — user not found', { customerId });
    return;
  }

  // Idempotency: only advance expiry, never move it backward.
  const storedExpiry = user.subscriptionExpiresAt ? user.subscriptionExpiresAt.getTime() : 0;
  if (periodEnd.getTime() > storedExpiry) {
    user.subscriptionExpiresAt = periodEnd;
  }

  user.subscriptionPlan = 'premium';
  await user.save();

  logger.info('[Stripe Webhook] invoice.paid — expiry extended', {
    userId: String(user._id),
    periodEnd,
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.customer) return;

  const customerId = String(invoice.customer);

  await connectToDatabase();
  const user = await findUserByCustomer(customerId);
  if (!user) return;

  user.stripeSubscriptionStatus = 'past_due';
  await user.save();

  logger.warn('[Stripe Webhook] invoice.payment_failed — marked past_due', {
    userId: String(user._id),
  });
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!config.STRIPE_SECRET_KEY || !config.STRIPE_WEBHOOK_SECRET) {
    logger.error('[Stripe Webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ code: 'ConfigError' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json(
      { code: 'BadRequest', message: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  // Read raw body — must not use req.json() here.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, config.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    logger.warn('[Stripe Webhook] Signature verification failed', { error: err.message });
    return NextResponse.json(
      { code: 'Unauthorized', message: 'Webhook signature verification failed.' },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
          stripe
        );
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        logger.info('[Stripe Webhook] Unhandled event type', { type: event.type });
    }
  } catch (err: any) {
    logger.error('[Stripe Webhook] Error processing event', {
      type: event.type,
      error: err.message,
      stack: err.stack,
    });
    // Return 500 so Stripe retries the event.
    return NextResponse.json({ code: 'ServerError' }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
