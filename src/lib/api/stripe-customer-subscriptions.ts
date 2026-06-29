import Stripe from 'stripe';
import type { IUser } from '@/models/user';
import { extendSubscriptionExpiresAt } from '@/lib/api/subscription-reconciliation';
import { isStripeStatusEntitled } from '@/lib/api/stripe-subscription-apply';

function fromUnix(ts: number): Date {
  return new Date(ts * 1000);
}

function getPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const ts = subscription.items?.data?.[0]?.current_period_end;
  return typeof ts === 'number' ? fromUnix(ts) : null;
}

/** Subscription id on an invoice (Dahlia parent details or legacy field). */
export function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parentSub = invoice.parent?.subscription_details?.subscription;
  if (parentSub) {
    return typeof parentSub === 'string' ? parentSub : parentSub.id;
  }
  const inv = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };
  if (inv.subscription) {
    return typeof inv.subscription === 'string' ? inv.subscription : inv.subscription.id;
  }
  for (const line of invoice.lines?.data ?? []) {
    const sub = (line as Stripe.InvoiceLineItem & { subscription?: string | null })
      .subscription;
    if (sub) return sub;
  }
  return null;
}

/**
 * Find an active/trialing subscription for a customer, optionally excluding one id
 * (e.g. the subscription that just failed or was deleted).
 */
export async function findEntitledStripeSubscription(
  stripe: Stripe,
  customerId: string,
  excludeSubscriptionId?: string | null
): Promise<Stripe.Subscription | null> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 20,
    expand: ['data.items.data'],
  });

  return (
    subscriptions.data.find(
      (s) =>
        s.id !== excludeSubscriptionId &&
        isStripeStatusEntitled(s.status)
    ) ?? null
  );
}

/**
 * When one subscription fails but the customer still has another entitled subscription,
 * sync the user to that subscription instead of downgrading.
 */
export function applyEntitledStripeSubscription(
  user: IUser,
  subscription: Stripe.Subscription
): void {
  const periodEnd =
    getPeriodEnd(subscription) ?? new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);

  user.stripeSubscriptionId = subscription.id;
  user.stripeSubscriptionStatus = subscription.status;
  user.subscriptionPlan = 'premium';
  user.subscriptionActivatedAt = user.subscriptionActivatedAt ?? fromUnix(subscription.created);
  extendSubscriptionExpiresAt(user, periodEnd);
  user.subscriptionPaymentMethod = 'stripe';
  user.subscriptionProvider = 'stripe';
}
