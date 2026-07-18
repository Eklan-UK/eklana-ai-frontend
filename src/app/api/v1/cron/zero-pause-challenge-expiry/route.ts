// GET /api/v1/cron/zero-pause-challenge-expiry
// Daily: expire Challenge windows → Maintainer; restore prior public plan at renewal.
// Auth: CRON_SECRET (Vercel) or ZERO_PAUSE_EXPIRY_CRON_SECRET (local)
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import config from '@/lib/api/config';
import User from '@/models/user';
import {
  authorizeCron,
  isCronConfigured,
  shouldCronDebug,
  sanitizeCronResult,
} from '@/lib/api/cron-auth';
import {
  applyZeroPauseChallengeExpiry,
  toUtcDayStart,
} from '@/lib/api/zero-pause-pricing';
import { syncStripeForZeroPauseMaintainerPricing } from '@/lib/api/stripe-challenge-pricing-sync';

const ROUTE_SECRET_ENV = 'ZERO_PAUSE_EXPIRY_CRON_SECRET';

function getStripe(): Stripe | null {
  if (!config.STRIPE_SECRET_KEY) return null;
  return new Stripe(config.STRIPE_SECRET_KEY, {
    apiVersion: '2026-04-22.dahlia',
  });
}

async function restoreMaintainerPricingIfLinked(
  stripe: Stripe,
  user: {
    _id: unknown;
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
    stripeScheduleId?: string | null;
    subscriptionBillingPeriod?: 'monthly' | 'quarterly' | 'annual' | null;
    zeroPausePriorStripePriceId?: string | null;
    zeroPausePriorBillingPeriod?: 'monthly' | 'quarterly' | 'annual' | null;
    save: () => Promise<unknown>;
  }
): Promise<'scheduled' | 'skipped' | 'error'> {
  if (!user.stripeSubscriptionId && !user.stripeCustomerId) return 'skipped';

  try {
    const result = await syncStripeForZeroPauseMaintainerPricing(stripe, user);
    if (
      result.status === 'skipped_no_subscription' ||
      result.status === 'skipped_price_not_configured' ||
      result.status === 'noop_already_target'
    ) {
      return 'skipped';
    }
    await user.save();
    if (result.status === 'scheduled_restore') return 'scheduled';
    return 'skipped';
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('zero-pause-challenge-expiry: maintainer restore failed', {
      userId: String(user._id),
      error: message,
    });
    return 'error';
  }
}

export async function GET(req: NextRequest) {
  if (!isCronConfigured(ROUTE_SECRET_ENV)) {
    return NextResponse.json(
      {
        code: 'NotConfigured',
        message:
          'Set CRON_SECRET (Vercel) or ZERO_PAUSE_EXPIRY_CRON_SECRET (local)',
      },
      { status: 503 }
    );
  }

  if (!authorizeCron(req, ROUTE_SECRET_ENV)) {
    return NextResponse.json(
      { code: 'Unauthorized', message: 'Invalid cron secret' },
      { status: 401 }
    );
  }

  await connectToDatabase();

  const now = new Date();
  const todayUtc = toUtcDayStart(now);
  const stripe = getStripe();

  // endDate stored as UTC midnight of the last inclusive day → expired when end < today
  const candidates = await User.find({
    zeroPauseProducts: 'challenge',
    zeroPauseEndDate: { $ne: null, $lt: todayUtc },
  })
    .select(
      'zeroPauseProducts zeroPauseDate zeroPauseEndDate stripeSubscriptionId stripeCustomerId stripeScheduleId subscriptionBillingPeriod zeroPausePriorStripePriceId zeroPausePriorBillingPeriod'
    )
    .exec();

  let expired = 0;
  let migrationsScheduled = 0;
  let migrationsSkipped = 0;
  const errors: string[] = [];
  const debug: unknown[] = [];

  for (const user of candidates) {
    try {
      const result = applyZeroPauseChallengeExpiry(user, now);
      if (!result.expired) continue;

      await user.save();
      expired++;

      let migration: 'scheduled' | 'skipped' | 'error' | 'none' = 'none';
      if (stripe && (user.stripeSubscriptionId || user.stripeCustomerId)) {
        migration = await restoreMaintainerPricingIfLinked(stripe, user);
        if (migration === 'scheduled') migrationsScheduled++;
        else if (migration === 'skipped') migrationsSkipped++;
        else if (migration === 'error') {
          errors.push(`migration:${String(user._id)}`);
        }
      }

      if (shouldCronDebug(req)) {
        debug.push({
          userId: String(user._id),
          migration,
          zeroPauseProducts: user.zeroPauseProducts,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${String(user._id)}: ${message}`);
      logger.error('zero-pause-challenge-expiry: user failed', {
        userId: String(user._id),
        error: message,
      });
    }
  }

  logger.info('zero-pause-challenge-expiry cron complete', {
    examined: candidates.length,
    expired,
    migrationsScheduled,
    migrationsSkipped,
    errorCount: errors.length,
  });

  const verbose = shouldCronDebug(req);
  return NextResponse.json({
    code: 'Success',
    ...sanitizeCronResult(
      {
        examined: candidates.length,
        sent: expired,
        skipped: candidates.length - expired,
        errors,
        debug,
      },
      verbose
    ),
    expired,
    migrationsScheduled,
    migrationsSkipped,
  });
}
