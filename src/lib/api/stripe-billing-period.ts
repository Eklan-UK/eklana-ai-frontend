import type { BillingPeriod } from '@/domain/subscriptions/subscription.types';

/**
 * Maps a Stripe price ID to an internal BillingPeriod.
 *
 * New checkouts always use STRIPE_PREMIUM_MONTHLY_PRICE_ID (~US$1.99).
 * Keyword / optional env fallbacks keep display correct for existing
 * $20 / $60 / $200 subscribers left on older Prices.
 *
 * Resolution order:
 *  1. Exact match against known price ID env vars.
 *  2. Keyword match inside the price ID string.
 *  3. Returns undefined when the period cannot be determined.
 */
export function billingPeriodFromStripePriceId(
  priceId: string | null | undefined
): BillingPeriod | undefined {
  if (!priceId) return undefined;

  // Exact match — monthly is required for new checkouts; others optional for grandfathered subs.
  const envMap: Array<[string | undefined, BillingPeriod]> = [
    [process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID, 'monthly'],
    [process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY, 'monthly'],
    [process.env.STRIPE_PREMIUM_QUARTERLY_PRICE_ID, 'quarterly'],
    [process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID, 'annual'],
  ];

  for (const [envPriceId, period] of envMap) {
    if (envPriceId && envPriceId === priceId) {
      return period;
    }
  }

  const lower = priceId.toLowerCase();
  if (lower.includes('annual') || lower.includes('yearly') || lower.includes('year')) {
    return 'annual';
  }
  if (lower.includes('quarter')) {
    return 'quarterly';
  }
  if (lower.includes('month')) {
    return 'monthly';
  }

  return undefined;
}

/** Assign `subscriptionBillingPeriod` from a Stripe price ID when mappable. */
export function applyBillingPeriodFromPriceId(
  user: { subscriptionBillingPeriod?: BillingPeriod | null },
  priceId: string | null | undefined
): void {
  const billingPeriod = billingPeriodFromStripePriceId(priceId);
  if (billingPeriod) {
    user.subscriptionBillingPeriod = billingPeriod;
  }
}
