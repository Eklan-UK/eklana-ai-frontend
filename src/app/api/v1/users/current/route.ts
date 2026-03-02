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
    const effectiveRole = user.role || context.userRole || "user";
    const subscribed = isUserSubscribed(user as any);

    const safeUser: any = {
      ...user,
      role: effectiveRole,
      subscriptionPlan: user.subscriptionPlan || "free",
      subscriptionActivatedAt: user.subscriptionActivatedAt || null,
      subscriptionExpiresAt: user.subscriptionExpiresAt || null,
      isSubscribed: subscribed,
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

export const GET = withAuth(handler);
