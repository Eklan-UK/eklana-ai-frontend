/**
 * FCM Test Notification API Endpoint
 * POST /api/v1/fcm/test-notification - Send test notification to all users (ADMIN ONLY)
 */

import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { Types } from "mongoose";
import FCMToken from "@/models/fcm-token";
import { sendNotificationToUsers, NotificationType } from "@/lib/fcm-trigger";

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
): Promise<NextResponse> {
  try {
    // Check authorization - only admins can send test notifications
    if (context.userRole !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized - admin role required" },
        { status: 403 },
      );
    }

    // Get all active FCM tokens
    const tokens = await FCMToken.find({
      isActive: true,
    })
      .populate("userId", "_id")
      .select("token userId");

    if (tokens.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No active FCM tokens found",
          recipientCount: 0,
        },
        { status: 200 },
      );
    }

    // Group tokens by userId
    const tokenMap = new Map<string, string[]>();
    const userIds: string[] = [];

    tokens.forEach((token) => {
      const userId = token.userId.toString();
      if (!tokenMap.has(userId)) {
        tokenMap.set(userId, []);
        userIds.push(userId);
      }
      tokenMap.get(userId)!.push(token.token);
    });

    // Flatten all tokens
    const allTokens = Array.from(tokenMap.values()).flat();

    console.log(
      `Sending test notification to ${allTokens.length} tokens from ${userIds.length} users`,
    );

    // Send test notification
    const result = await sendNotificationToUsers(userIds, allTokens, {
      type: NotificationType.SYSTEM_ALERT,
      title: "🧪 Test Notification",
      body: "Testing notification - If you see this, FCM is working!",
      data: {
        testMessage: "This is a test notification from the admin panel",
        timestamp: new Date().toISOString(),
      },
      actionUrl: "/account",
    });

    return NextResponse.json({
      success: true,
      message: "Test notification sent successfully",
      notificationId: result.notificationId,
      recipientCount: userIds.length,
      tokenCount: allTokens.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
    });
  } catch (error) {
    console.error("Error sending test notification:", error);
    return NextResponse.json(
      {
        error: "Failed to send test notification",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// Export with admin role requirement
export const POST = withRole(["admin"], handler);
