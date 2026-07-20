/**
 * Ensure every active/trialing Stripe subscription’s NEXT bill is monthly ~US$1.99.
 *
 * Fixes two cases:
 * 1) Sub still on $20 / $60 / $200 → schedule switch to $1.99 at period end
 * 2) Sub already on $1.99 but has an old Phase 7 schedule → next Portal payment
 *    shows US$20 → RELEASE that schedule so next bill stays $1.99
 *
 * Default is dry-run. Pass --execute to apply.
 *
 * Usage:
 *   npm run migrate:to-monthly-199
 *   npm run migrate:to-monthly-199 -- --execute
 *
 * Requires:
 *   STRIPE_SECRET_KEY
 *   STRIPE_PREMIUM_MONTHLY_PRICE_ID   (= target ~US$1.99)
 *
 * Optional:
 *   --only-price=price_1…   Only process subs currently on this Price
 */
import 'dotenv/config';
import Stripe from 'stripe';
import mongoose from 'mongoose';
import { connectToDatabase } from '../src/lib/api/db';
import User from '../src/models/user';
import { findUserByStripeCustomer } from '../src/lib/api/stripe-webhook-user';
import {
  releaseSubscriptionSchedule,
  scheduleIdFromSubscription,
  schedulePriceMigrationAtRenewal,
  terminalPhasePriceId,
} from '../src/lib/api/stripe-price-migration';

const STATUSES: Array<'active' | 'trialing'> = ['active', 'trialing'];

type Action =
  | 'noop'
  | 'release_bad_schedule'
  | 'schedule_to_199'
  | 'release_then_schedule_to_199';

function customerIdOf(sub: Stripe.Subscription): string {
  return typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
}

function isLikelyStripePriceId(id: string): boolean {
  return /^price_[A-Za-z0-9]{10,}$/.test(id);
}

function parseOnlyPriceFilter(): string | null {
  const arg = process.argv.find((a) => a.startsWith('--only-price='));
  if (!arg) return null;
  const id = arg.slice('--only-price='.length).trim();
  if (!isLikelyStripePriceId(id)) {
    console.error(
      `--only-price must be a real Stripe Price ID (price_1…), got: ${id}`
    );
    process.exit(1);
  }
  return id;
}

async function listAllEntitledSubscriptions(
  stripe: Stripe
): Promise<Stripe.Subscription[]> {
  const out: Stripe.Subscription[] = [];
  const seen = new Set<string>();

  for (const status of STATUSES) {
    for await (const sub of stripe.subscriptions.list({
      status,
      limit: 100,
      expand: ['data.items.data'],
    })) {
      if (seen.has(sub.id)) continue;
      seen.add(sub.id);
      out.push(sub);
    }
  }

  return out;
}

async function loadSchedule(
  stripe: Stripe,
  sub: Stripe.Subscription
): Promise<Stripe.SubscriptionSchedule | null> {
  const id = scheduleIdFromSubscription(sub.schedule);
  if (!id) return null;
  return stripe.subscriptionSchedules.retrieve(id);
}

async function bestEffortSetScheduleId(
  stripe: Stripe,
  sub: Stripe.Subscription,
  scheduleId: string | null
): Promise<string | null> {
  let user = await User.findOne({ stripeSubscriptionId: sub.id }).exec();
  if (!user) {
    user = await findUserByStripeCustomer(stripe, customerIdOf(sub));
  }
  if (!user) return null;

  user.stripeScheduleId = scheduleId ?? undefined;
  if (!user.stripeSubscriptionId) {
    user.stripeSubscriptionId = sub.id;
  }
  if (!user.stripeCustomerId) {
    user.stripeCustomerId = customerIdOf(sub);
  }
  await user.save();
  return String(user._id);
}

function decideAction(
  currentPriceId: string,
  targetPriceId: string,
  nextPhasePriceId: string | null
): Action {
  const hasBadNext =
    nextPhasePriceId != null && nextPhasePriceId !== targetPriceId;
  const onTarget = currentPriceId === targetPriceId;

  if (hasBadNext && onTarget) return 'release_bad_schedule';
  if (hasBadNext && !onTarget) return 'release_then_schedule_to_199';
  if (!hasBadNext && !onTarget && nextPhasePriceId === targetPriceId) {
    return 'noop';
  }
  if (!hasBadNext && !onTarget && nextPhasePriceId == null) {
    return 'schedule_to_199';
  }
  return 'noop';
}

async function main() {
  const execute = process.argv.includes('--execute');
  const onlyPrice = parseOnlyPriceFilter();

  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  const targetPriceId = process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID?.trim();

  if (!secret || !targetPriceId) {
    console.error(
      'Missing required env: STRIPE_SECRET_KEY, STRIPE_PREMIUM_MONTHLY_PRICE_ID'
    );
    process.exit(1);
  }

  if (!isLikelyStripePriceId(targetPriceId)) {
    console.error(
      `STRIPE_PREMIUM_MONTHLY_PRICE_ID does not look like a Stripe Price ID: ${targetPriceId}`
    );
    process.exit(1);
  }

  const stripe = new Stripe(secret, { apiVersion: '2026-04-22.dahlia' });

  await connectToDatabase();

  console.log(
    execute
      ? 'Mode: EXECUTE — release bad $20 schedules + ensure next bill is ~US$1.99'
      : 'Mode: DRY-RUN — no Stripe writes (pass --execute to apply)'
  );
  console.log({
    targetPriceId,
    discovery: onlyPrice
      ? `scan active/trialing where current price === ${onlyPrice}`
      : 'scan all active/trialing; fix next-phase ≠ $1.99 and current ≠ $1.99',
  });

  const allSubs = await listAllEntitledSubscriptions(stripe);
  console.log(
    `Scanned ${allSubs.length} active/trialing subscription(s) in Stripe`
  );

  const byPrice: Record<string, number> = {};
  for (const sub of allSubs) {
    const priceId = sub.items.data[0]?.price?.id ?? '(unknown)';
    byPrice[priceId] = (byPrice[priceId] ?? 0) + 1;
  }
  console.log('Current price breakdown:', byPrice);

  const toProcess = onlyPrice
    ? allSubs.filter((s) => s.items.data[0]?.price?.id === onlyPrice)
    : allSubs;

  let released = 0;
  let scheduled = 0;
  let noop = 0;
  let errors = 0;
  const actionCounts: Record<string, number> = {};

  for (const sub of toProcess) {
    const item = sub.items.data[0];
    const currentPriceId = item?.price?.id ?? '(unknown)';
    const periodEnd = item?.current_period_end
      ? new Date(item.current_period_end * 1000).toISOString()
      : null;

    try {
      const schedule = await loadSchedule(stripe, sub);
      const scheduleId = schedule?.id ?? null;
      const nextPhasePriceId = schedule
        ? terminalPhasePriceId(schedule)
        : null;
      const action = decideAction(
        currentPriceId,
        targetPriceId,
        nextPhasePriceId
      );
      actionCounts[action] = (actionCounts[action] ?? 0) + 1;

      if (action === 'noop') {
        noop += 1;
        console.log(
          JSON.stringify({
            dryRun: !execute,
            subscriptionId: sub.id,
            status: sub.status,
            currentPriceId,
            nextPhasePriceId,
            periodEnd,
            action: 'noop',
            scheduleId,
          })
        );
        continue;
      }

      if (!execute) {
        console.log(
          JSON.stringify({
            dryRun: true,
            subscriptionId: sub.id,
            status: sub.status,
            currentPriceId,
            nextPhasePriceId,
            periodEnd,
            action:
              action === 'release_bad_schedule'
                ? 'would_release_bad_schedule'
                : action === 'release_then_schedule_to_199'
                  ? 'would_release_then_schedule_to_199'
                  : 'would_schedule_to_199',
            scheduleId,
            targetPriceId,
          })
        );
        if (
          action === 'release_bad_schedule' ||
          action === 'release_then_schedule_to_199'
        ) {
          released += 1;
        }
        if (
          action === 'schedule_to_199' ||
          action === 'release_then_schedule_to_199'
        ) {
          scheduled += 1;
        }
        continue;
      }

      if (
        (action === 'release_bad_schedule' ||
          action === 'release_then_schedule_to_199') &&
        scheduleId
      ) {
        await releaseSubscriptionSchedule(stripe, scheduleId);
        await bestEffortSetScheduleId(stripe, sub, null);
        released += 1;
      }

      if (
        action === 'schedule_to_199' ||
        action === 'release_then_schedule_to_199'
      ) {
        const result = await schedulePriceMigrationAtRenewal(
          stripe,
          sub.id,
          currentPriceId,
          targetPriceId,
          { idempotencyKey: `migrate-to-199-${sub.id}-${Date.now()}` }
        );
        if (result.status === 'scheduled') {
          await bestEffortSetScheduleId(stripe, sub, result.scheduleId);
          scheduled += 1;
          console.log(
            JSON.stringify({
              subscriptionId: sub.id,
              status: sub.status,
              currentPriceId,
              nextPhasePriceId,
              periodEnd,
              action,
              result: 'scheduled',
              scheduleId: result.scheduleId,
              targetPriceId,
            })
          );
        } else {
          console.log(
            JSON.stringify({
              subscriptionId: sub.id,
              status: sub.status,
              currentPriceId,
              nextPhasePriceId,
              periodEnd,
              action,
              result: 'skipped_after_release',
              reason: result.reason,
            })
          );
        }
        continue;
      }

      console.log(
        JSON.stringify({
          subscriptionId: sub.id,
          status: sub.status,
          currentPriceId,
          nextPhasePriceId,
          periodEnd,
          action: 'release_bad_schedule',
          result: 'released',
          releasedScheduleId: scheduleId,
          note: 'Next bill stays on current ~US$1.99 Price',
        })
      );
    } catch (err: unknown) {
      errors += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          subscriptionId: sub.id,
          result: 'error',
          error: message,
        })
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: execute ? 'execute' : 'dry-run',
        scanned: allSubs.length,
        processed: toProcess.length,
        noop,
        released,
        scheduled,
        errors,
        actionCounts,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
  if (errors > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
