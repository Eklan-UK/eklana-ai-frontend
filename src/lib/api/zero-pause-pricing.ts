import config from '@/lib/api/config';
import type { BillingPeriod } from '@/domain/subscriptions/subscription.types';
import { resolveStripePriceId } from '@/lib/api/stripe-checkout-session';

export type ZeroPauseUserFields = {
  zeroPauseProducts?: string[] | null;
  zeroPauseDate?: Date | string | null;
  zeroPauseEndDate?: Date | string | null;
};

export type CheckoutPriceResolution =
  | {
      status: 'ok';
      priceId: string;
      billingPeriod: BillingPeriod;
      challengePricing: boolean;
    }
  | {
      status: 'challenge_period_not_allowed';
      message: string;
    }
  | {
      status: 'price_not_configured';
      billingPeriod: BillingPeriod;
      message: string;
    };

/** UTC calendar day at 00:00:00.000Z for consistent inclusive window checks. */
export function toUtcDayStart(value: Date | string): Date {
  const d = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Challenge (community ~US$1.99) pricing is active when the user has `challenge`
 * and `now` falls on an inclusive UTC calendar day in
 * `[zeroPauseDate, zeroPauseEndDate]`.
 */
export function isZeroPauseChallengePricingActive(
  user: ZeroPauseUserFields,
  now: Date = new Date()
): boolean {
  const products = user.zeroPauseProducts ?? [];
  if (!products.includes('challenge')) return false;
  if (!user.zeroPauseDate || !user.zeroPauseEndDate) return false;

  const start = toUtcDayStart(user.zeroPauseDate);
  const end = toUtcDayStart(user.zeroPauseEndDate);
  const today = toUtcDayStart(now);
  return today.getTime() >= start.getTime() && today.getTime() <= end.getTime();
}

/** @deprecated Use isZeroPauseChallengePricingActive */
export const isZeroPauseChallengeActive = isZeroPauseChallengePricingActive;

/**
 * Resolve Checkout price for a user. Challenge-active forces legacy monthly;
 * quarterly/annual while Challenge-active is rejected (caller → 400).
 * Otherwise uses the new price map (Maintainer / no Challenge cohort).
 */
export function resolveCheckoutPriceForUser(
  user: ZeroPauseUserFields,
  billingPeriod: BillingPeriod,
  now: Date = new Date()
): CheckoutPriceResolution {
  const challengePricing = isZeroPauseChallengePricingActive(user, now);

  if (challengePricing) {
    if (billingPeriod !== 'monthly') {
      return {
        status: 'challenge_period_not_allowed',
        message:
          'Challenge pricing is monthly only. Choose monthly billing during your Challenge window.',
      };
    }
    const priceId = config.STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY;
    if (!priceId) {
      return {
        status: 'price_not_configured',
        billingPeriod: 'monthly',
        message:
          'Subscription price is not configured for Challenge (legacy monthly).',
      };
    }
    return {
      status: 'ok',
      priceId,
      billingPeriod: 'monthly',
      challengePricing: true,
    };
  }

  const priceId = resolveStripePriceId(billingPeriod);
  if (!priceId) {
    return {
      status: 'price_not_configured',
      billingPeriod,
      message: `Subscription price is not configured for billing period: ${billingPeriod}.`,
    };
  }
  return {
    status: 'ok',
    priceId,
    billingPeriod,
    challengePricing: false,
  };
}

/**
 * If the Challenge window has ended (UTC day after endDate), remove `challenge`,
 * ensure `maintainer`, and keep start/end dates as history.
 * Does not call Stripe — caller schedules price migration when needed.
 */
export function applyZeroPauseChallengeExpiry(
  user: {
    zeroPauseProducts?: string[] | null;
    zeroPauseDate?: Date | string | null;
    zeroPauseEndDate?: Date | string | null;
  },
  now: Date = new Date()
): { expired: boolean } {
  const products = [...(user.zeroPauseProducts ?? [])];
  if (!products.includes('challenge')) return { expired: false };
  if (!user.zeroPauseEndDate) return { expired: false };

  const end = toUtcDayStart(user.zeroPauseEndDate);
  const today = toUtcDayStart(now);
  if (today.getTime() <= end.getTime()) return { expired: false };

  const next = products.filter((p) => p !== 'challenge');
  if (!next.includes('maintainer')) {
    next.push('maintainer');
  }
  user.zeroPauseProducts = next;
  return { expired: true };
}
