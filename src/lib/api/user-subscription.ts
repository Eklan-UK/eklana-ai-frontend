import type { IUser } from "@/models/user";
import {
  isStripeStatusEntitled,
  STRIPE_NON_ENTITLED_STATUSES,
} from "@/lib/api/stripe-subscription-apply";
import { config } from "@/lib/api/config";

type SubscriptionUser = {
  _id?: unknown;
  email?: string | null;
  subscriptionPlan?: IUser["subscriptionPlan"] | null;
  /** Mongo Date or JSON-serialized ISO string from API responses. */
  subscriptionExpiresAt?: Date | string | null;
  stripeSubscriptionStatus?: string | null;
  subscriptionPaymentMethod?: string | null;
  appleSubscriptionStatus?: string | null;
  appleOriginalTransactionId?: string | null;
};

function expiresAtInFuture(
  subscriptionExpiresAt: SubscriptionUser["subscriptionExpiresAt"]
): boolean {
  if (!subscriptionExpiresAt) return false;
  const expiresAt =
    subscriptionExpiresAt instanceof Date
      ? subscriptionExpiresAt
      : new Date(subscriptionExpiresAt);
  return expiresAt.getTime() > Date.now();
}

function isAppleSubscriptionActive(user: SubscriptionUser): boolean {
  const status = user.appleSubscriptionStatus;
  if (
    status === "active" ||
    status === "billing_grace" ||
    status === "billing_retry"
  ) {
    return true;
  }

  const paidViaApple =
    user.subscriptionPaymentMethod === "apple" || !!user.appleOriginalTransactionId;
  if (paidViaApple && expiresAtInFuture(user.subscriptionExpiresAt)) {
    return true;
  }

  return false;
}

function isStripeSubscriptionActive(user: SubscriptionUser): boolean {
  const status = user.stripeSubscriptionStatus;

  if (status && STRIPE_NON_ENTITLED_STATUSES.has(status)) {
    return false;
  }

  if (isStripeStatusEntitled(status)) {
    return expiresAtInFuture(user.subscriptionExpiresAt);
  }

  const stripeLinked = user.subscriptionPaymentMethod === "stripe";
  if (stripeLinked) {
    return expiresAtInFuture(user.subscriptionExpiresAt);
  }

  return false;
}

export function isForeverPremiumUser(
  user: SubscriptionUser | null | undefined
): boolean {
  const email = user?.email?.trim().toLowerCase();
  if (!email) return false;
  return config.FOREVER_PREMIUM_EMAILS.includes(email);
}

export function isUserSubscribed(
  user: SubscriptionUser | null | undefined
): boolean {
  if (!user) return false;
  if (isForeverPremiumUser(user)) return true;
  if (user.subscriptionPlan !== "premium") return false;

  if (isAppleSubscriptionActive(user)) {
    return true;
  }

  const hasStripeSignal =
    user.subscriptionPaymentMethod === "stripe" ||
    user.stripeSubscriptionStatus != null;

  if (hasStripeSignal) {
    return isStripeSubscriptionActive(user);
  }

  if (user.subscriptionPaymentMethod === "manual") {
    return expiresAtInFuture(user.subscriptionExpiresAt);
  }

  return expiresAtInFuture(user.subscriptionExpiresAt);
}
