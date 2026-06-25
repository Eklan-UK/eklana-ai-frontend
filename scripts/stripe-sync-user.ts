/**
 * Sync one user's subscription fields from Stripe → MongoDB (same logic as admin stripe-sync).
 *
 * Usage (from repo root, MONGO_URI + STRIPE_SECRET_KEY in .env):
 *   npx tsx scripts/stripe-sync-user.ts --email oktos11@yahoo.com
 *   npx tsx scripts/stripe-sync-user.ts --customer cus_UWPMcoA0zschYg
 *   npx tsx scripts/stripe-sync-user.ts --userId 6a0716af6a7703bea04ca6c2
 */
import "dotenv/config";
import Stripe from "stripe";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "../src/lib/api/db";
import User from "../src/models/user";
import { shouldSkipStripeDowngrade } from "../src/lib/api/subscription-reconciliation";
import { downgradeUserFromStripe } from "../src/lib/api/stripe-subscription-apply";

function fromUnix(ts: number): Date {
  return new Date(ts * 1000);
}

function getPeriodEnd(sub: Stripe.Subscription): Date | null {
  const ts = sub.items?.data?.[0]?.current_period_end;
  return typeof ts === "number" ? fromUnix(ts) : null;
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1 || !process.argv[i + 1]) return undefined;
  return process.argv[i + 1];
}

async function main() {
  const email = argValue("--email");
  const customerArg = argValue("--customer");
  const userIdArg = argValue("--userId");

  if (!email && !customerArg && !userIdArg) {
    console.error(
      "Usage: npx tsx scripts/stripe-sync-user.ts --email <e> | --customer <cus_> | --userId <mongoId>"
    );
    process.exit(1);
  }

  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    console.error("STRIPE_SECRET_KEY is not set in .env");
    process.exit(1);
  }

  const stripe = new Stripe(secret, { apiVersion: "2026-04-22.dahlia" });

  await connectToDatabase();

  let user = null as InstanceType<typeof User> | null;
  if (userIdArg) {
    if (!Types.ObjectId.isValid(userIdArg)) {
      console.error("Invalid --userId");
      process.exit(1);
    }
    user = await User.findById(userIdArg).exec();
  } else if (email) {
    user = await User.findOne({ email: email.trim().toLowerCase() }).exec();
  } else if (customerArg) {
    user = await User.findOne({ stripeCustomerId: customerArg.trim() }).exec();
  }

  if (!user) {
    console.error("User not found in MongoDB.");
    await mongoose.disconnect();
    process.exit(1);
  }

  let stripeCustomerId = user.stripeCustomerId?.trim() || null;
  if (!stripeCustomerId) {
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 5,
    });
    if (customers.data.length === 0) {
      console.error(
        `No Stripe customer for ${user.email}. Checkout may not have completed.`
      );
      await mongoose.disconnect();
      process.exit(1);
    }
    stripeCustomerId = customers.data[0].id;
    console.log("Resolved Stripe customer from email:", stripeCustomerId);
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    limit: 10,
    expand: ["data.items.data"],
  });

  const activeSub = subscriptions.data.find(
    (s) => s.status === "active" || s.status === "trialing"
  );

  user.stripeCustomerId = stripeCustomerId;

  if (activeSub) {
    const periodEnd =
      getPeriodEnd(activeSub) ??
      new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);

    user.subscriptionPlan = "premium";
    user.stripeSubscriptionId = activeSub.id;
    user.stripeSubscriptionStatus = activeSub.status;
    user.subscriptionActivatedAt =
      user.subscriptionActivatedAt ?? fromUnix(activeSub.created);
    user.subscriptionExpiresAt = periodEnd;
    user.subscriptionPaymentMethod = "stripe";
    await user.save();

    console.log(
      JSON.stringify(
        {
          ok: true,
          userId: String(user._id),
          email: user.email,
          subscriptionPlan: user.subscriptionPlan,
          stripeSubscriptionId: user.stripeSubscriptionId,
          stripeSubscriptionStatus: user.stripeSubscriptionStatus,
          subscriptionExpiresAt: user.subscriptionExpiresAt,
        },
        null,
        2
      )
    );
  } else {
    const latest = subscriptions.data[0];
    if (latest) {
      user.stripeSubscriptionId = latest.id;
      user.stripeSubscriptionStatus = latest.status;
    }

    const downgraded = !shouldSkipStripeDowngrade(user);
    if (downgraded) {
      downgradeUserFromStripe(user);
    }
    await user.save();

    console.error(
      JSON.stringify(
        {
          ok: false,
          downgraded,
          message: downgraded
            ? "No active/trialing subscription — user downgraded to free."
            : "No active/trialing subscription — premium retained (Apple/manual).",
          stripeCustomerId,
          latestSubscriptionId: latest?.id ?? null,
          latestSubscriptionStatus: latest?.status ?? null,
          subscriptionPlan: user.subscriptionPlan,
        },
        null,
        2
      )
    );
    process.exitCode = downgraded ? 0 : 1;
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
