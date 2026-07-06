// POST /api/v1/auth/password/change
// Change password (requires current password) or set an initial password for OAuth users
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import { logger } from "@/lib/api/logger";
import User from "@/models/user";
import {
  applyPasswordUpdate,
  getCredentialPasswordHash,
  userHasPassword,
  verifyStoredPassword,
} from "@/lib/api/password-account";

async function handler(
  req: NextRequest,
  // userId is a plain string (UUID for Better Auth web/OAuth users, hex
  // ObjectId string for legacy/mobile accounts) — see src/lib/api/middleware.ts.
  context: { userId: string; userRole: string },
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!newPassword) {
      return NextResponse.json(
        {
          code: "ValidationError",
          message: "New password is required",
        },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        {
          code: "ValidationError",
          message: "New password must be at least 8 characters long",
        },
        { status: 400 },
      );
    }

    const user = await User.findById(context.userId).select("+password").exec();

    if (!user) {
      return NextResponse.json(
        {
          code: "NotFoundError",
          message: "User not found",
        },
        { status: 404 },
      );
    }

    const hasPassword = await userHasPassword(context.userId, user.password);

    if (!hasPassword) {
      await applyPasswordUpdate(context.userId, newPassword);

      logger.info("Password set successfully for OAuth user", {
        userId: context.userId.toString(),
      });

      return NextResponse.json(
        {
          code: "Success",
          message:
            "Password set successfully. You can now sign in with email and password.",
        },
        { status: 200 },
      );
    }

    if (!currentPassword) {
      return NextResponse.json(
        {
          code: "ValidationError",
          message: "Current password is required",
        },
        { status: 400 },
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        {
          code: "ValidationError",
          message: "New password must be different from current password",
        },
        { status: 400 },
      );
    }

    const storedPasswordHash =
      user.password ?? (await getCredentialPasswordHash(context.userId));

    if (!storedPasswordHash) {
      return NextResponse.json(
        {
          code: "NoPasswordError",
          message: "No password is set for this account",
        },
        { status: 400 },
      );
    }

    const isPasswordValid = await verifyStoredPassword(
      currentPassword,
      storedPasswordHash,
    );

    if (!isPasswordValid) {
      return NextResponse.json(
        {
          code: "InvalidPasswordError",
          message: "Current password is incorrect",
        },
        { status: 400 },
      );
    }

    await applyPasswordUpdate(context.userId, newPassword);

    logger.info("Password changed successfully", {
      userId: context.userId.toString(),
    });

    return NextResponse.json(
      {
        code: "Success",
        message: "Password changed successfully",
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error changing password", {
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        code: "ServerError",
        message: "Failed to change password. Please try again.",
      },
      { status: 500 },
    );
  }
}

export const POST = withAuth(handler);
