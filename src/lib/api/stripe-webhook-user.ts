import Stripe from 'stripe';
import { Types } from 'mongoose';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';

/**
 * Resolve platform user for a Stripe customer id.
 * 1. stripeCustomerId on User
 * 2. metadata.userId on Stripe Customer
 * 3. email match on Stripe Customer → User
 */
export async function findUserByStripeCustomer(
  stripe: Stripe,
  customerId: string
) {
  let user = await User.findOne({ stripeCustomerId: customerId }).exec();
  if (user) return user;

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      return null;
    }

    const userId = customer.metadata?.userId;
    if (userId && Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId).exec();
      if (user) {
        user.stripeCustomerId = customerId;
        logger.info('[Stripe Webhook] Resolved user via customer metadata.userId', {
          customerId,
          userId,
        });
        return user;
      }
    }

    const email = customer.email?.trim().toLowerCase();
    if (email) {
      user = await User.findOne({ email }).exec();
      if (user) {
        user.stripeCustomerId = customerId;
        logger.info('[Stripe Webhook] Resolved user via customer email', {
          customerId,
          email,
        });
        return user;
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[Stripe Webhook] Customer retrieve failed during user lookup', {
      customerId,
      error: message,
    });
  }

  return null;
}
