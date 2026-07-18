/**
 * Soft-migrate Stripe subscriptions on the former public prices
 * (US$20 monthly / US$60 quarterly / $200 annual) onto monthly ~US$1.99
 * at each sub's current_period_end via Subscription Schedules.
 *
 * No mid-cycle proration. Default is dry-run. Pass --execute to apply.
 *
 * Usage (from repo root, env in .env):
 *   npx tsx scripts/stripe-migrate-to-monthly-199.ts
 *   npx tsx scripts/stripe-migrate-to-monthly-199.ts --execute
 *   npm run migrate:to-monthly-199
 *   npm run migrate:to-monthly-199 -- --execute
 *
 * Requires:
 *   STRIPE_SECRET_KEY
 *   STRIPE_PREMIUM_MONTHLY_PRICE_ID   (= target ~US$1.99, real id like price_1ABC…)
 *
 * Source Price IDs (real Stripe ids — not placeholders like price_20):
 *   1) --from=price_1…,price_1…,price_1…
 *   2) STRIPE_MIGRATE_FROM_PRICE_IDS=price_1…,price_1…
 *   3) Or leave those empty and the script uses (when set):
 *        STRIPE_PREMIUM_QUARTERLY_PRICE_ID
 *        STRIPE_PREMIUM_ANNUAL_PRICE_ID
 *        STRIPE_MIGRATE_FROM_MONTHLY_PRICE_ID  (former US$20 monthly Price)
 *
 * Get IDs from Stripe Dashboard → Product catalog → Prices.
 */
import 'dotenv/config';
import Stripe from 'stripe';
import mongoose from 'mongoose';
import { connectToDatabase } from '../src/lib/api/db';
import User from '../src/models/user';
import { findUserByStripeCustomer } from '../src/lib/api/stripe-webhook-user';
import { schedulePriceMigrationAtRenewal } from '../src/lib/api/stripe-price-migration';

const STATUSES: Array<'active' | 'trialing'> = ['active', 'trialing'];

function customerIdOf(sub: Stripe.Subscription): string {
  return typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
}

/** Real Stripe Price ids look like price_1TX3NUBFBiNiR6gZEMcK3Cjd — not price_20. */
function isLikelyStripePriceId(id: string): boolean {
  return /^price_[A-Za-z0-9]{10,}$/.test(id);
}

function parseFromPriceIds(targetPriceId: string): string[] {
  const fromArg = process.argv.find((a) => a.startsWith('--from='));
  const explicitRaw =
    fromArg?.slice('--from='.length) ??
    process.env.STRIPE_MIGRATE_FROM_PRICE_IDS ??
    '';
  const explicit = explicitRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const fallback = [
    process.env.STRIPE_MIGRATE_FROM_MONTHLY_PRICE_ID,
    process.env.STRIPE_PREMIUM_QUARTERLY_PRICE_ID,
    process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID,
  ]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));

  const preferred =
    explicit.length > 0 && explicit.every(isLikelyStripePriceId)
      ? explicit
      : explicit.length > 0
        ? [] // explicit but invalid — handled below
        : fallback;

  if (explicit.length > 0 && preferred.length === 0) {
    const bad = explicit.filter((id) => !isLikelyStripePriceId(id));
    console.error(
      'STRIPE_MIGRATE_FROM_PRICE_IDS has invalid placeholder(s): ' +
        bad.join(', ') +
        '\nUse real Stripe Price IDs from the Dashboard (e.g. price_1TX3NUBFBiNiR6gZEMcK3Cjd), ' +
        'or unset STRIPE_MIGRATE_FROM_PRICE_IDS and set:\n' +
        '  STRIPE_MIGRATE_FROM_MONTHLY_PRICE_ID  (former US$20)\n' +
        '  STRIPE_PREMIUM_QUARTERLY_PRICE_ID\n' +
        '  STRIPE_PREMIUM_ANNUAL_PRICE_ID'
    );
    process.exit(1);
  }

  const ids = preferred.filter(
    (id) => isLikelyStripePriceId(id) && id !== targetPriceId
  );
  return [...new Set(ids)];
}

async function listSubscriptionsOnPrice(
  stripe: Stripe,
  priceId: string
): Promise<Stripe.Subscription[]> {
  const out: Stripe.Subscription[] = [];
  const seen = new Set<string>();

  for (const status of STATUSES) {
    for await (const sub of stripe.subscriptions.list({
      price: priceId,
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

async function bestEffortSetScheduleId(
  stripe: Stripe,
  sub: Stripe.Subscription,
  scheduleId: string
): Promise<string | null> {
  let user = await User.findOne({ stripeSubscriptionId: sub.id }).exec();
  if (!user) {
    user = await findUserByStripeCustomer(stripe, customerIdOf(sub));
  }
  if (!user) return null;

  user.stripeScheduleId = scheduleId;
  if (!user.stripeSubscriptionId) {
    user.stripeSubscriptionId = sub.id;
  }
  if (!user.stripeCustomerId) {
    user.stripeCustomerId = customerIdOf(sub);
  }
  await user.save();
  return String(user._id);
}

async function main() {
  const execute = process.argv.includes('--execute');

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

  const fromPriceIds = parseFromPriceIds(targetPriceId);

  if (fromPriceIds.length === 0) {
    console.error(
      'No source Price IDs. Either:\n' +
        '  - Set STRIPE_MIGRATE_FROM_PRICE_IDS to real ids (comma-separated), or\n' +
        '  - Set STRIPE_MIGRATE_FROM_MONTHLY_PRICE_ID + STRIPE_PREMIUM_QUARTERLY_PRICE_ID + STRIPE_PREMIUM_ANNUAL_PRICE_ID\n' +
        'Find them in Stripe Dashboard → Product catalog → each Price → copy ID (price_1…).'
    );
    process.exit(1);
  }

  const stripe = new Stripe(secret, { apiVersion: '2026-04-22.dahlia' });

  await connectToDatabase();

  console.log(
    execute
      ? 'Mode: EXECUTE — will create Subscription Schedules → monthly ~US$1.99'
      : 'Mode: DRY-RUN — no Stripe writes (pass --execute to apply)'
  );
  console.log({ targetPriceId, fromPriceIds });

  const subs: Stripe.Subscription[] = [];
  const seen = new Set<string>();
  for (const priceId of fromPriceIds) {
    try {
      const found = await listSubscriptionsOnPrice(stripe, priceId);
      console.log(`  ${priceId}: ${found.length} active/trialing sub(s)`);
      for (const sub of found) {
        if (seen.has(sub.id)) continue;
        seen.add(sub.id);
        subs.push(sub);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ${priceId}: SKIPPED (Stripe error: ${message})`);
    }
  }

  console.log(
    `Found ${subs.length} active/trialing subscription(s) on source price(s)`
  );

  let scheduled = 0;
  let skipped = 0;
  let errors = 0;
  const skipReasons: Record<string, number> = {};

  for (const sub of subs) {
    const item = sub.items.data[0];
    const priceId = item?.price?.id ?? '(unknown)';
    const periodEnd = item?.current_period_end
      ? new Date(item.current_period_end * 1000).toISOString()
      : null;

    try {
      if (!execute) {
        if (priceId === targetPriceId) {
          skipped += 1;
          skipReasons.already_on_target_price =
            (skipReasons.already_on_target_price ?? 0) + 1;
          console.log(
            JSON.stringify({
              dryRun: true,
              subscriptionId: sub.id,
              status: sub.status,
              priceId,
              periodEnd,
              result: 'skipped',
              reason: 'already_on_target_price',
            })
          );
          continue;
        }
        if (sub.schedule) {
          skipped += 1;
          skipReasons.already_has_schedule =
            (skipReasons.already_has_schedule ?? 0) + 1;
          console.log(
            JSON.stringify({
              dryRun: true,
              subscriptionId: sub.id,
              status: sub.status,
              priceId,
              periodEnd,
              result: 'skipped',
              reason: 'already_has_schedule',
              existingSchedule:
                typeof sub.schedule === 'string'
                  ? sub.schedule
                  : sub.schedule.id,
            })
          );
          continue;
        }

        scheduled += 1;
        console.log(
          JSON.stringify({
            dryRun: true,
            subscriptionId: sub.id,
            status: sub.status,
            priceId,
            periodEnd,
            result: 'would_schedule',
            targetPriceId,
          })
        );
        continue;
      }

      const result = await schedulePriceMigrationAtRenewal(
        stripe,
        sub.id,
        priceId,
        targetPriceId,
        { idempotencyKey: `migrate-to-199-${sub.id}` }
      );

      if (result.status === 'skipped') {
        skipped += 1;
        skipReasons[result.reason] = (skipReasons[result.reason] ?? 0) + 1;
        console.log(
          JSON.stringify({
            subscriptionId: sub.id,
            status: sub.status,
            priceId,
            periodEnd,
            result: 'skipped',
            reason: result.reason,
          })
        );
        continue;
      }

      const userId = await bestEffortSetScheduleId(
        stripe,
        sub,
        result.scheduleId
      );
      scheduled += 1;
      console.log(
        JSON.stringify({
          subscriptionId: sub.id,
          status: sub.status,
          priceId,
          periodEnd,
          result: 'scheduled',
          scheduleId: result.scheduleId,
          targetPriceId,
          userId,
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
        total: subs.length,
        scheduled,
        skipped,
        errors,
        skipReasons,
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
