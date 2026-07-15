import type Stripe from 'stripe';

export type PriceMigrationSkipReason =
  | 'already_new_price'
  | 'already_has_schedule';

export type PriceMigrationResult =
  | { status: 'scheduled'; scheduleId: string }
  | { status: 'skipped'; reason: PriceMigrationSkipReason };

/**
 * Soft-grandfather a legacy monthly subscription onto `newPriceId` at
 * `current_period_end` via Subscription Schedules (`proration_behavior: 'none'`).
 *
 * Do not mid-cycle `subscriptions.update` with default proration.
 */
export async function schedulePriceMigrationAtRenewal(
  stripe: Stripe,
  subscriptionId: string,
  legacyPriceId: string,
  newPriceId: string
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

  if (item.price.id === newPriceId) {
    return { status: 'skipped', reason: 'already_new_price' };
  }
  if (subscription.schedule) {
    return { status: 'skipped', reason: 'already_has_schedule' };
  }

  const schedule = await stripe.subscriptionSchedules.create(
    { from_subscription: subscriptionId },
    { idempotencyKey: `migration-2026-${subscriptionId}` }
  );

  await stripe.subscriptionSchedules.update(schedule.id, {
    proration_behavior: 'none',
    phases: [
      {
        items: [{ price: legacyPriceId, quantity: 1 }],
        start_date: currentPeriodStart,
        end_date: currentPeriodEnd,
        proration_behavior: 'none',
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
