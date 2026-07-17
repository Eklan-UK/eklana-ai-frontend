import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';

export type PriceMigrationSkipReason =
  | 'already_new_price'
  | 'already_has_schedule';

export type PriceMigrationResult =
  | { status: 'scheduled'; scheduleId: string }
  | { status: 'skipped'; reason: PriceMigrationSkipReason };

export type PriceChangeAtRenewalSkipReason = 'already_on_target_price';

export type PriceChangeAtRenewalResult =
  | {
      status: 'scheduled';
      scheduleId: string;
      releasedScheduleId?: string;
    }
  | {
      status: 'skipped';
      reason: PriceChangeAtRenewalSkipReason;
      releasedScheduleId?: string;
    };

function scheduleIdFromSubscription(
  schedule: string | Stripe.SubscriptionSchedule | null | undefined
): string | null {
  if (!schedule) return null;
  return typeof schedule === 'string' ? schedule : schedule.id;
}

/**
 * When updating schedule phases on a trialing subscription, Stripe requires
 * `trial_end` on the current phase. Omitting it can end the trial immediately.
 * Prefer the entire-phase-is-trial pattern when `trial_end` already matches
 * period end (set phase `end_date` ≥ `trial_end`).
 */
function phase1TrialPreserve(
  subscription: Pick<Stripe.Subscription, 'status' | 'trial_end'>,
  currentPeriodEnd: number
): { end_date: number; trial_end?: number } {
  if (
    subscription.status === 'trialing' &&
    typeof subscription.trial_end === 'number'
  ) {
    const end_date = Math.max(currentPeriodEnd, subscription.trial_end);
    return { end_date, trial_end: subscription.trial_end };
  }
  return { end_date: currentPeriodEnd };
}

/**
 * Soft-switch any current price onto `targetPriceId` at `current_period_end`
 * via Subscription Schedules (`proration_behavior: 'none'`).
 *
 * Releases an existing schedule first when present. Phase 1 keeps the
 * **current** item price until period end; phase 2 is the target.
 *
 * Prefer a unique `idempotencyKey` per admin/cohort sync so Stripe does not
 * replay a cached create from an earlier toggle.
 */
export async function schedulePriceChangeAtRenewal(
  stripe: Stripe,
  subscriptionId: string,
  targetPriceId: string,
  options?: { idempotencyKey?: string }
): Promise<PriceChangeAtRenewalResult> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data'],
  });
  const item = subscription.items.data[0];
  if (!item) {
    throw new Error(
      `Subscription ${subscriptionId} has no items; cannot schedule price change`
    );
  }

  const currentPriceId = item.price.id;
  const existingScheduleId = scheduleIdFromSubscription(subscription.schedule);
  let releasedScheduleId: string | undefined;

  if (existingScheduleId) {
    await stripe.subscriptionSchedules.release(existingScheduleId);
    releasedScheduleId = existingScheduleId;
  }

  if (currentPriceId === targetPriceId) {
    return {
      status: 'skipped',
      reason: 'already_on_target_price',
      ...(releasedScheduleId ? { releasedScheduleId } : {}),
    };
  }

  const currentPeriodStart = item.current_period_start;
  const currentPeriodEnd = item.current_period_end;
  const phase1Trial = phase1TrialPreserve(subscription, currentPeriodEnd);
  const idempotencyKey =
    options?.idempotencyKey ??
    `price-change-${subscriptionId}-${targetPriceId}-${randomUUID()}`;

  const schedule = await stripe.subscriptionSchedules.create(
    { from_subscription: subscriptionId },
    { idempotencyKey }
  );

  await stripe.subscriptionSchedules.update(schedule.id, {
    proration_behavior: 'none',
    phases: [
      {
        items: [{ price: currentPriceId, quantity: 1 }],
        start_date: currentPeriodStart,
        end_date: phase1Trial.end_date,
        proration_behavior: 'none',
        ...(phase1Trial.trial_end != null
          ? { trial_end: phase1Trial.trial_end }
          : {}),
      },
      {
        items: [{ price: targetPriceId, quantity: 1 }],
        proration_behavior: 'none',
      },
    ],
    end_behavior: 'release',
  });

  return {
    status: 'scheduled',
    scheduleId: schedule.id,
    ...(releasedScheduleId ? { releasedScheduleId } : {}),
  };
}

/**
 * Soft-grandfather a legacy monthly subscription onto `newPriceId` at
 * `current_period_end` via Subscription Schedules (`proration_behavior: 'none'`).
 *
 * Do not mid-cycle `subscriptions.update` with default proration.
 * Kept for Phase 7 bulk migrate CLI (skips when a schedule already exists).
 */
export async function schedulePriceMigrationAtRenewal(
  stripe: Stripe,
  subscriptionId: string,
  legacyPriceId: string,
  newPriceId: string,
  options?: { idempotencyKey?: string }
): Promise<PriceMigrationResult> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data'],
  });
  const item = subscription.items.data[0];
  if (!item) {
    throw new Error(
      `Subscription ${subscriptionId} has no items; cannot schedule price migration`
    );
  }

  const currentPeriodStart = item.current_period_start;
  const currentPeriodEnd = item.current_period_end;
  const phase1Trial = phase1TrialPreserve(subscription, currentPeriodEnd);

  if (item.price.id === newPriceId) {
    return { status: 'skipped', reason: 'already_new_price' };
  }
  if (subscription.schedule) {
    return { status: 'skipped', reason: 'already_has_schedule' };
  }

  const schedule = await stripe.subscriptionSchedules.create(
    { from_subscription: subscriptionId },
    {
      idempotencyKey:
        options?.idempotencyKey ?? `migration-2026-${subscriptionId}`,
    }
  );

  await stripe.subscriptionSchedules.update(schedule.id, {
    proration_behavior: 'none',
    phases: [
      {
        items: [{ price: legacyPriceId, quantity: 1 }],
        start_date: currentPeriodStart,
        end_date: phase1Trial.end_date,
        proration_behavior: 'none',
        ...(phase1Trial.trial_end != null
          ? { trial_end: phase1Trial.trial_end }
          : {}),
      },
      {
        items: [{ price: newPriceId, quantity: 1 }],
        proration_behavior: 'none',
      },
    ],
    end_behavior: 'release',
  });

  return { status: 'scheduled', scheduleId: schedule.id };
}
