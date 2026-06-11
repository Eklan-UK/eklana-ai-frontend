// Generated with: stripe-webhooks skill
// https://github.com/hookdeck/webhook-skills

// POST /api/v1/webhooks/stripe
// Receives signed Stripe webhook events and syncs subscription state to MongoDB.
// IMPORTANT: Next.js App Router — must read raw body via req.text() before any parsing.

// force-dynamic so Next.js never statically pre-renders this route
export const dynamic = 'force-dynamic';
// Mongoose + Stripe SDK require Node runtime (not Edge).
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';
import {
  extendSubscriptionExpiresAt,
  shouldSkipStripeDowngrade,
} from '@/lib/api/subscription-reconciliation';
import { billingPeriodFromStripePriceId } from '@/lib/api/stripe-billing-period';

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

function applyBillingPeriodFromSubscription(
  user: InstanceType<typeof User>,
  subscription: Stripe.Subscription
): void {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const period = billingPeriodFromStripePriceId(priceId);
  if (period) {
    user.subscriptionBillingPeriod = period;
  }
}

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe
): Promise<void> {
  if (session.mode !== 'subscription' || !session.customer) {
    return;
  }

  const customerId = String(session.customer);
  // Prefer subscription id on the session; if missing (rare), resolve from Stripe.
  let subscriptionId: string | null = session.subscription
    ? String(session.subscription)
    : null;
  if (!subscriptionId) {
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    });
    const pick = subs.data.find((s) =>
      ['active', 'trialing', 'past_due'].includes(s.status)
    );
    subscriptionId = pick?.id ?? null;
  }
  if (!subscriptionId) {
    logger.warn(
      '[Stripe Webhook] checkout.session.completed — could not resolve subscription',
      { customerId, sessionId: session.id }
    );
    return;
  }

  // Expand items.data so current_period_end is available on each item (required in dahlia API).
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data'],
  });
  // Fall back to 31 days from now if Stripe doesn't return a period end (e.g. free trials).
  const periodEnd = getSubscriptionPeriodEnd(subscription)
    ?? new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
  const status = subscription.status;

  await connectToDatabase();
  const user = await findUserByCustomer(customerId);
  if (!user) {
    logger.warn('[Stripe Webhook] checkout.session.completed — user not found for customer', { customerId });
    return;
  }

  user.stripeSubscriptionId = subscriptionId;
  user.stripeSubscriptionStatus = status;

  if (shouldSkipStripeDowngrade(user)) {
    extendSubscriptionExpiresAt(user, periodEnd);
    await user.save();
    logger.info(
      '[Stripe Webhook] checkout.session.completed — Stripe fields updated; Apple/manual expiry retained',
      { userId: String(user._id), subscriptionId }
    );
    return;
  }

  user.subscriptionPlan = 'premium';
  user.subscriptionActivatedAt = user.subscriptionActivatedAt ?? new Date();
  user.subscriptionExpiresAt = periodEnd;
  user.subscriptionPaymentMethod = 'stripe';
  applyBillingPeriodFromSubscription(user, subscription);
  await user.save();

  logger.info('[Stripe Webhook] checkout.session.completed — subscription activated', {
    userId: String(user._id),
    subscriptionId,
    periodEnd,
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, stripe: Stripe): Promise<void> {
  const customerId = String(subscription.customer);

  // Re-retrieve with expanded items to ensure current_period_end is available.
  const expandedSub = await stripe.subscriptions.retrieve(subscription.id, {
    expand: ['items.data'],
  });
  const periodEnd = getSubscriptionPeriodEnd(expandedSub);
  const status = expandedSub.status;

  await connectToDatabase();
  const user = await findUserByCustomer(customerId);
  if (!user) {
    logger.warn('[Stripe Webhook] subscription.updated — user not found', { customerId });
    return;
  }

  user.stripeSubscriptionId = subscription.id;
  user.stripeSubscriptionStatus = status;

  if (periodEnd !== null) {
    extendSubscriptionExpiresAt(user, periodEnd);
  }

  if (status === 'active' || status === 'trialing') {
    if (!shouldSkipStripeDowngrade(user)) {
      user.subscriptionPlan = 'premium';
      user.subscriptionPaymentMethod = 'stripe';
      applyBillingPeriodFromSubscription(user, expandedSub);
    }
  } else if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
    if (shouldSkipStripeDowngrade(user)) {
      logger.info(
        '[Stripe Webhook] subscription.updated — skipped downgrade; Apple/manual still active',
        { userId: String(user._id), status }
      );
    } else {
      user.subscriptionPlan = 'free';
      user.subscriptionBillingPeriod = null;
      user.subscriptionExpiresAt = null;
    }
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

  user.stripeSubscriptionId = undefined;
  user.stripeSubscriptionStatus = 'canceled';

  if (shouldSkipStripeDowngrade(user)) {
    await user.save();
    logger.info(
      '[Stripe Webhook] subscription.deleted — Stripe cleared; Apple/manual expiry retained',
      { userId: String(user._id) }
    );
    return;
  }

  user.subscriptionPlan = 'free';
  user.subscriptionBillingPeriod = null;
  user.subscriptionExpiresAt = null;
  user.subscriptionActivatedAt = null;
  if (user.subscriptionPaymentMethod === 'stripe') {
    user.subscriptionPaymentMethod = undefined;
  }
  await user.save();

  logger.info('[Stripe Webhook] subscription.deleted — downgraded to free', {
    userId: String(user._id),
  });
}

/** Subscription invoices in Dahlia often use parent.subscription_details; older payloads may use billing_reason or line.subscription. */
function invoiceIsForSubscription(invoice: Stripe.Invoice): boolean {
  if (invoice.parent?.type === 'subscription_details') return true;
  const inv = invoice as Stripe.Invoice & {
    billing_reason?: string | null;
    subscription?: string | Stripe.Subscription | null;
  };
  if (inv.subscription) return true;
  const br = inv.billing_reason;
  if (
    br === 'subscription_create' ||
    br === 'subscription_cycle' ||
    br === 'subscription_update'
  ) {
    return true;
  }
  for (const line of invoice.lines?.data ?? []) {
    const sub = (line as Stripe.InvoiceLineItem & { subscription?: string | null })
      .subscription;
    if (sub) return true;
  }
  return false;
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.customer || !invoiceIsForSubscription(invoice)) return;

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

  extendSubscriptionExpiresAt(user, periodEnd);
  if (!shouldSkipStripeDowngrade(user)) {
    user.subscriptionPlan = 'premium';
    user.subscriptionPaymentMethod = 'stripe';
  }
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

/** Ops smoke test: confirms the route is deployed (Stripe only POSTs signed events). */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/v1/webhooks/stripe',
    methods: ['POST'],
  });
}

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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[Stripe Webhook] Signature verification failed', { error: message });
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
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, stripe);
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
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));
    logger.error('[Stripe Webhook] Error processing event', {
      type: event.type,
      error: e.message,
      stack: e.stack,
    });
    // Return 500 so Stripe retries the event.
    return NextResponse.json({ code: 'ServerError' }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
