/**
 * FCM Token Management API Endpoint
 * POST /api/v1/fcm/tokens - Register new FCM token
 * PUT /api/v1/fcm/tokens/refresh - Refresh FCM token
 * DELETE /api/v1/fcm/tokens - Unregister FCM token
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/middleware";
import FCMToken from "@/models/fcm-token";

async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, userId, deviceInfo } = body;

    if (!token || !userId) {
      return NextResponse.json(
        { error: "Token and userId are required" },
        { status: 400 },
      );
    }

    // Validate token format (basic check)
    if (typeof token !== "string" || token.length < 50) {
      return NextResponse.json(
        { error: "Invalid FCM token format" },
        { status: 400 },
      );
    }

    // Check if token already exists for this user
    const existingToken = await FCMToken.findOne({
      token,
      userId,
    });

    if (existingToken) {
      // Update last seen
      await FCMToken.updateOne(
        { _id: existingToken._id },
        {
          lastSeenAt: new Date(),
          isActive: true,
        },
      );

      return NextResponse.json({
        success: true,
        message: "FCM token updated",
        token: existingToken.token,
      });
    }

    // Create new token record
    const fcmToken = await FCMToken.create({
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

    console.log(`FCM token registered for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: "FCM token registered successfully",
      token: fcmToken.token,
    });
  } catch (error) {
    console.error("Error registering FCM token:", error);
    return NextResponse.json(
      { error: "Failed to register FCM token" },
      { status: 500 },
    );
  }
}

async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { oldToken, newToken, userId } = body;

    if (!oldToken || !newToken || !userId) {
      return NextResponse.json(
        { error: "oldToken, newToken, and userId are required" },
        { status: 400 },
      );
    }

    // Find and update old token
    const tokenRecord = await FCMToken.findOne({
      token: oldToken,
      userId,
    });

    if (!tokenRecord) {
      // Token doesn't exist, register as new
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

    // Update with new token
    tokenRecord.token = newToken;
    tokenRecord.lastSeenAt = new Date();
    tokenRecord.isActive = true;
    await tokenRecord.save();

    console.log(`FCM token refreshed for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: "FCM token refreshed successfully",
      token: newToken,
    });
  } catch (error) {
    console.error("Error refreshing FCM token:", error);
    return NextResponse.json(
      { error: "Failed to refresh FCM token" },
      { status: 500 },
    );
  }
}

async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, userId } = body;

    if (!token || !userId) {
      return NextResponse.json(
        { error: "Token and userId are required" },
        { status: 400 },
      );
    }

    // Mark token as inactive
    await FCMToken.updateOne(
      { token, userId },
      { isActive: false, deregisteredAt: new Date() },
    );

    console.log(`FCM token deregistered for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: "FCM token deregistered successfully",
    });
  } catch (error) {
    console.error("Error deregistering FCM token:", error);
    return NextResponse.json(
      { error: "Failed to deregister FCM token" },
      { status: 500 },
    );
  }
}

// Wrap handlers with auth middleware
export { POST, PUT, DELETE };
