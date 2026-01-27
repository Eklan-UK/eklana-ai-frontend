/**
 * FCM Send Notification API Endpoint
 * POST /api/v1/fcm/send-notification - Send notification to user(s)
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth, withRole } from "@/lib/api/middleware";
import { Types } from "mongoose";
import FCMToken from "@/models/fcm-token";
import {
  sendNotificationToUser,
  sendNotificationToUsers,
  sendNotificationToTopic,
  NotificationType,
} from "@/lib/fcm-trigger";

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
): Promise<NextResponse> {
  try {
    // Check authorization - only admins can send notifications
    if (context.userRole !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized - admin role required" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const {
      type,
      recipientId,
      recipientIds,
      topic,
      title,
      body: notificationBody,
      image,
      data,
      actionUrl,
    } = body;

    // Validate required fields
    if (!type || !title || !notificationBody) {
      return NextResponse.json(
        {
          error: "type, title, and body are required",
        },
        { status: 400 },
      );
    }

    // Validate notification type
    if (!Object.values(NotificationType).includes(type)) {
      return NextResponse.json(
        {
          error: `Invalid notification type. Must be one of: ${Object.values(
            NotificationType,
          ).join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Must have either recipientId, recipientIds, or topic
    if (
      !recipientId &&
      (!recipientIds || recipientIds.length === 0) &&
      !topic
    ) {
      return NextResponse.json(
        {
          error: "Must provide either recipientId, recipientIds, or topic",
        },
        { status: 400 },
      );
    }

    const payload = {
      type,
      title,
      body: notificationBody,
      ...(image && { image }),
      ...(data && { data }),
      ...(actionUrl && { actionUrl }),
    };

    // Send to single user
    if (recipientId) {
      const tokens = await FCMToken.find({
        userId: recipientId,
        isActive: true,
      }).select("token");

      if (tokens.length === 0) {
        console.warn(`No active FCM tokens for user ${recipientId}`);
        return NextResponse.json(
          {
            success: false,
            error: "No active FCM tokens found for recipient",
          },
          { status: 404 },
        );
      }

      if (tokens.length === 1) {
        const result = await sendNotificationToUser(
          recipientId,
          tokens[0].token,
          { ...payload, recipientId },
        );

        return NextResponse.json({
          success: true,
          notificationId: result.notificationId,
          recipientCount: 1,
          successCount: result.successCount,
          failureCount: result.failureCount,
        });
      } else {
        // Multiple tokens for same user (multiple devices)
        const tokenStrings = tokens.map((t) => t.token);
        const result = await sendNotificationToUsers(
          [recipientId],
          tokenStrings,
          { ...payload, recipientId },
        );

        return NextResponse.json({
          success: true,
          notificationId: result.notificationId,
          recipientCount: 1,
          successCount: result.successCount,
          failureCount: result.failureCount,
        });
      }
    }

    // Send to multiple users
    if (recipientIds && recipientIds.length > 0) {
      const tokens = await FCMToken.find({
        userId: { $in: recipientIds },
        isActive: true,
      }).select("token");

      if (tokens.length === 0) {
        console.warn(
          `No active FCM tokens for users: ${recipientIds.join(",")}`,
        );
        return NextResponse.json(
          {
            success: false,
            error: "No active FCM tokens found for recipients",
          },
          { status: 404 },
        );
      }

      const tokenStrings = tokens.map((t) => t.token);
      const result = await sendNotificationToUsers(recipientIds, tokenStrings, {
        ...payload,
        recipientIds,
      });

      return NextResponse.json({
        success: true,
        notificationId: result.notificationId,
        recipientCount: recipientIds.length,
        successCount: result.successCount,
        failureCount: result.failureCount,
      });
    }

    // Send to topic
    if (topic) {
      const result = await sendNotificationToTopic(topic, {
        ...payload,
        topic,
      });

      return NextResponse.json({
        success: true,
        notificationId: result.notificationId,
        topic,
        successCount: result.successCount,
        failureCount: result.failureCount,
      });
    }

    // Fallback - should not reach here due to earlier validation
    return NextResponse.json(
      { error: "No valid recipient specified" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error sending FCM notification:", error);
    return NextResponse.json(
      {
        error: "Failed to send notification",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// Require admin role to send notifications
export const POST = withRole(["admin"], handler);
