import Stripe from 'stripe';

export function fromStripeUnix(ts: number): Date {
  return new Date(ts * 1000);
}

/**
 * In Stripe API 2026-04-22 (dahlia) period fields live on each SubscriptionItem.
 */
export function getStripeSubscriptionPeriodEnd(
  subscription: Stripe.Subscription
): Date | null {
  const ts = subscription.items?.data?.[0]?.current_period_end;
  return typeof ts === 'number' ? fromStripeUnix(ts) : null;
}

export function getStripeSubscriptionPeriodStart(
  subscription: Stripe.Subscription
): Date | null {
  const ts = subscription.items?.data?.[0]?.current_period_start;
  return typeof ts === 'number' ? fromStripeUnix(ts) : null;
}
