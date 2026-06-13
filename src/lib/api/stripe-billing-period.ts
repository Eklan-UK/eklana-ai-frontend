import type { BillingPeriod } from '@/domain/subscriptions/subscription.types';

/**
 * Maps a Stripe price ID to an internal BillingPeriod.
 *
 * Resolution order:
 *  1. Exact match against known price ID env vars.
 *  2. Keyword match inside the price ID string (e.g. "monthly", "annual", "yearly", "quarterly").
 *  3. Returns undefined when the period cannot be determined.
 */
export function billingPeriodFromStripePriceId(
  priceId: string | null | undefined
): BillingPeriod | undefined {
  if (!priceId) return undefined;

  // Exact match against configured price IDs
  const envMap: Array<[string | undefined, BillingPeriod]> = [
    [process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID, 'monthly'],
    [process.env.STRIPE_PREMIUM_QUARTERLY_PRICE_ID, 'quarterly'],
    [process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID, 'annual'],
  ];

  for (const [envPriceId, period] of envMap) {
    if (envPriceId && envPriceId === priceId) {
      return period;
    }
  }

  // Keyword fallback — useful during local dev or when env vars are not fully set
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
