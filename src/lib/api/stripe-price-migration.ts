import type Stripe from 'stripe';

export type PriceMigrationSkipReason =
  | 'already_on_target_price'
  | 'already_has_schedule';

export type PriceMigrationResult =
  | { status: 'scheduled'; scheduleId: string }
  | { status: 'skipped'; reason: PriceMigrationSkipReason };

/**
 * Soft-migrate a subscription onto `targetPriceId` at `current_period_end`
 * via Subscription Schedules (`proration_behavior: 'none'`).
 *
 * Skips when already on the target price or when a schedule already exists.
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
    options?.idempotencyKey ?? `price-migration-${subscriptionId}-${targetPriceId}`;

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
