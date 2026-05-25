import type { IUser } from '@/models/user';
import {
  extendSubscriptionExpiresAt,
  shouldSkipAppleDowngrade,
} from '@/lib/api/subscription-reconciliation';
import {
  isAppleStatusPremium,
  type AppleSubscriptionStatusString,
  type VerifiedAppleSubscription,
} from '@/services/apple-app-store.service';

/** Apply verified Apple subscription state to a user document (verify + webhooks). */
export function applyAppleSubscriptionToUser(
  user: IUser,
  verified: VerifiedAppleSubscription,
  options?: { allowDowngrade?: boolean }
): void {
  user.appleOriginalTransactionId = verified.originalTransactionId;
  user.appleLatestTransactionId = verified.latestTransactionId;
  user.appleSubscriptionStatus = verified.appleSubscriptionStatus;
  user.subscriptionProvider = 'apple';

  if (verified.expiresAt) {
    extendSubscriptionExpiresAt(user, verified.expiresAt);
  }

  if (isAppleStatusPremium(verified.appleSubscriptionStatus)) {
    user.subscriptionPlan = 'premium';
    user.subscriptionPaymentMethod = 'apple';
    if (!user.subscriptionActivatedAt) {
      user.subscriptionActivatedAt = new Date();
    }
    return;
  }

  if (options?.allowDowngrade && !shouldSkipAppleDowngrade(user)) {
    downgradeUserFromApple(user);
  }
}

export function downgradeUserFromApple(user: IUser): void {
  user.subscriptionPlan = 'free';
  user.appleSubscriptionStatus = 'expired';
  user.subscriptionExpiresAt = null;
  user.subscriptionActivatedAt = null;
  user.appleLatestTransactionId = undefined;
  if (user.subscriptionPaymentMethod === 'apple') {
    user.subscriptionPaymentMethod = undefined;
    user.subscriptionProvider = undefined;
  }
}

export function applyAppleStatusFromWebhook(
  user: IUser,
  status: AppleSubscriptionStatusString,
  expiresAt: Date | null
): void {
  user.appleSubscriptionStatus = status;

  if (expiresAt) {
    extendSubscriptionExpiresAt(user, expiresAt);
  }

  if (isAppleStatusPremium(status)) {
    user.subscriptionPlan = 'premium';
    user.subscriptionPaymentMethod = 'apple';
    user.subscriptionProvider = 'apple';
    if (!user.subscriptionActivatedAt) {
      user.subscriptionActivatedAt = new Date();
    }
    return;
  }

  if (!shouldSkipAppleDowngrade(user)) {
    downgradeUserFromApple(user);
  }
}
