import config from '@/lib/api/config';
import type { BillingPeriod } from '@/domain/subscriptions/subscription.types';

export function resolveStripePriceId(
  billingPeriod: BillingPeriod
): string | undefined {
  const map: Record<BillingPeriod, string | undefined> = {
    monthly: config.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
    quarterly: config.STRIPE_PREMIUM_QUARTERLY_PRICE_ID,
    annual: config.STRIPE_PREMIUM_ANNUAL_PRICE_ID,
  };
  return map[billingPeriod];
}

export function subscriptionDataForCheckout(
  eligibleForTrial: boolean,
  userId: string
):
  | {
      trial_period_days: number;
      metadata: { userId: string };
    }
  | undefined {
  if (!eligibleForTrial) return undefined;
  return {
    trial_period_days: 14,
    metadata: { userId },
  };
}
