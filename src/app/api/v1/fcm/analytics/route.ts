/**
 * FCM Analytics API Endpoint
 * POST /api/v1/fcm/analytics - Log notification analytics
 */

import { NextRequest, NextResponse } from "next/server";

interface AnalyticsPayload {
  notificationId: string;
  type: string;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  sentAt: Date;
  errors?: string[];
}

async function handler(
  req: NextRequest,
  context: { params: Promise<any> },
): Promise<NextResponse> {
  try {
    const body = (await req.json()) as AnalyticsPayload;

    // Log analytics (in production, save to database or analytics service)
    console.log("[FCM Analytics]", {
      notificationId: body.notificationId,
      type: body.type,
      recipientCount: body.recipientCount,
      successCount: body.successCount,
      failureCount: body.failureCount,
      successRate: `${Math.round((body.successCount / body.recipientCount) * 100)}%`,
      timestamp: new Date().toISOString(),
    });

    // Return success
    return NextResponse.json({
      success: true,
      message: "Analytics logged successfully",
      notificationId: body.notificationId,
    });
  } catch (error) {
    console.error("Error logging FCM analytics:", error);

    // Still return 200 - analytics should not fail the notification
    return NextResponse.json(
      {
        success: false,
        message: "Failed to log analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 200 }, // Return 200 even on error - analytics is optional
    );
  }
}

export const POST = handler;
