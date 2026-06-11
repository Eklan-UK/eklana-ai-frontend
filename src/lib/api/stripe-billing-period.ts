import config from "@/lib/api/config";
import type { BillingPeriod } from "@/domain/subscriptions/subscription.types";

export function stripePriceIdForBillingPeriod(
  period: BillingPeriod
): string | undefined {
  switch (period) {
    case "monthly":
      return config.STRIPE_PREMIUM_MONTHLY_PRICE_ID;
    case "quarterly":
      return config.STRIPE_PREMIUM_QUARTERLY_PRICE_ID;
    case "annual":
      return config.STRIPE_PREMIUM_ANNUAL_PRICE_ID;
    default:
      return undefined;
  }
}

export function billingPeriodFromStripePriceId(
  priceId: string | null | undefined
): BillingPeriod | null {
  if (!priceId) return null;
  if (priceId === config.STRIPE_PREMIUM_MONTHLY_PRICE_ID) return "monthly";
  if (priceId === config.STRIPE_PREMIUM_QUARTERLY_PRICE_ID) return "quarterly";
  if (priceId === config.STRIPE_PREMIUM_ANNUAL_PRICE_ID) return "annual";
  return null;
}
