import type { IUser } from '@/models/user';

/** Milliseconds since epoch for `subscriptionExpiresAt`, or 0 if unset. */
export function subscriptionExpiresAtMs(
  user: Pick<IUser, 'subscriptionExpiresAt'> | null | undefined
): number {
  if (!user?.subscriptionExpiresAt) return 0;
  const d =
    user.subscriptionExpiresAt instanceof Date
      ? user.subscriptionExpiresAt
      : new Date(user.subscriptionExpiresAt as unknown as string);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Extend stored expiry only when the incoming date is later (idempotent). */
export function extendSubscriptionExpiresAt(
  user: Pick<IUser, 'subscriptionExpiresAt'>,
  incoming: Date
): void {
  if (incoming.getTime() > subscriptionExpiresAtMs(user)) {
    (user as IUser).subscriptionExpiresAt = incoming;
  }
}

/**
 * Stripe webhook wants to downgrade — skip if Apple (or manual) still has a valid
 * period end in the future (later `subscriptionExpiresAt` wins).
 */
export function shouldSkipStripeDowngrade(
  user: Pick<
    IUser,
    | 'subscriptionExpiresAt'
    | 'subscriptionPaymentMethod'
    | 'appleSubscriptionStatus'
    | 'appleOriginalTransactionId'
  >
): boolean {
  const expiresMs = subscriptionExpiresAtMs(user);
  if (expiresMs <= Date.now()) return false;

  if (user.subscriptionPaymentMethod === 'apple' || user.appleOriginalTransactionId) {
    const status = user.appleSubscriptionStatus;
    if (
      status === 'active' ||
      status === 'billing_grace' ||
      status === 'billing_retry'
    ) {
      return true;
    }
    if (expiresMs > Date.now()) return true;
  }

  if (user.subscriptionPaymentMethod === 'manual' && expiresMs > Date.now()) {
    return true;
  }

  return false;
}

/**
 * Apple notification wants to downgrade — skip if Stripe still reports active/trialing
 * or stored expiry is still in the future from Stripe.
 */
export function shouldSkipAppleDowngrade(
  user: Pick<
    IUser,
    | 'subscriptionExpiresAt'
    | 'subscriptionPaymentMethod'
    | 'stripeSubscriptionStatus'
    | 'stripeCustomerId'
  >
): boolean {
  const stripeStatus = user.stripeSubscriptionStatus;
  if (stripeStatus === 'active' || stripeStatus === 'trialing') {
    return true;
  }

  const expiresMs = subscriptionExpiresAtMs(user);
  if (
    expiresMs > Date.now() &&
    (user.subscriptionPaymentMethod === 'stripe' || user.stripeCustomerId)
  ) {
    return true;
  }

  if (user.subscriptionPaymentMethod === 'manual' && expiresMs > Date.now()) {
    return true;
  }

  return false;
}
