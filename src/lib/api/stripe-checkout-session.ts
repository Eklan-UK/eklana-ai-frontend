import config from '@/lib/api/config';

/** Resolve the single monthly Pro Price ID used for all new checkouts (~US$1.99). */
export function resolveStripePriceId(): string | undefined {
  return config.STRIPE_PREMIUM_MONTHLY_PRICE_ID;
}
