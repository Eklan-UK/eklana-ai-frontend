// POST /api/v1/admin/users/subscription
// Manually create/update a user's subscription (offline payment).
// Zero Pause Challenge/Maintainer labels may be persisted; they do not change Stripe prices.
import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import User from "@/models/user";
import { logger } from "@/lib/api/logger";
import mongoose from "mongoose";
import { z } from "zod";
import { isValidUserId, toUserIdQuery } from "@/lib/api/user-id";
import {
  addMonthsToDate,
  billingPeriodToMonths,
  computeAutoPostTrialWindow,
  hasProviderBillingLink,
  toUtcDayStart,
  type BillingPeriod,
  type ZeroPauseChallengePhase,
  type ZeroPauseProduct,
} from "@/domain/subscriptions/subscription.types";
import { syncUserSubscriptionFromProvider } from "@/domain/subscriptions/subscription-provider-sync.service";

const updateSubscriptionSchema = z.object({
  userId: z.string().refine((id) => isValidUserId(id), {
    message: "Invalid user ID format",
  }),
  plan: z.enum(["free", "premium"]),
  months: z.number().int().min(0).optional(),
  billingPeriod: z.enum(["monthly", "quarterly", "annual"]).optional(),
  zeroPauseProducts: z
    .array(z.enum(["challenge", "maintainer"]))
    .optional(),
  /** Which Challenge date pair the admin is editing. */
  zeroPauseChallengePhase: z.enum(["trial", "post_trial"]).optional(),
  zeroPauseDate: z.string().nullable().optional(),
  zeroPauseEndDate: z.string().nullable().optional(),
  zeroPausePostTrialDate: z.string().nullable().optional(),
  zeroPausePostTrialEndDate: z.string().nullable().optional(),
  amount: z.number().nonnegative().optional(),
  paymentMethod: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
});

/** Challenge and Maintainer are mutually exclusive labels. */
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

async function handler(
  req: NextRequest,
  context: { userId: string; userRole: string }
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

    if (input.zeroPauseProducts !== undefined) {
      const products = normalizeZeroPauseProducts(
        input.zeroPauseProducts as ZeroPauseProduct[]
      );

      if (products.length === 0) {
        user.zeroPauseProducts = [];
        user.zeroPauseDate = null;
        user.zeroPauseEndDate = null;
        user.zeroPausePostTrialDate = null;
        user.zeroPausePostTrialEndDate = null;
      } else if (products.includes("challenge")) {
        const phase: ZeroPauseChallengePhase =
          input.zeroPauseChallengePhase ?? "trial";
        user.zeroPauseProducts = products;

        if (phase === "trial") {
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
                  "Challenge Trial requires both start date and end date.",
              },
              { status: 400 }
            );
          }
          if (end.getTime() < start.getTime()) {
            return NextResponse.json(
              {
                code: "ValidationError",
                message:
                  "Challenge Trial end date must be on or after the start date.",
              },
              { status: 400 }
            );
          }

          user.zeroPauseDate = start;
          user.zeroPauseEndDate = end;
          // Auto-set Post Trial to 2 months + 2 weeks starting the day after Trial ends.
          const postWindow = computeAutoPostTrialWindow(end);
          user.zeroPausePostTrialDate = postWindow.start;
          user.zeroPausePostTrialEndDate = postWindow.end;
        } else {
          const postStart =
            parseOptionalDate(input.zeroPausePostTrialDate) ??
            (user.zeroPausePostTrialDate
              ? toUtcDayStart(user.zeroPausePostTrialDate)
              : null);
          const postEnd =
            parseOptionalDate(input.zeroPausePostTrialEndDate) ??
            (user.zeroPausePostTrialEndDate
              ? toUtcDayStart(user.zeroPausePostTrialEndDate)
              : null);

          if (!postStart || !postEnd) {
            return NextResponse.json(
              {
                code: "ValidationError",
                message:
                  "Challenge Post Trial requires both start date and end date.",
              },
              { status: 400 }
            );
          }
          if (postEnd.getTime() < postStart.getTime()) {
            return NextResponse.json(
              {
                code: "ValidationError",
                message:
                  "Challenge Post Trial end date must be on or after the start date.",
              },
              { status: 400 }
            );
          }

          user.zeroPausePostTrialDate = postStart;
          user.zeroPausePostTrialEndDate = postEnd;

          // Optional: allow clearing/keeping trial dates when editing Post Trial.
          if (input.zeroPauseDate !== undefined) {
            user.zeroPauseDate = parseOptionalDate(input.zeroPauseDate) ?? null;
          }
          if (input.zeroPauseEndDate !== undefined) {
            user.zeroPauseEndDate =
              parseOptionalDate(input.zeroPauseEndDate) ?? null;
          }

          // If Post Trial is assigned without an active trial window, clear trial
          // so dashboard/badges treat the learner as Post Trial immediately.
          if (
            user.zeroPauseEndDate &&
            toUtcDayStart(new Date()).getTime() <=
              toUtcDayStart(user.zeroPauseEndDate).getTime()
          ) {
            // Admin chose Post Trial while trial dates are still active — clear
            // trial end so phase resolves to post_trial right away.
            user.zeroPauseDate = null;
            user.zeroPauseEndDate = null;
          }
        }
      } else {
        // Maintainer (no Challenge) — clear Challenge window dates.
        user.zeroPauseProducts = products;
        if (products.includes("maintainer")) {
          user.zeroPauseDate = null;
          user.zeroPauseEndDate = null;
          user.zeroPausePostTrialDate = null;
          user.zeroPausePostTrialEndDate = null;
        } else {
          if (input.zeroPauseDate !== undefined) {
            user.zeroPauseDate = parseOptionalDate(input.zeroPauseDate) ?? null;
          }
          if (input.zeroPauseEndDate !== undefined) {
            user.zeroPauseEndDate =
              parseOptionalDate(input.zeroPauseEndDate) ?? null;
          }
          if (input.zeroPausePostTrialDate !== undefined) {
            user.zeroPausePostTrialDate =
              parseOptionalDate(input.zeroPausePostTrialDate) ?? null;
          }
          if (input.zeroPausePostTrialEndDate !== undefined) {
            user.zeroPausePostTrialEndDate =
              parseOptionalDate(input.zeroPausePostTrialEndDate) ?? null;
          }
        }
      }
    } else if (
      input.zeroPauseDate !== undefined ||
      input.zeroPauseEndDate !== undefined ||
      input.zeroPausePostTrialDate !== undefined ||
      input.zeroPausePostTrialEndDate !== undefined
    ) {
      if (input.zeroPauseDate !== undefined) {
        user.zeroPauseDate = parseOptionalDate(input.zeroPauseDate) ?? null;
      }
      if (input.zeroPauseEndDate !== undefined) {
        user.zeroPauseEndDate =
          parseOptionalDate(input.zeroPauseEndDate) ?? null;
      }
      if (input.zeroPausePostTrialDate !== undefined) {
        user.zeroPausePostTrialDate =
          parseOptionalDate(input.zeroPausePostTrialDate) ?? null;
      }
      if (input.zeroPausePostTrialEndDate !== undefined) {
        user.zeroPausePostTrialEndDate =
          parseOptionalDate(input.zeroPausePostTrialEndDate) ?? null;
      }

      if ((user.zeroPauseProducts ?? []).includes("challenge")) {
        const phase: ZeroPauseChallengePhase =
          input.zeroPauseChallengePhase ??
          (user.zeroPauseEndDate &&
          toUtcDayStart(new Date()).getTime() <=
            toUtcDayStart(user.zeroPauseEndDate).getTime()
            ? "trial"
            : "post_trial");

        if (phase === "trial") {
          if (!user.zeroPauseDate || !user.zeroPauseEndDate) {
            return NextResponse.json(
              {
                code: "ValidationError",
                message:
                  "Challenge Trial requires both start date and end date.",
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
                message:
                  "Challenge Trial end date must be on or after the start date.",
              },
              { status: 400 }
            );
          }
          const postWindow = computeAutoPostTrialWindow(user.zeroPauseEndDate);
          user.zeroPausePostTrialDate = postWindow.start;
          user.zeroPausePostTrialEndDate = postWindow.end;
        } else {
          if (!user.zeroPausePostTrialDate || !user.zeroPausePostTrialEndDate) {
            return NextResponse.json(
              {
                code: "ValidationError",
                message:
                  "Challenge Post Trial requires both start date and end date.",
              },
              { status: 400 }
            );
          }
          if (
            toUtcDayStart(user.zeroPausePostTrialEndDate).getTime() <
            toUtcDayStart(user.zeroPausePostTrialDate).getTime()
          ) {
            return NextResponse.json(
              {
                code: "ValidationError",
                message:
                  "Challenge Post Trial end date must be on or after the start date.",
              },
              { status: 400 }
            );
          }
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
      user.subscriptionUpdatedBy = toUserIdQuery(context.userId);
    } else {
      const providerResult = await syncUserSubscriptionFromProvider(user);

      if (providerResult.synced) {
        user.subscriptionAdminNote = input.note || undefined;
        user.subscriptionUpdatedBy = toUserIdQuery(context.userId);
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
        user.subscriptionUpdatedBy = toUserIdQuery(context.userId);
      } else {
        user.subscriptionAdminNote = input.note || undefined;
        user.subscriptionUpdatedBy = toUserIdQuery(context.userId);
      }
    }

    // Only validate fields this admin path mutates. Full-document validation
    // rejects legacy/OAuth users with empty lastName ("Last name is required")
    // even though the profile was never edited here.
    await user.save({ validateModifiedOnly: true });

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
          zeroPausePostTrialDate: user.zeroPausePostTrialDate ?? null,
          zeroPausePostTrialEndDate: user.zeroPausePostTrialEndDate ?? null,
          subscriptionActivatedAt: user.subscriptionActivatedAt,
          subscriptionExpiresAt: user.subscriptionExpiresAt,
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

    if (
      error instanceof mongoose.Error.CastError ||
      error instanceof mongoose.Error.ValidationError
    ) {
      const err = error as Error;
      logger.error("Error updating subscription", {
        error: err.message,
        stack: err.stack,
      });
      return NextResponse.json(
        {
          code: "ValidationError",
          message: err.message,
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
