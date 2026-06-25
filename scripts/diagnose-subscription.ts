/**
 * Subscription diagnostic playbook for a single student.
 *
 * Compares MongoDB fields, computed isUserSubscribed, Stripe live status,
 * and webhook endpoint health.
 *
 * Usage:
 *   npx tsx scripts/diagnose-subscription.ts --email student@example.com
 *   npx tsx scripts/diagnose-subscription.ts --userId <mongoId>
 *   npm run diagnose:subscription -- --email student@example.com
 */
import "dotenv/config";
import mongoose from "mongoose";
import Stripe from "stripe";
import { connectToDatabase } from "../src/lib/api/db";
import User from "../src/models/user";
import { isUserSubscribed } from "../src/lib/api/user-subscription";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1 || !process.argv[i + 1]) return undefined;
  return process.argv[i + 1];
}

const email = argValue("--email") || process.env.DIAGNOSE_EMAIL || "";
const userId = argValue("--userId") || process.env.DIAGNOSE_USER_ID || "";
const baseUrl =
  argValue("--base-url") ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

if (!email && !userId) {
  console.error(
    "Usage: npm run diagnose:subscription -- --email <e> | --userId <id> [--base-url URL]"
  );
  process.exit(1);
}

async function main() {
  await connectToDatabase();

  const user = userId
    ? await User.findById(userId).exec()
    : await User.findOne({ email: email.trim().toLowerCase() }).exec();

  if (!user) {
    console.error("User not found in MongoDB.");
    process.exit(1);
  }

  const dbSnapshot = {
    userId: String(user._id),
    email: user.email,
    subscriptionPlan: user.subscriptionPlan,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
    subscriptionPaymentMethod: user.subscriptionPaymentMethod,
    stripeCustomerId: user.stripeCustomerId ?? null,
    stripeSubscriptionId: user.stripeSubscriptionId ?? null,
    stripeSubscriptionStatus: user.stripeSubscriptionStatus ?? null,
    appleOriginalTransactionId: user.appleOriginalTransactionId ?? null,
    appleSubscriptionStatus: user.appleSubscriptionStatus ?? null,
    isSubscribedComputed: isUserSubscribed(user),
  };

  console.log("\n=== MongoDB + isUserSubscribed ===");
  console.log(JSON.stringify(dbSnapshot, null, 2));

  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (secret && user.stripeCustomerId) {
    const stripe = new Stripe(secret, { apiVersion: "2026-04-22.dahlia" });
    const subs = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      limit: 5,
      status: "all",
    });
    console.log("\n=== Stripe subscriptions (live) ===");
    console.log(
      JSON.stringify(
        subs.data.map((s) => ({
          id: s.id,
          status: s.status,
          current_period_end: s.items?.data?.[0]?.current_period_end ?? null,
        })),
        null,
        2
      )
    );
  } else {
    console.log(
      "\n=== Stripe (skipped: no STRIPE_SECRET_KEY or stripeCustomerId) ==="
    );
  }

  try {
    const wh = await fetch(`${baseUrl}/api/v1/webhooks/stripe`);
    const whBody = await wh.json().catch(() => ({}));
    console.log("\n=== Webhook endpoint smoke test ===");
    console.log(`GET ${baseUrl}/api/v1/webhooks/stripe → ${wh.status}`, whBody);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log("\n=== Webhook endpoint (unreachable) ===", message);
  }

  console.log("\n=== Checklist ===");
  const issues: string[] = [];
  if (dbSnapshot.stripeSubscriptionStatus === "past_due" && dbSnapshot.isSubscribedComputed) {
    issues.push("past_due but isSubscribed still true — webhook or access logic bug");
  }
  if (
    dbSnapshot.subscriptionPlan === "premium" &&
    !dbSnapshot.isSubscribedComputed &&
    dbSnapshot.stripeSubscriptionStatus === "active"
  ) {
    issues.push(
      "premium + active stripe status but isSubscribed false — likely expired subscriptionExpiresAt"
    );
  }
  if (!dbSnapshot.stripeCustomerId && dbSnapshot.subscriptionPlan === "premium") {
    issues.push("premium without stripeCustomerId — webhooks may not find this user");
  }
  if (issues.length === 0) {
    console.log("No obvious mismatches detected. Compare Stripe live status with fields above.");
  } else {
    for (const i of issues) console.log("  !", i);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
