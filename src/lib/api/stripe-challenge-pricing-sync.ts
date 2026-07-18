import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import type { BillingPeriod } from '@/domain/subscriptions/subscription.types';
import config from '@/lib/api/config';
import { findEntitledStripeSubscription } from '@/lib/api/stripe-customer-subscriptions';
import { logger } from '@/lib/api/logger';
import { billingPeriodFromStripePriceId } from '@/lib/api/stripe-billing-period';
import { schedulePriceChangeAtRenewal } from '@/lib/api/stripe-price-migration';

export type ZeroPausePricingSyncUser = {
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  stripeScheduleId?: string | null;
  subscriptionBillingPeriod?: BillingPeriod | null;
  zeroPauseEndDate?: Date | string | null;
  zeroPausePriorStripePriceId?: string | null;
  zeroPausePriorBillingPeriod?: BillingPeriod | null;
};

/** @deprecated Use ZeroPausePricingSyncUser */
export type ChallengePricingSyncUser = ZeroPausePricingSyncUser;

export type ChallengePricingSyncResult =
  | { status: 'noop_already_legacy' }
  | { status: 'released_schedule_only'; releasedScheduleId: string }
  | { status: 'scheduled_legacy'; scheduleId: string; releasedScheduleId?: string }
  | { status: 'skipped_no_subscription' }
  | { status: 'skipped_price_not_configured' };

export type MaintainerPricingSyncResult =
  | { status: 'noop_already_target'; targetPriceId: string }
  | { status: 'released_schedule_only'; releasedScheduleId: string; targetPriceId: string }
  | {
      status: 'scheduled_restore';
      scheduleId: string;
      targetPriceId: string;
      releasedScheduleId?: string;
    }
  | { status: 'skipped_no_subscription' }
  | { status: 'skipped_price_not_configured' };

export type ChallengePricingSyncOptions = {
  /** Unique per admin sync; defaults to a random cohort-sync key. */
  idempotencyKey?: string;
  /**
   * When true (entering Challenge from non-Challenge), refresh prior plan
   * from the current Stripe price. When false, keep an existing prior snapshot.
   */
  enteringFromNonChallenge?: boolean;
};

export type MaintainerPricingSyncOptions = {
  /** Unique per admin sync; defaults to a random cohort-sync key. */
  idempotencyKey?: string;
};

function publicPriceIdForBillingPeriod(
  period: BillingPeriod | null | undefined
): string | undefined {
  if (period === 'quarterly') {
    return config.STRIPE_PREMIUM_QUARTERLY_PRICE_ID;
  }
  if (period === 'annual') {
    return config.STRIPE_PREMIUM_ANNUAL_PRICE_ID;
  }
  if (period === 'monthly') {
    return config.STRIPE_PREMIUM_MONTHLY_PRICE_ID;
  }
  return undefined;
}

function resolveMaintainerTargetPriceId(
  user: ZeroPausePricingSyncUser
): string | undefined {
  const priorPrice = user.zeroPausePriorStripePriceId?.trim();
  if (priorPrice) return priorPrice;

  return (
    publicPriceIdForBillingPeriod(user.zeroPausePriorBillingPeriod) ??
    publicPriceIdForBillingPeriod(user.subscriptionBillingPeriod) ??
    config.STRIPE_PREMIUM_MONTHLY_PRICE_ID
  );
}

/**
 * Snapshot the subscriber's public plan so Maintainer restore can use it later.
 * Does not store the Challenge legacy price as "prior".
 */
function snapshotPriorPlanIfNeeded(
  user: ZeroPausePricingSyncUser,
  currentPriceId: string,
  legacyPriceId: string,
  enteringFromNonChallenge: boolean
): void {
  const shouldRefresh =
    enteringFromNonChallenge || !user.zeroPausePriorStripePriceId;

  if (!shouldRefresh) return;

  if (currentPriceId !== legacyPriceId) {
    user.zeroPausePriorStripePriceId = currentPriceId;
    user.zeroPausePriorBillingPeriod =
      billingPeriodFromStripePriceId(currentPriceId) ??
      user.subscriptionBillingPeriod ??
      null;
  } else if (!user.zeroPausePriorStripePriceId) {
    // Already on legacy with no prior — fall back to configured public monthly.
    const fallback =
      publicPriceIdForBillingPeriod(user.subscriptionBillingPeriod) ??
      config.STRIPE_PREMIUM_MONTHLY_PRICE_ID;
    if (fallback) {
      user.zeroPausePriorStripePriceId = fallback;
      user.zeroPausePriorBillingPeriod =
        user.subscriptionBillingPeriod ?? 'monthly';
    }
  }
}

async function resolveSubscriptionId(
  stripe: Stripe,
  user: ZeroPausePricingSyncUser
): Promise<string | null> {
  let subscriptionId = user.stripeSubscriptionId?.trim() || null;
  if (!subscriptionId && user.stripeCustomerId) {
    const entitled = await findEntitledStripeSubscription(
      stripe,
      user.stripeCustomerId
    );
    if (entitled) {
      subscriptionId = entitled.id;
      user.stripeSubscriptionId = entitled.id;
    }
  }
  return subscriptionId;
}

/**
 * When Challenge (~US$1.99 window) is assigned, ensure the next renewal bills
 * legacy monthly from any current public plan (monthly / quarterly / annual).
 * No mid-cycle proration. Snapshots prior plan for Maintainer restore.
 *
 * Mutates user Stripe/prior fields; caller saves.
 */
export async function syncStripeForZeroPauseChallengePricing(
  stripe: Stripe,
  user: ZeroPausePricingSyncUser,
  options?: ChallengePricingSyncOptions
): Promise<ChallengePricingSyncResult> {
  const legacyPriceId = config.STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY;
  if (!legacyPriceId) {
    return { status: 'skipped_price_not_configured' };
  }

  const subscriptionId = await resolveSubscriptionId(stripe, user);
  if (!subscriptionId) {
    return { status: 'skipped_no_subscription' };
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data'],
  });
  const item = subscription.items.data[0];
  if (!item) {
    throw new Error(
      `Subscription ${subscriptionId} has no items; cannot sync Challenge pricing`
    );
  }

  const currentPriceId = item.price.id;
  snapshotPriorPlanIfNeeded(
    user,
    currentPriceId,
    legacyPriceId,
    options?.enteringFromNonChallenge ?? false
  );

  const idempotencyKey =
    options?.idempotencyKey ??
    `cohort-sync-${subscriptionId}-${legacyPriceId}-${randomUUID()}`;

  const result = await schedulePriceChangeAtRenewal(
    stripe,
    subscriptionId,
    legacyPriceId,
    { idempotencyKey }
  );

  if (result.status === 'scheduled') {
    user.stripeScheduleId = result.scheduleId;
    return {
      status: 'scheduled_legacy',
      scheduleId: result.scheduleId,
      ...(result.releasedScheduleId
        ? { releasedScheduleId: result.releasedScheduleId }
        : {}),
    };
  }

  if (result.releasedScheduleId) {
    user.stripeScheduleId = undefined;
    return {
      status: 'released_schedule_only',
      releasedScheduleId: result.releasedScheduleId,
    };
  }

  return { status: 'noop_already_legacy' };
}

/**
 * When Challenge is removed (e.g. admin sets Maintainer), restore the
 * subscriber's prior public plan (US$20 / US$60 / $200) at next renewal.
 * No mid-cycle proration. Clears prior fields after a successful restore path.
 *
 * Mutates user Stripe/prior/billing-period fields; caller saves.
 */
export async function syncStripeForZeroPauseMaintainerPricing(
  stripe: Stripe,
  user: ZeroPausePricingSyncUser,
  options?: MaintainerPricingSyncOptions
): Promise<MaintainerPricingSyncResult> {
  const targetPriceId = resolveMaintainerTargetPriceId(user);
  if (!targetPriceId) {
    return { status: 'skipped_price_not_configured' };
  }

  const subscriptionId = await resolveSubscriptionId(stripe, user);
  if (!subscriptionId) {
    return { status: 'skipped_no_subscription' };
  }

  const idempotencyKey =
    options?.idempotencyKey ??
    `cohort-sync-${subscriptionId}-${targetPriceId}-${randomUUID()}`;

  const result = await schedulePriceChangeAtRenewal(
    stripe,
    subscriptionId,
    targetPriceId,
    { idempotencyKey }
  );

  const restoredPeriod =
    user.zeroPausePriorBillingPeriod ??
    billingPeriodFromStripePriceId(targetPriceId) ??
    user.subscriptionBillingPeriod ??
    'monthly';

  const clearPrior = () => {
    user.zeroPausePriorStripePriceId = null;
    user.zeroPausePriorBillingPeriod = null;
  };

  if (result.status === 'scheduled') {
    user.stripeScheduleId = result.scheduleId;
    user.subscriptionBillingPeriod = restoredPeriod;
    clearPrior();
    return {
      status: 'scheduled_restore',
      scheduleId: result.scheduleId,
      targetPriceId,
      ...(result.releasedScheduleId
        ? { releasedScheduleId: result.releasedScheduleId }
        : {}),
    };
  }

  user.subscriptionBillingPeriod = restoredPeriod;
  clearPrior();

  if (result.releasedScheduleId) {
    user.stripeScheduleId = undefined;
    return {
      status: 'released_schedule_only',
      releasedScheduleId: result.releasedScheduleId,
      targetPriceId,
    };
  }

  logger.info('Maintainer Stripe sync: already on restore target', {
    subscriptionId,
    targetPriceId,
  });

  return { status: 'noop_already_target', targetPriceId };
}

/** @deprecated Use syncStripeForZeroPauseChallengePricing */
export const syncStripeForZeroPauseChallenge = syncStripeForZeroPauseChallengePricing;
/** @deprecated Use syncStripeForZeroPauseMaintainerPricing */
export const syncStripeForZeroPauseMaintainer = syncStripeForZeroPauseMaintainerPricing;
