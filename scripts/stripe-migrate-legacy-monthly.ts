/**
 * Soft-grandfather legacy monthly Stripe subscriptions onto the new US$20
 * monthly price at each sub's current_period_end via Subscription Schedules.
 *
 * Default is dry-run (list + skip reasons only). Pass --execute to apply.
 *
 * Usage (from repo root, env in .env):
 *   npx tsx scripts/stripe-migrate-legacy-monthly.ts
 *   npx tsx scripts/stripe-migrate-legacy-monthly.ts --execute
 *   npm run migrate:legacy-monthly
 *   npm run migrate:legacy-monthly -- --execute
 *
 * Requires:
 *   STRIPE_SECRET_KEY
 *   STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY
 *   STRIPE_PREMIUM_MONTHLY_PRICE_ID
 *   MONGO_URI
 */
import "dotenv/config";
import Stripe from "stripe";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/lib/api/db";
import User from "../src/models/user";
import { findUserByStripeCustomer } from "../src/lib/api/stripe-webhook-user";
import { schedulePriceMigrationAtRenewal } from "../src/lib/api/stripe-price-migration";

const STATUSES: Array<"active" | "trialing"> = ["active", "trialing"];

function customerIdOf(sub: Stripe.Subscription): string {
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
}

async function listLegacySubscriptions(
  stripe: Stripe,
  legacyPriceId: string
): Promise<Stripe.Subscription[]> {
  const out: Stripe.Subscription[] = [];
  const seen = new Set<string>();

  for (const status of STATUSES) {
    for await (const sub of stripe.subscriptions.list({
      price: legacyPriceId,
      status,
      limit: 100,
      expand: ["data.items.data"],
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
  const execute = process.argv.includes("--execute");

  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  const legacyPriceId = process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY?.trim();
  const newPriceId = process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID?.trim();

  if (!secret || !legacyPriceId || !newPriceId) {
    console.error(
      "Missing required env: STRIPE_SECRET_KEY, STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY, STRIPE_PREMIUM_MONTHLY_PRICE_ID"
    );
    process.exit(1);
  }

  if (legacyPriceId === newPriceId) {
    console.error(
      "STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY and STRIPE_PREMIUM_MONTHLY_PRICE_ID must differ"
    );
    process.exit(1);
  }

  const stripe = new Stripe(secret, { apiVersion: "2026-04-22.dahlia" });

  await connectToDatabase();

  console.log(
    execute
      ? "Mode: EXECUTE — will create Subscription Schedules"
      : "Mode: DRY-RUN — no Stripe writes (pass --execute to apply)"
  );
  console.log({ legacyPriceId, newPriceId });

  const subs = await listLegacySubscriptions(stripe, legacyPriceId);
  console.log(`Found ${subs.length} active/trialing subscription(s) on legacy price`);

  let scheduled = 0;
  let skipped = 0;
  let errors = 0;
  const skipReasons: Record<string, number> = {};

  for (const sub of subs) {
    const item = sub.items.data[0];
    const priceId = item?.price?.id ?? "(unknown)";
    const periodEnd = item?.current_period_end
      ? new Date(item.current_period_end * 1000).toISOString()
      : null;

    try {
      if (!execute) {
        // Dry-run uses the same skip predicates without calling Stripe writes.
        if (priceId === newPriceId) {
          skipped += 1;
          skipReasons.already_new_price = (skipReasons.already_new_price ?? 0) + 1;
          console.log(
            JSON.stringify({
              dryRun: true,
              subscriptionId: sub.id,
              status: sub.status,
              priceId,
              periodEnd,
              result: "skipped",
              reason: "already_new_price",
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
              result: "skipped",
              reason: "already_has_schedule",
              existingSchedule:
                typeof sub.schedule === "string" ? sub.schedule : sub.schedule.id,
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
            result: "would_schedule",
          })
        );
        continue;
      }

      const result = await schedulePriceMigrationAtRenewal(
        stripe,
        sub.id,
        legacyPriceId,
        newPriceId
      );

      if (result.status === "skipped") {
        skipped += 1;
        skipReasons[result.reason] = (skipReasons[result.reason] ?? 0) + 1;
        console.log(
          JSON.stringify({
            subscriptionId: sub.id,
            status: sub.status,
            priceId,
            periodEnd,
            result: "skipped",
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
          result: "scheduled",
          scheduleId: result.scheduleId,
          userId,
        })
      );
    } catch (err: unknown) {
      errors += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          subscriptionId: sub.id,
          result: "error",
          error: message,
        })
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: execute ? "execute" : "dry-run",
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
