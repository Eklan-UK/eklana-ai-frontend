import type Stripe from 'stripe';

export type PriceMigrationSkipReason =
  | 'already_on_target_price'
  | 'already_has_schedule';

export type PriceMigrationResult =
  | { status: 'scheduled'; scheduleId: string }
  | { status: 'skipped'; reason: PriceMigrationSkipReason };

function priceIdFromPhaseItem(
  item: Stripe.SubscriptionSchedule.Phase.Item
): string | null {
  const price = item.price;
  if (typeof price === 'string') return price;
  if (price && typeof price === 'object' && 'id' in price) {
    return (price as { id: string }).id;
  }
  return null;
}

/**
 * Price that will apply after the current schedule phases finish
 * (last phase item). Used to detect Phase 7 “upgrade to $20” schedules.
 */
export function terminalPhasePriceId(
  schedule: Stripe.SubscriptionSchedule
): string | null {
  const phases = schedule.phases ?? [];
  if (phases.length === 0) return null;
  const last = phases[phases.length - 1];
  const item = last.items?.[0];
  if (!item) return null;
  return priceIdFromPhaseItem(item);
}

export function scheduleIdFromSubscription(
  schedule: Stripe.Subscription['schedule']
): string | null {
  if (!schedule) return null;
  return typeof schedule === 'string' ? schedule : schedule.id;
}

/** Release a subscription schedule so the sub keeps its current Price with no planned change. */
export async function releaseSubscriptionSchedule(
  stripe: Stripe,
  scheduleId: string
): Promise<void> {
  await stripe.subscriptionSchedules.release(scheduleId);
}

/**
 * Soft-migrate a subscription onto `targetPriceId` at `current_period_end`
 * via Subscription Schedules (`proration_behavior: 'none'`).
 *
 * Skips when already on the target price or when a schedule already exists
 * (caller should release bad schedules first).
 */
export async function schedulePriceMigrationAtRenewal(
  stripe: Stripe,
  subscriptionId: string,
  currentPriceId: string,
  targetPriceId: string,
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

  if (item.price.id === targetPriceId) {
    return { status: 'skipped', reason: 'already_on_target_price' };
  }
  if (subscription.schedule) {
    return { status: 'skipped', reason: 'already_has_schedule' };
  }

  const idempotencyKey =
    options?.idempotencyKey ??
    `price-migration-${subscriptionId}-${targetPriceId}`;

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
        end_date: currentPeriodEnd,
        proration_behavior: 'none',
      },
      {
        items: [{ price: targetPriceId, quantity: 1 }],
        proration_behavior: 'none',
      },
    ],
    end_behavior: 'release',
  });

  return { status: 'scheduled', scheduleId: schedule.id };
}
