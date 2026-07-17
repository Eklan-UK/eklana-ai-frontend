// POST /api/v1/admin/users/subscription
// Manually create/update a user's subscription (offline payment)
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import User from "@/models/user";
import config from "@/lib/api/config";
import { logger } from "@/lib/api/logger";
import { Types } from "mongoose";
import { z } from "zod";
import {
  addMonthsToDate,
  billingPeriodToMonths,
  hasProviderBillingLink,
  type BillingPeriod,
  type ZeroPauseProduct,
} from "@/domain/subscriptions/subscription.types";
import { syncUserSubscriptionFromProvider } from "@/domain/subscriptions/subscription-provider-sync.service";
import {
  syncStripeForZeroPauseChallengePricing,
  syncStripeForZeroPauseMaintainerPricing,
} from "@/lib/api/stripe-challenge-pricing-sync";
import { toUtcDayStart } from "@/lib/api/zero-pause-pricing";

const updateSubscriptionSchema = z.object({
  userId: z.string().refine((id) => Types.ObjectId.isValid(id), {
    message: "Invalid user ID format",
  }),
  plan: z.enum(["free", "premium"]),
  months: z.number().int().min(0).optional(),
  billingPeriod: z.enum(["monthly", "quarterly", "annual"]).optional(),
  zeroPauseProducts: z
    .array(z.enum(["challenge", "maintainer"]))
    .optional(),
  zeroPauseDate: z.string().nullable().optional(),
  zeroPauseEndDate: z.string().nullable().optional(),
  amount: z.number().nonnegative().optional(),
  paymentMethod: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
});

/** Challenge and Maintainer are mutually exclusive for Pro pricing. */
function normalizeZeroPauseProducts(
  products: ZeroPauseProduct[]
): ZeroPauseProduct[] {
  const allowed = products.filter(
    (p): p is ZeroPauseProduct => p === "challenge" || p === "maintainer"
  );
  if (allowed.includes("challenge") && allowed.includes("maintainer")) {
    return allowed.filter((p) => p !== "maintainer");
  }
  return allowed;
}

function parseOptionalDate(
  value: string | null | undefined
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return toUtcDayStart(value);
}

/** Challenge window is assigned and not past end date (UTC day). */
function shouldSyncStripeForChallenge(
  user: {
    zeroPauseProducts?: string[] | null;
    zeroPauseEndDate?: Date | null;
  },
  now: Date = new Date()
): boolean {
  const products = user.zeroPauseProducts ?? [];
  if (!products.includes("challenge")) return false;
  if (!user.zeroPauseEndDate) return false;
  return (
    toUtcDayStart(user.zeroPauseEndDate).getTime() >=
    toUtcDayStart(now).getTime()
  );
}

function getStripe(): Stripe | null {
  if (!config.STRIPE_SECRET_KEY) return null;
  return new Stripe(config.STRIPE_SECRET_KEY, {
    apiVersion: "2026-04-22.dahlia",
  });
}

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const body = await req.json();
    const input = updateSubscriptionSchema.parse(body);

    const user = await User.findById(input.userId).exec();
    if (!user) {
      return NextResponse.json(
        { code: "NotFoundError", message: "User not found" },
        { status: 404 }
      );
    }

    // Capture before mutating products — gates Maintainer (restore) Stripe sync.
    const hadChallenge = (user.zeroPauseProducts ?? []).includes("challenge");

    if (input.zeroPauseProducts !== undefined) {
      const products = normalizeZeroPauseProducts(
        input.zeroPauseProducts as ZeroPauseProduct[]
      );

      if (products.length === 0) {
        user.zeroPauseProducts = [];
        user.zeroPauseDate = null;
        user.zeroPauseEndDate = null;
      } else if (products.includes("challenge")) {
        const start =
          parseOptionalDate(input.zeroPauseDate) ??
          (user.zeroPauseDate ? toUtcDayStart(user.zeroPauseDate) : null);
        const end =
          parseOptionalDate(input.zeroPauseEndDate) ??
          (user.zeroPauseEndDate ? toUtcDayStart(user.zeroPauseEndDate) : null);

        if (!start || !end) {
          return NextResponse.json(
            {
              code: "ValidationError",
              message:
                "Challenge requires both start date and end date (zeroPauseDate and zeroPauseEndDate).",
            },
            { status: 400 }
          );
        }
        if (end.getTime() < start.getTime()) {
          return NextResponse.json(
            {
              code: "ValidationError",
              message: "Challenge end date must be on or after the start date.",
            },
            { status: 400 }
          );
        }

        user.zeroPauseProducts = products;
        user.zeroPauseDate = start;
        user.zeroPauseEndDate = end;
      } else {
        // Maintainer (no Challenge) — clear Challenge window dates.
        user.zeroPauseProducts = products;
        if (products.includes("maintainer")) {
          user.zeroPauseDate = null;
          user.zeroPauseEndDate = null;
        } else {
          if (input.zeroPauseDate !== undefined) {
            user.zeroPauseDate = parseOptionalDate(input.zeroPauseDate) ?? null;
          }
          if (input.zeroPauseEndDate !== undefined) {
            user.zeroPauseEndDate =
              parseOptionalDate(input.zeroPauseEndDate) ?? null;
          }
        }
      }
    } else if (
      input.zeroPauseDate !== undefined ||
      input.zeroPauseEndDate !== undefined
    ) {
      if (input.zeroPauseDate !== undefined) {
        user.zeroPauseDate = parseOptionalDate(input.zeroPauseDate) ?? null;
      }
      if (input.zeroPauseEndDate !== undefined) {
        user.zeroPauseEndDate =
          parseOptionalDate(input.zeroPauseEndDate) ?? null;
      }
      if ((user.zeroPauseProducts ?? []).includes("challenge")) {
        if (!user.zeroPauseDate || !user.zeroPauseEndDate) {
          return NextResponse.json(
            {
              code: "ValidationError",
              message:
                "Challenge requires both start date and end date (zeroPauseDate and zeroPauseEndDate).",
            },
            { status: 400 }
          );
        }
        if (
          toUtcDayStart(user.zeroPauseEndDate).getTime() <
          toUtcDayStart(user.zeroPauseDate).getTime()
        ) {
          return NextResponse.json(
            {
              code: "ValidationError",
              message: "Challenge end date must be on or after the start date.",
            },
            { status: 400 }
          );
        }
      }
    }

    if (input.plan === "free") {
      user.subscriptionPlan = "free";
      user.subscriptionBillingPeriod = null;
      user.subscriptionActivatedAt = null;
      user.subscriptionExpiresAt = null;
      user.subscriptionMonthsPaidFor = 0;
      user.subscriptionAmountPaid = 0;
      user.subscriptionPaymentMethod = undefined;
      user.subscriptionAdminNote = input.note || undefined;
      user.subscriptionUpdatedBy = context.userId;
    } else {
      const providerResult = await syncUserSubscriptionFromProvider(user);

      if (providerResult.synced) {
        user.subscriptionAdminNote = input.note || undefined;
        user.subscriptionUpdatedBy = context.userId;
      } else if (!hasProviderBillingLink(user)) {
        const billingPeriod: BillingPeriod =
          input.billingPeriod ??
          (input.months === 3
            ? "quarterly"
            : input.months === 12
              ? "annual"
              : "monthly");
        const months =
          input.months && input.months > 0
            ? input.months
            : billingPeriodToMonths(billingPeriod);

        const activation = user.subscriptionActivatedAt ?? new Date();
        if (!user.subscriptionActivatedAt) {
          user.subscriptionActivatedAt = activation;
        }

        const expiry = addMonthsToDate(activation, months);

        user.subscriptionExpiresAt = expiry;
        user.subscriptionBillingPeriod = billingPeriod;
        user.subscriptionMonthsPaidFor = months;
        user.subscriptionAmountPaid = input.amount ?? user.subscriptionAmountPaid ?? 0;
        user.subscriptionPaymentMethod =
          input.paymentMethod || user.subscriptionPaymentMethod || "manual";
        user.subscriptionProvider = "manual";
        user.subscriptionPlan = "premium";
        user.subscriptionAdminNote = input.note || undefined;
        user.subscriptionUpdatedBy = context.userId;
      } else {
        user.subscriptionAdminNote = input.note || undefined;
        user.subscriptionUpdatedBy = context.userId;
      }
    }

    await user.save();

    let challengeStripeSync:
      | { status: string; scheduleId?: string }
      | undefined;
    let maintainerStripeSync:
      | { status: string; scheduleId?: string; targetPriceId?: string }
      | undefined;

    const hasStripeBillingLink = Boolean(
      user.stripeSubscriptionId || user.stripeCustomerId
    );
    const productsAfter = user.zeroPauseProducts ?? [];
    const leftChallenge =
      hadChallenge && !productsAfter.includes("challenge");

    if (shouldSyncStripeForChallenge(user) && hasStripeBillingLink) {
      const stripe = getStripe();
      if (!stripe) {
        return NextResponse.json(
          {
            code: "StripeSyncError",
            message:
              "Challenge saved but Stripe next-invoice sync failed: STRIPE_SECRET_KEY is not configured.",
            data: {
              userId: user._id,
              zeroPauseProducts: user.zeroPauseProducts ?? [],
              zeroPauseDate: user.zeroPauseDate ?? null,
              zeroPauseEndDate: user.zeroPauseEndDate ?? null,
            },
          },
          { status: 502 }
        );
      }

      try {
        const syncResult = await syncStripeForZeroPauseChallengePricing(
          stripe,
          user,
          {
            enteringFromNonChallenge: !hadChallenge,
            idempotencyKey: `cohort-sync-challenge-${String(user._id)}-${randomUUID()}`,
          }
        );
        if (syncResult.status === "skipped_price_not_configured") {
          return NextResponse.json(
            {
              code: "StripeSyncError",
              message:
                "Challenge saved but Stripe next-invoice sync failed: legacy monthly price ID is not configured.",
              data: {
                userId: user._id,
                zeroPauseProducts: user.zeroPauseProducts ?? [],
                zeroPauseDate: user.zeroPauseDate ?? null,
                zeroPauseEndDate: user.zeroPauseEndDate ?? null,
              },
            },
            { status: 502 }
          );
        }
        await user.save();
        challengeStripeSync = {
          status: syncResult.status,
          ...("scheduleId" in syncResult && syncResult.scheduleId
            ? { scheduleId: syncResult.scheduleId }
            : {}),
        };
        logger.info("Challenge Stripe next-invoice sync", {
          userId: user._id,
          result: syncResult,
          enteringFromNonChallenge: !hadChallenge,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("Challenge Stripe next-invoice sync failed", {
          userId: user._id,
          error: message,
        });
        return NextResponse.json(
          {
            code: "StripeSyncError",
            message: `Challenge saved but Stripe next-invoice sync failed: ${message}`,
            data: {
              userId: user._id,
              zeroPauseProducts: user.zeroPauseProducts ?? [],
              zeroPauseDate: user.zeroPauseDate ?? null,
              zeroPauseEndDate: user.zeroPauseEndDate ?? null,
            },
          },
          { status: 502 }
        );
      }
    } else if (leftChallenge && hasStripeBillingLink) {
      const stripe = getStripe();
      if (!stripe) {
        return NextResponse.json(
          {
            code: "StripeSyncError",
            message:
              "Maintainer saved but Stripe next-invoice sync failed: STRIPE_SECRET_KEY is not configured.",
            data: {
              userId: user._id,
              zeroPauseProducts: user.zeroPauseProducts ?? [],
              zeroPauseDate: user.zeroPauseDate ?? null,
              zeroPauseEndDate: user.zeroPauseEndDate ?? null,
            },
          },
          { status: 502 }
        );
      }

      try {
        const syncResult = await syncStripeForZeroPauseMaintainerPricing(
          stripe,
          user,
          {
            idempotencyKey: `cohort-sync-maintainer-${String(user._id)}-${randomUUID()}`,
          }
        );
        if (syncResult.status === "skipped_price_not_configured") {
          return NextResponse.json(
            {
              code: "StripeSyncError",
              message:
                "Maintainer saved but Stripe next-invoice sync failed: restore price IDs are not configured.",
              data: {
                userId: user._id,
                zeroPauseProducts: user.zeroPauseProducts ?? [],
                zeroPauseDate: user.zeroPauseDate ?? null,
                zeroPauseEndDate: user.zeroPauseEndDate ?? null,
              },
            },
            { status: 502 }
          );
        }
        await user.save();
        maintainerStripeSync = {
          status: syncResult.status,
          ...("scheduleId" in syncResult && syncResult.scheduleId
            ? { scheduleId: syncResult.scheduleId }
            : {}),
          ...("targetPriceId" in syncResult && syncResult.targetPriceId
            ? { targetPriceId: syncResult.targetPriceId }
            : {}),
        };
        logger.info("Maintainer Stripe next-invoice sync", {
          userId: user._id,
          result: syncResult,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("Maintainer Stripe next-invoice sync failed", {
          userId: user._id,
          error: message,
        });
        return NextResponse.json(
          {
            code: "StripeSyncError",
            message: `Maintainer saved but Stripe next-invoice sync failed: ${message}`,
            data: {
              userId: user._id,
              zeroPauseProducts: user.zeroPauseProducts ?? [],
              zeroPauseDate: user.zeroPauseDate ?? null,
              zeroPauseEndDate: user.zeroPauseEndDate ?? null,
            },
          },
          { status: 502 }
        );
      }
    }

    logger.info("Subscription updated by admin", {
      userId: user._id,
      plan: user.subscriptionPlan,
      updatedBy: context.userId,
    });

    return NextResponse.json(
      {
        code: "Success",
        message: "Subscription updated",
        data: {
          userId: user._id,
          subscriptionPlan: user.subscriptionPlan,
          subscriptionBillingPeriod: user.subscriptionBillingPeriod,
          zeroPauseProducts: user.zeroPauseProducts ?? [],
          zeroPauseDate: user.zeroPauseDate ?? null,
          zeroPauseEndDate: user.zeroPauseEndDate ?? null,
          subscriptionActivatedAt: user.subscriptionActivatedAt,
          subscriptionExpiresAt: user.subscriptionExpiresAt,
          ...(maintainerStripeSync
            ? { maintainerStripeSync }
            : {}),
          ...(challengeStripeSync
            ? { challengeStripeSync }
            : {}),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: "ValidationError",
          message: "Validation failed",
          errors: error.issues,
        },
        { status: 400 }
      );
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Error updating subscription", {
      error: err.message,
      stack: err.stack,
    });

    return NextResponse.json(
      {
        code: "ServerError",
        message: "Failed to update subscription",
      },
      { status: 500 }
    );
  }
}

export const POST = withRole(["admin"], handler);
