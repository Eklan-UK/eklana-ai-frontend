import Stripe from 'stripe';
import type { IUser } from '@/models/user';
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';
import User from '@/models/user';
import { billingPeriodFromStripePriceId } from '@/lib/api/stripe-billing-period';
import {
  fromStripeUnix,
  getStripeSubscriptionPeriodEnd,
  getStripeSubscriptionPeriodStart,
} from '@/lib/api/stripe-subscription';
import { applyAppleSubscriptionToUser } from '@/lib/api/apple-subscription-apply';
import {
  isAppleIapConfigured,
  resolveAppleSubscription,
} from '@/services/apple-app-store.service';
import {
  hasAppleBillingLink,
  hasStripeBillingLink,
} from '@/domain/subscriptions/subscription.types';

export type ProviderSyncSource = 'stripe' | 'apple' | 'manual' | 'skipped';

export interface ProviderSyncResult {
  userId: string;
  source: ProviderSyncSource;
  synced: boolean;
  error?: string;
}

function getStripeClient(): Stripe | null {
  if (!config.STRIPE_SECRET_KEY) return null;
  return new Stripe(config.STRIPE_SECRET_KEY, {
    apiVersion: '2026-04-22.dahlia',
  });
}

async function resolveStripeCustomerId(
  user: Pick<IUser, 'email' | 'stripeCustomerId'>,
  stripe: Stripe
): Promise<string | null> {
  const existing = user.stripeCustomerId?.trim();
  if (existing) return existing;

  const customers = await stripe.customers.list({
    email: user.email,
    limit: 5,
  });
  return customers.data[0]?.id ?? null;
}

export async function syncStripeSubscriptionForUser(
  user: IUser,
  stripe: Stripe
): Promise<ProviderSyncResult> {
  const userId = String(user._id);

  try {
    const stripeCustomerId = await resolveStripeCustomerId(user, stripe);
    if (!stripeCustomerId) {
      return {
        userId,
        source: 'stripe',
        synced: false,
        error: 'No Stripe customer found',
      };
    }

    user.stripeCustomerId = stripeCustomerId;

    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      limit: 10,
      expand: ['data.items.data'],
    });

    const activeSub = subscriptions.data.find(
      (sub) => sub.status === 'active' || sub.status === 'trialing'
    );

    if (!activeSub) {
      const latestSub = subscriptions.data[0];
      if (latestSub) {
        user.stripeSubscriptionId = latestSub.id;
        user.stripeSubscriptionStatus = latestSub.status;
      }
      return {
        userId,
        source: 'stripe',
        synced: false,
        error: latestSub
          ? `No active Stripe subscription (latest: ${latestSub.status})`
          : 'No Stripe subscriptions',
      };
    }

    const periodEnd =
      getStripeSubscriptionPeriodEnd(activeSub) ??
      new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    const periodStart =
      getStripeSubscriptionPeriodStart(activeSub) ?? fromStripeUnix(activeSub.created);

    user.stripeSubscriptionId = activeSub.id;
    user.stripeSubscriptionStatus = activeSub.status;
    user.subscriptionPlan = 'premium';
    user.subscriptionPaymentMethod = 'stripe';
    user.subscriptionProvider = 'stripe';
    user.subscriptionActivatedAt = periodStart;
    user.subscriptionExpiresAt = periodEnd;

    const billingPeriod = billingPeriodFromStripePriceId(
      activeSub.items?.data?.[0]?.price?.id
    );
    if (billingPeriod) {
      user.subscriptionBillingPeriod = billingPeriod;
    }

    return { userId, source: 'stripe', synced: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('[subscription-sync] Stripe sync failed', { userId, error: message });
    return { userId, source: 'stripe', synced: false, error: message };
  }
}

export async function syncAppleSubscriptionForUser(
  user: IUser
): Promise<ProviderSyncResult> {
  const userId = String(user._id);

  if (!isAppleIapConfigured()) {
    return {
      userId,
      source: 'apple',
      synced: false,
      error: 'Apple IAP not configured',
    };
  }

  const lookupId = user.appleOriginalTransactionId?.trim();
  if (!lookupId) {
    return {
      userId,
      source: 'apple',
      synced: false,
      error: 'No appleOriginalTransactionId',
    };
  }

  try {
    const verified = await resolveAppleSubscription({
      originalTransactionId: lookupId,
    });
    applyAppleSubscriptionToUser(user, verified);
    return { userId, source: 'apple', synced: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('[subscription-sync] Apple sync failed', { userId, error: message });
    return { userId, source: 'apple', synced: false, error: message };
  }
}

export async function syncUserSubscriptionFromProvider(
  user: IUser,
  stripe?: Stripe | null
): Promise<ProviderSyncResult> {
  if (hasAppleBillingLink(user)) {
    return syncAppleSubscriptionForUser(user);
  }

  if (hasStripeBillingLink(user) || user.email) {
    const client = stripe ?? getStripeClient();
    if (!client) {
      return {
        userId: String(user._id),
        source: 'stripe',
        synced: false,
        error: 'STRIPE_SECRET_KEY not configured',
      };
    }
    return syncStripeSubscriptionForUser(user, client);
  }

  return {
    userId: String(user._id),
    source: 'manual',
    synced: false,
  };
}

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}

export async function syncAllPremiumSubscriptionsFromProviders(): Promise<{
  results: ProviderSyncResult[];
  syncedCount: number;
  failedCount: number;
}> {
  const stripe = getStripeClient();

  const users = await User.find({
    role: 'user',
    $or: [
      { subscriptionPlan: 'premium' },
      { stripeCustomerId: { $exists: true, $nin: [null, ''] } },
      { stripeSubscriptionId: { $exists: true, $nin: [null, ''] } },
      { appleOriginalTransactionId: { $exists: true, $nin: [null, ''] } },
    ],
  }).exec();

  const results = await mapInBatches(users, 5, async (user) => {
    if (!hasAppleBillingLink(user) && !hasStripeBillingLink(user)) {
      if (!user.email || user.subscriptionPlan !== 'premium') {
        return {
          userId: String(user._id),
          source: 'skipped' as const,
          synced: false,
        };
      }
    }

    const result = await syncUserSubscriptionFromProvider(user, stripe);
    if (result.synced) {
      await user.save();
    } else if (
      result.source === 'stripe' &&
      user.isModified() &&
      (user.stripeCustomerId || user.stripeSubscriptionId)
    ) {
      await user.save();
    }
    return result;
  });

  const syncedCount = results.filter((r) => r.synced).length;
  const failedCount = results.filter(
    (r) => !r.synced && r.source !== 'skipped' && r.source !== 'manual'
  ).length;

  logger.info('[subscription-sync] Bulk provider sync complete', {
    total: users.length,
    syncedCount,
    failedCount,
  });

  return { results, syncedCount, failedCount };
}
