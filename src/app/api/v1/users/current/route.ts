// GET /api/v1/users/current
// Get current authenticated user
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import User from "@/models/user";
import Tutor from "@/models/tutor";
import Profile from "@/models/profile";
import { logger } from "@/lib/api/logger";
import { isUserSubscribed } from "@/lib/api/user-subscription";

async function handler(
  req: NextRequest,
  context: { userId: any; userRole: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const user = await User.findById(context.userId)
      .select("-password -__v")
      .lean()
      .exec();

    if (!user) {
      return NextResponse.json(
        {
          code: "NotFoundError",
          message: "User not found",
        },
        { status: 404 }
      );
    }

    // Use role from context (already validated) or fallback to DB value
    const effectiveRole = (user as any).role || context.userRole || "user";
    const subscribed = isUserSubscribed(user as any);

    // Lazily backfill a purpose-built UUID identifier for use as StoreKit's
    // appAccountToken, for users who signed up/logged in before this field
    // existed. `user._id` is unsafe to use directly since roughly half the
    // user base has a legacy non-UUID ObjectId `_id`.
    let iapAccountToken = (user as any).iapAccountToken;
    if (!iapAccountToken) {
      iapAccountToken = crypto.randomUUID();
      await User.updateOne(
        { _id: context.userId },
        { $set: { iapAccountToken } }
      );
    }

    const safeUser: any = {
      ...user,
      role: effectiveRole,
      subscriptionPlan: user.subscriptionPlan || "free",
      subscriptionActivatedAt: user.subscriptionActivatedAt || null,
      subscriptionExpiresAt: user.subscriptionExpiresAt || null,
      stripeSubscriptionStatus: (user as any).stripeSubscriptionStatus ?? null,
      appleSubscriptionStatus: (user as any).appleSubscriptionStatus ?? null,
      isSubscribed: subscribed,
      iapAccountToken,
    };

    delete safeUser.subscriptionMonthsPaidFor;
    delete safeUser.subscriptionAmountPaid;
    delete safeUser.subscriptionPaymentMethod;
    delete safeUser.subscriptionAdminNote;
    delete safeUser.subscriptionUpdatedBy;

    const response: any = { user: safeUser };

    // Include tutor profile if user is a tutor
    if (effectiveRole === "tutor") {
      const tutorProfile = await Tutor.findOne({ userId: context.userId })
        .select("-__v")
        .lean()
        .exec();
      if (tutorProfile) {
        response.tutorProfile = tutorProfile;
      }
    }

    // Include user profile if user is a regular user
    if (effectiveRole === "user") {
      const userProfile = await Profile.findOne({ userId: context.userId })
        .select("-__v")
        .lean()
        .exec();
      if (userProfile) {
        response.profile = userProfile;
      }
    }

    logger.info("Current user fetched successfully", {
      userId: context.userId,
      role: effectiveRole,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    logger.error("Error fetching current user", error);
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Internal Server Error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

async function deleteHandler(
  req: NextRequest,
  context: { userId: any; userRole: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const user = await User.findById(context.userId);

    if (!user || (user as any).isDeleted) {
      return NextResponse.json(
        {
          code: "NotFoundError",
          message: "User not found",
        },
        { status: 404 }
      );
    }

    // Soft delete the user
    (user as any).isActive = false;
    (user as any).isDeleted = true;
    (user as any).deletedAt = new Date();
    // Optionally clear sensitive fields
    // Keep email unique but anonymized to avoid conflicts
    const anonymizedEmail = `deleted+${user._id}@example.com`;
    (user as any).email = anonymizedEmail;
    (user as any).hasProfile = false;

    await user.save();

    logger.info("User soft-deleted successfully", {
      userId: context.userId,
    });

    return NextResponse.json(
      {
        code: "Success",
        message: "Account deleted successfully",
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error("Error deleting user account", error);
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Failed to delete account",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handler);
export const DELETE = withAuth(deleteHandler);
