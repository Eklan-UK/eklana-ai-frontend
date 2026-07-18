import type { IUser } from '@/models/user';
import config from '@/lib/api/config';
import type Stripe from 'stripe';

export function getSubscriptionTrialLaunchDate(): Date | null {
  const raw = config.SUBSCRIPTION_TRIAL_LAUNCH_AT;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isEligibleForTrial(
  user: Pick<
    IUser,
    | 'createdAt'
    | 'subscriptionActivatedAt'
    | 'subscriptionProvider'
    | 'stripeSubscriptionId'
    | 'appleOriginalTransactionId'
  >
): boolean {
  const launch = getSubscriptionTrialLaunchDate();
  if (!launch) return false;

  const isPostLaunchAccount = user.createdAt >= launch;
  const neverHadAnySubscription =
    !user.subscriptionActivatedAt &&
    !user.subscriptionProvider &&
    !user.stripeSubscriptionId &&
    !user.appleOriginalTransactionId;

  return isPostLaunchAccount && neverHadAnySubscription;
}

export async function hasPriorStripeSubscriptions(
  stripe: Stripe,
  customerId: string
): Promise<boolean> {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 1,
  });
  return subs.data.length > 0;
}
