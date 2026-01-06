// GET /api/v1/users/current
// Get current authenticated user
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import User from "@/models/user";
import Tutor from "@/models/tutor";
import Profile from "@/models/profile";
import { logger } from "@/lib/api/logger";

async function handler(
  req: NextRequest,
  context: { userId: any; userRole: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    let user = await User.findById(context.userId)
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

    // Ensure role is set - update if missing
    if (!user.role) {
      await User.updateOne(
        { _id: context.userId },
        { $set: { role: 'user' } }
      );
      user.role = 'user';
    }

    const response: any = { user };

    // Include tutor profile if user is a tutor
    if (user.role === "tutor") {
      const tutorProfile = await Tutor.findOne({ userId: context.userId })
        .select("-__v")
        .lean()
        .exec();
      if (tutorProfile) {
        response.tutorProfile = tutorProfile;
      }
    }

    // Include user profile if user is a regular user
    if (user.role === "user") {
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
      role: user.role,
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
