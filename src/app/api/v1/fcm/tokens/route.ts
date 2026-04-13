/**
 * FCM Token Management API Endpoint
 * POST /api/v1/fcm/tokens - Register new FCM token
 * PUT /api/v1/fcm/tokens - Refresh FCM token (same path; not /tokens/refresh)
 * DELETE /api/v1/fcm/tokens - Unregister FCM token
 */

import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { withAuth } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import FCMToken from "@/models/fcm-token";

type AuthCtx = { userId: Types.ObjectId; userRole: string };

async function postHandler(req: NextRequest, context: AuthCtx) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const { token, userId: bodyUserId, deviceInfo } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 },
      );
    }

    if (
      bodyUserId &&
      String(bodyUserId) !== context.userId.toString()
    ) {
      return NextResponse.json(
        { error: "Cannot register token for another user" },
        { status: 403 },
      );
    }

    const userId = context.userId;

    if (typeof token !== "string" || token.length < 50) {
      return NextResponse.json(
        { error: "Invalid FCM token format" },
        { status: 400 },
      );
    }

    // `token` is unique across all users. Same device/browser token must not
    // create a second doc (E11000) — reassign to this user if they switched accounts.
    const existingByToken = await FCMToken.findOne({ token });

    if (existingByToken) {
      const sameUser =
        existingByToken.userId.toString() === userId.toString();
      if (!sameUser) {
        existingByToken.userId = userId;
        existingByToken.deviceInfo = {
          userAgent: deviceInfo?.userAgent || "",
          platform: deviceInfo?.platform || "",
          browser: deviceInfo?.browser || "",
        };
        existingByToken.registeredAt = new Date();
      }
      existingByToken.lastSeenAt = new Date();
      existingByToken.isActive = true;
      await existingByToken.save();

      return NextResponse.json({
        success: true,
        message: sameUser ? "FCM token updated" : "FCM token reassigned to current user",
        token: existingByToken.token,
      });
    }

    let fcmToken;
    try {
      fcmToken = await FCMToken.create({
        token,
        userId,
        deviceInfo: {
          userAgent: deviceInfo?.userAgent || "",
          platform: deviceInfo?.platform || "",
          browser: deviceInfo?.browser || "",
        },
        registeredAt: new Date(),
        lastSeenAt: new Date(),
        isActive: true,
      });
    } catch (createErr: unknown) {
      const code =
        createErr && typeof createErr === "object" && "code" in createErr
          ? (createErr as { code?: number }).code
          : undefined;
      if (code === 11000) {
        const raced = await FCMToken.findOne({ token });
        if (raced) {
          raced.userId = userId;
          raced.deviceInfo = {
            userAgent: deviceInfo?.userAgent || "",
            platform: deviceInfo?.platform || "",
            browser: deviceInfo?.browser || "",
          };
          raced.lastSeenAt = new Date();
          raced.isActive = true;
          await raced.save();
          return NextResponse.json({
            success: true,
            message: "FCM token registered after duplicate-key retry",
            token: raced.token,
          });
        }
      }
      throw createErr;
    }

    console.log(`FCM token registered for user ${userId.toString()}`);

    return NextResponse.json({
      success: true,
      message: "FCM token registered successfully",
      token: fcmToken.token,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error registering FCM token:", error);
    return NextResponse.json(
      {
        error: "Failed to register FCM token",
        detail:
          process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 },
    );
  }
}

async function putHandler(req: NextRequest, context: AuthCtx) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const { oldToken, newToken, userId: bodyUserId } = body;

    if (!oldToken || !newToken) {
      return NextResponse.json(
        { error: "oldToken and newToken are required" },
        { status: 400 },
      );
    }

    if (
      bodyUserId &&
      String(bodyUserId) !== context.userId.toString()
    ) {
      return NextResponse.json(
        { error: "Cannot refresh token for another user" },
        { status: 403 },
      );
    }

    const userId = context.userId;

    const tokenRecord = await FCMToken.findOne({
      token: oldToken,
      userId,
    });

    if (!tokenRecord) {
      const fcmToken = await FCMToken.create({
        token: newToken,
        userId,
        registeredAt: new Date(),
        lastSeenAt: new Date(),
        isActive: true,
      });

      return NextResponse.json({
        success: true,
        message: "New FCM token registered",
        token: fcmToken.token,
      });
    }

    tokenRecord.token = newToken;
    tokenRecord.lastSeenAt = new Date();
    tokenRecord.isActive = true;
    await tokenRecord.save();

    console.log(`FCM token refreshed for user ${userId.toString()}`);

    return NextResponse.json({
      success: true,
      message: "FCM token refreshed successfully",
      token: newToken,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error refreshing FCM token:", error);
    return NextResponse.json(
      {
        error: "Failed to refresh FCM token",
        detail:
          process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 },
    );
  }
}

async function deleteHandler(req: NextRequest, context: AuthCtx) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const { token, userId: bodyUserId } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 },
      );
    }

    if (
      bodyUserId &&
      String(bodyUserId) !== context.userId.toString()
    ) {
      return NextResponse.json(
        { error: "Cannot unregister token for another user" },
        { status: 403 },
      );
    }

    const userId = context.userId;

    await FCMToken.updateOne(
      { token, userId },
      { isActive: false, deregisteredAt: new Date() },
    );

    console.log(`FCM token deregistered for user ${userId.toString()}`);

    return NextResponse.json({
      success: true,
      message: "FCM token deregistered successfully",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error deregistering FCM token:", error);
    return NextResponse.json(
      {
        error: "Failed to deregister FCM token",
        detail:
          process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 },
    );
  }
}

export const POST = withAuth(postHandler);
export const PUT = withAuth(putHandler);
export const DELETE = withAuth(deleteHandler);
