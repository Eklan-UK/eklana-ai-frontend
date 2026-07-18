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
import StripeWebhookEvent from '@/models/stripe-webhook-event';
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';
import {
  extendSubscriptionExpiresAt,
  shouldSkipStripeDowngrade,
} from '@/lib/api/subscription-reconciliation';
import {
  applyStripePaymentFailureDowngrade,
  downgradeUserFromStripe,
} from '@/lib/api/stripe-subscription-apply';
import { findUserByStripeCustomer } from '@/lib/api/stripe-webhook-user';
import {
  applyEntitledStripeSubscription,
  findEntitledStripeSubscription,
  getInvoiceSubscriptionId,
} from '@/lib/api/stripe-customer-subscriptions';
import { applyBillingPeriodFromPriceId } from '@/lib/api/stripe-billing-period';

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

type UserDoc = Awaited<ReturnType<typeof User.findById>>;

/** Set user.subscriptionBillingPeriod from the subscription's first price ID. */
function applyBillingPeriodFromSubscription(
  user: NonNullable<UserDoc>,
  subscription: Stripe.Subscription
): void {
  const price = subscription.items?.data?.[0]?.price;
  const priceId =
    typeof price === 'string'
      ? price
      : price && typeof price === 'object' && 'id' in price
        ? price.id
        : undefined;
  applyBillingPeriodFromPriceId(user, priceId);
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 11000
  );
}

function scheduleCustomerId(
  schedule: Stripe.SubscriptionSchedule
): string | null {
  if (!schedule.customer) return null;
  return typeof schedule.customer === 'string'
    ? schedule.customer
    : schedule.customer.id;
}

function scheduleSubscriptionId(
  schedule: Stripe.SubscriptionSchedule
): string | null {
  if (schedule.subscription) {
    return typeof schedule.subscription === 'string'
      ? schedule.subscription
      : schedule.subscription.id;
  }
  if (schedule.released_subscription) {
    return schedule.released_subscription;
  }
  return null;
}

/** Resolve user for a subscription schedule via customer, then stripeSubscriptionId. */
async function findUserForSubscriptionSchedule(
  schedule: Stripe.SubscriptionSchedule,
  stripe: Stripe
) {
  const customerId = scheduleCustomerId(schedule);
  if (customerId) {
    const byCustomer = await findUserByStripeCustomer(stripe, customerId);
    if (byCustomer) return byCustomer;
  }
  const subscriptionId = scheduleSubscriptionId(schedule);
  if (subscriptionId) {
    return User.findOne({ stripeSubscriptionId: subscriptionId }).exec();
  }
  return null;
}

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
  eventId?: string
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
      ['active', 'trialing'].includes(s.status)
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
  let user = await findUserByStripeCustomer(stripe, customerId);
  if (!user) {
    const userId = session.client_reference_id ?? session.metadata?.userId;
    if (userId) {
      user = await User.findById(userId).exec();
      if (user) {
        user.stripeCustomerId = customerId;
      }
    }
  }
  if (!user) {
    if (status === 'active' || status === 'trialing') {
      logger.error(
        '[Stripe Webhook] checkout.session.completed — user not found for entitled subscription',
        {
          eventId,
          customerId,
          subscriptionId,
          sessionId: session.id,
        }
      );
    } else {
      logger.warn(
        '[Stripe Webhook] checkout.session.completed — user not found for customer',
        { customerId, sessionId: session.id }
      );
    }
    return;
  }

  user.stripeSubscriptionId = subscriptionId;
  user.stripeSubscriptionStatus = status;
  applyBillingPeriodFromSubscription(user, subscription);

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
  user.subscriptionProvider = 'stripe';
  await user.save();

  logger.info('[Stripe Webhook] checkout.session.completed — subscription activated', {
    userId: String(user._id),
    subscriptionId,
    periodEnd,
  });
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  stripe: Stripe,
  eventId?: string
): Promise<void> {
  const customerId = String(subscription.customer);

  // Re-retrieve with expanded items to ensure current_period_end is available.
  const expandedSub = await stripe.subscriptions.retrieve(subscription.id, {
    expand: ['items.data'],
  });
  const periodEnd = getSubscriptionPeriodEnd(expandedSub);
  const status = expandedSub.status;

  await connectToDatabase();
  const user = await findUserByStripeCustomer(stripe, customerId);
  if (!user) {
    if (status === 'active' || status === 'trialing') {
      logger.error(
        '[Stripe Webhook] subscription.updated — user not found for entitled subscription',
        {
          eventId,
          customerId,
          subscriptionId: subscription.id,
        }
      );
    } else {
      logger.warn('[Stripe Webhook] subscription.updated — user not found', {
        customerId,
      });
    }
    return;
  }

  user.stripeSubscriptionId = subscription.id;
  user.stripeSubscriptionStatus = status;
  applyBillingPeriodFromSubscription(user, expandedSub);

  if (periodEnd !== null) {
    extendSubscriptionExpiresAt(user, periodEnd);
  }

  if (status === 'active' || status === 'trialing') {
    if (!shouldSkipStripeDowngrade(user)) {
      user.subscriptionPlan = 'premium';
      user.subscriptionPaymentMethod = 'stripe';
      user.subscriptionProvider = 'stripe';
    }
  } else if (
    status === 'past_due' ||
    status === 'canceled' ||
    status === 'unpaid' ||
    status === 'incomplete_expired'
  ) {
    if (shouldSkipStripeDowngrade(user)) {
      logger.info(
        '[Stripe Webhook] subscription.updated — skipped downgrade; Apple/manual still active',
        { userId: String(user._id), status }
      );
    } else {
      const otherSub = await findEntitledStripeSubscription(
        stripe,
        customerId,
        subscription.id
      );
      if (otherSub) {
        applyEntitledStripeSubscription(user, otherSub);
        applyBillingPeriodFromSubscription(user, otherSub);
        logger.info(
          '[Stripe Webhook] subscription.updated — retained premium via another active subscription',
          { userId: String(user._id), failedSubId: subscription.id, activeSubId: otherSub.id }
        );
      } else {
        downgradeUserFromStripe(user);
      }
    }
  }

  await user.save();

  logger.info('[Stripe Webhook] subscription.updated', {
    userId: String(user._id),
    status,
    periodEnd,
  });
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  stripe: Stripe
): Promise<void> {
  const customerId = String(subscription.customer);

  await connectToDatabase();
  const user = await findUserByStripeCustomer(stripe, customerId);
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

  const otherSub = await findEntitledStripeSubscription(
    stripe,
    customerId,
    subscription.id
  );
  if (otherSub) {
    applyEntitledStripeSubscription(user, otherSub);
    applyBillingPeriodFromSubscription(user, otherSub);
    await user.save();
    logger.info(
      '[Stripe Webhook] subscription.deleted — retained premium via another active subscription',
      { userId: String(user._id), deletedSubId: subscription.id, activeSubId: otherSub.id }
    );
    return;
  }

  downgradeUserFromStripe(user);
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

async function handleInvoicePaid(invoice: Stripe.Invoice, stripe: Stripe): Promise<void> {
  if (!invoice.customer || !invoiceIsForSubscription(invoice)) return;

  const customerId = String(invoice.customer);
  const periodEnd = invoice.lines?.data?.[0]?.period?.end
    ? fromUnix(invoice.lines.data[0].period.end)
    : null;

  if (!periodEnd) return;

  await connectToDatabase();
  const user = await findUserByStripeCustomer(stripe, customerId);
  if (!user) {
    logger.warn('[Stripe Webhook] invoice.paid — user not found', { customerId });
    return;
  }

  extendSubscriptionExpiresAt(user, periodEnd);
  if (!shouldSkipStripeDowngrade(user)) {
    user.subscriptionPlan = 'premium';
    user.subscriptionPaymentMethod = 'stripe';
    user.subscriptionProvider = 'stripe';
    user.stripeSubscriptionStatus = 'active';
  }
  await user.save();

  logger.info('[Stripe Webhook] invoice.paid — expiry extended', {
    userId: String(user._id),
    periodEnd,
  });
}

async function handleSubscriptionScheduleCreated(
  schedule: Stripe.SubscriptionSchedule,
  stripe: Stripe
): Promise<void> {
  await connectToDatabase();
  const user = await findUserForSubscriptionSchedule(schedule, stripe);
  if (!user) {
    logger.warn(
      '[Stripe Webhook] subscription_schedule.created — user not found',
      {
        scheduleId: schedule.id,
        customerId: scheduleCustomerId(schedule),
        subscriptionId: scheduleSubscriptionId(schedule),
      }
    );
    return;
  }

  user.stripeScheduleId = schedule.id;
  await user.save();

  logger.info('[Stripe Webhook] subscription_schedule.created — stripeScheduleId set', {
    userId: String(user._id),
    scheduleId: schedule.id,
  });
}

async function handleSubscriptionScheduleCleared(
  schedule: Stripe.SubscriptionSchedule,
  stripe: Stripe,
  eventType: string
): Promise<void> {
  await connectToDatabase();
  const user = await findUserForSubscriptionSchedule(schedule, stripe);
  if (!user) {
    // Fall back: clear by schedule id if customer/sub lookup missed.
    const bySchedule = await User.findOne({ stripeScheduleId: schedule.id }).exec();
    if (!bySchedule) {
      logger.warn(`[Stripe Webhook] ${eventType} — user not found`, {
        scheduleId: schedule.id,
        customerId: scheduleCustomerId(schedule),
        subscriptionId: scheduleSubscriptionId(schedule),
      });
      return;
    }
    bySchedule.stripeScheduleId = undefined;
    await bySchedule.save();
    logger.info(`[Stripe Webhook] ${eventType} — stripeScheduleId cleared`, {
      userId: String(bySchedule._id),
      scheduleId: schedule.id,
    });
    return;
  }

  user.stripeScheduleId = undefined;
  await user.save();

  logger.info(`[Stripe Webhook] ${eventType} — stripeScheduleId cleared`, {
    userId: String(user._id),
    scheduleId: schedule.id,
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, stripe: Stripe): Promise<void> {
  if (!invoice.customer) return;

  const customerId = String(invoice.customer);
  const failingSubId = getInvoiceSubscriptionId(invoice);

  await connectToDatabase();
  const user = await findUserByStripeCustomer(stripe, customerId);
  if (!user) return;

  const otherSub = await findEntitledStripeSubscription(
    stripe,
    customerId,
    failingSubId
  );
  if (otherSub) {
    applyEntitledStripeSubscription(user, otherSub);
    applyBillingPeriodFromSubscription(user, otherSub);
    await user.save();
    logger.info(
      '[Stripe Webhook] invoice.payment_failed — retained premium via another active subscription',
      {
        userId: String(user._id),
        failingSubId,
        activeSubId: otherSub.id,
        invoiceId: invoice.id,
      }
    );
    return;
  }

  const downgraded = applyStripePaymentFailureDowngrade(user, 'past_due');
  await user.save();

  logger.warn('[Stripe Webhook] invoice.payment_failed — access revoked per policy', {
    userId: String(user._id),
    downgraded,
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
    await connectToDatabase();

    const alreadyProcessed = await StripeWebhookEvent.findOne({
      eventId: event.id,
    }).exec();
    if (alreadyProcessed) {
      return NextResponse.json(
        { received: true, duplicate: true },
        { status: 200 }
      );
    }

    const stripe = getStripe();

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
          stripe,
          event.id
        );
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
          stripe,
          event.id
        );
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, stripe);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice, stripe);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, stripe);
        break;

      case 'subscription_schedule.created':
        await handleSubscriptionScheduleCreated(
          event.data.object as Stripe.SubscriptionSchedule,
          stripe
        );
        break;

      case 'subscription_schedule.released':
      case 'subscription_schedule.canceled':
      case 'subscription_schedule.completed':
        await handleSubscriptionScheduleCleared(
          event.data.object as Stripe.SubscriptionSchedule,
          stripe,
          event.type
        );
        break;

      default:
        logger.info('[Stripe Webhook] Unhandled event type', { type: event.type });
    }

    // Record after successful handler so Stripe can retry on 500.
    try {
      await StripeWebhookEvent.create({
        eventId: event.id,
        type: event.type,
        processedAt: new Date(),
      });
    } catch (insertErr: unknown) {
      if (isDuplicateKeyError(insertErr)) {
        return NextResponse.json(
          { received: true, duplicate: true },
          { status: 200 }
        );
      }
      throw insertErr;
    }
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));
    logger.error('[Stripe Webhook] Error processing event', {
      type: event.type,
      eventId: event.id,
      error: e.message,
      stack: e.stack,
    });
    // Return 500 so Stripe retries the event (do not insert idempotency record).
    return NextResponse.json({ code: 'ServerError' }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
