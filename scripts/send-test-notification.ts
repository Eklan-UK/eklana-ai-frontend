#!/usr/bin/env ts-node

/**
 * FCM Test Notification Script (TypeScript)
 * Send a test notification to all active users
 *
 * Prefer the local HTTP runner (no ts-node required):
 *   cp scripts/local-test-notification.example.mjs scripts/local-test-notification.mjs
 *   node scripts/local-test-notification.mjs
 *
 * This file requires tsx if run directly:
 *   npx tsx scripts/send-test-notification.ts <adminUserId>
 */

import mongoose from "mongoose";
import FCMToken from "../src/models/fcm-token";
import {
  sendNotificationToUsers,
  NotificationType,
} from "../src/lib/fcm-trigger";

const MONGO_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/elkan-ai";

async function sendTestNotification(adminUserId?: string) {
  try {
    // Connect to MongoDB
    console.log("📦 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get all active FCM tokens
    console.log("\n🔍 Finding all active FCM tokens...");
    const tokens = await FCMToken.find({
      isActive: true,
    })
      .populate("userId", "_id")
      .select("token userId");

    if (tokens.length === 0) {
      console.log("⚠️  No active FCM tokens found");
      console.log("\nMake sure users have:");
      console.log("  1. Opened the app in a browser");
      console.log("  2. Granted notification permission");
      console.log("  3. Service worker is registered");
      await mongoose.disconnect();
      return;
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

    const allTokens = Array.from(tokenMap.values()).flat();

    console.log(
      `✅ Found ${allTokens.length} tokens from ${userIds.length} users`,
    );
    console.log(`   Sample token: ${allTokens[0].substring(0, 50)}...`);

    // Send test notification
    console.log("\n📨 Sending test notification...");
    const result = await sendNotificationToUsers(userIds, allTokens, {
      type: NotificationType.SYSTEM_ALERT,
      title: "🧪 Test Notification",
      body: "Testing notification - If you see this, FCM is working!",
      data: {
        testMessage:
          "This is a test notification sent at " + new Date().toISOString(),
        sentByAdmin: adminUserId || "unknown",
      },
      actionUrl: "/account",
    });

    console.log("\n✅ Notification sent successfully!");
    console.log(`   Notification ID: ${result.notificationId}`);
    console.log(`   Success: ${result.successCount}/${allTokens.length}`);
    console.log(`   Failed: ${result.failureCount}/${allTokens.length}`);

    if (result.failureCount > 0) {
      console.log("\n⚠️  Some notifications failed to send");
      console.log("   This may be due to:");
      console.log("   - Invalid or expired tokens");
      console.log("   - User has uninstalled the app");
      console.log("   - Firebase quota exceeded");
    }

    console.log("\n📋 What to check now:");
    console.log("   1. Open the web app in a browser");
    console.log("   2. Check the browser console for logs");
    console.log("   3. Look for notification in bottom-right corner");
    console.log("   4. If app is in background, check browser notifications");

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error sending test notification:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Get admin user ID from command line args
const adminUserId = process.argv[2];

sendTestNotification(adminUserId);
