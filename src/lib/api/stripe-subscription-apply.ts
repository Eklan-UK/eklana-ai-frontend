import type { IUser } from '@/models/user';
import { shouldSkipStripeDowngrade } from '@/lib/api/subscription-reconciliation';

/** Stripe statuses that must never grant Pro access (immediate revocation policy). */
export const STRIPE_NON_ENTITLED_STATUSES = new Set([
  'past_due',
  'unpaid',
  'canceled',
  'incomplete_expired',
  'incomplete',
  'paused',
]);

export function isStripeStatusEntitled(status: string | null | undefined): boolean {
  if (!status) return false;
  if (STRIPE_NON_ENTITLED_STATUSES.has(status)) return false;
  return status === 'active' || status === 'trialing';
}

/** Downgrade a user from Stripe billing (does not clear stripeCustomerId). */
export function downgradeUserFromStripe(user: IUser): void {
  user.subscriptionPlan = 'free';
  user.subscriptionExpiresAt = null;
  user.subscriptionActivatedAt = null;
  if (user.subscriptionPaymentMethod === 'stripe') {
    user.subscriptionPaymentMethod = undefined;
    user.subscriptionProvider = undefined;
  }
}

/**
 * Apply immediate revocation on payment failure / past_due.
 * Returns true when the user was downgraded.
 */
export function applyStripePaymentFailureDowngrade(
  user: IUser,
  status: 'past_due' | 'unpaid' = 'past_due'
): boolean {
  user.stripeSubscriptionStatus = status;

  if (shouldSkipStripeDowngrade(user)) {
    return false;
  }

  downgradeUserFromStripe(user);
  return true;
}
