// POST /api/v1/admin/users/subscription
// Manually create/update a user's subscription (offline payment)
import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import User from "@/models/user";
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

const updateSubscriptionSchema = z.object({
  userId: z.string().refine((id) => Types.ObjectId.isValid(id), {
    message: "Invalid user ID format",
  }),
  plan: z.enum(["free", "premium"]),
  months: z.number().int().min(0).optional(),
  billingPeriod: z.enum(["monthly", "quarterly", "annual"]).optional(),
  zeroPauseProducts: z.array(z.enum(["challenge", "mastery"])).optional(),
  zeroPauseDate: z.string().nullable().optional(),
  amount: z.number().nonnegative().optional(),
  paymentMethod: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
});

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

    if (input.zeroPauseProducts !== undefined) {
      user.zeroPauseProducts = input.zeroPauseProducts as ZeroPauseProduct[];
      // Clear the shared date when no products are selected
      if (input.zeroPauseProducts.length === 0) {
        user.zeroPauseDate = null;
      } else if (input.zeroPauseDate !== undefined) {
        user.zeroPauseDate = input.zeroPauseDate ? new Date(input.zeroPauseDate) : null;
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





