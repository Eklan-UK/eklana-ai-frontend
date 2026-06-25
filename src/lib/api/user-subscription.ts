import type { IUser } from "@/models/user";
import {
  isStripeStatusEntitled,
  STRIPE_NON_ENTITLED_STATUSES,
} from "@/lib/api/stripe-subscription-apply";

type SubscriptionUser = Pick<IUser, "subscriptionPlan" | "subscriptionExpiresAt"> & {
  stripeSubscriptionStatus?: string | null;
  subscriptionPaymentMethod?: string | null;
  appleSubscriptionStatus?: string | null;
  appleOriginalTransactionId?: string | null;
};

function expiresAtInFuture(
  subscriptionExpiresAt: IUser["subscriptionExpiresAt"]
): boolean {
  if (!subscriptionExpiresAt) return false;
  const expiresAt =
    subscriptionExpiresAt instanceof Date
      ? subscriptionExpiresAt
      : new Date(subscriptionExpiresAt as unknown as string);
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

export function isUserSubscribed(
  user: SubscriptionUser | null | undefined
): boolean {
  if (!user) return false;
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
