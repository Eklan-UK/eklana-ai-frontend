/**
 * FCM Notification Trigger Service
 * Handles sending notifications through FCM with analytics and logging
 */

import axios from "./api/axios";
import {
  sendToDevice,
  sendMulticast,
  sendToTopic,
  sendToCondition,
} from "./fcm-admin";

export enum NotificationType {
  LESSON_REMINDER = "lesson_reminder",
  ASSIGNMENT_DUE = "assignment_due",
  ASSIGNMENT_SUBMITTED = "assignment_submitted",
  PRONUNCIATION_FEEDBACK = "pronunciation_feedback",
  DRILL_COMPLETED = "drill_completed",
  ACHIEVEMENT_UNLOCKED = "achievement_unlocked",
  SOCIAL_FOLLOW = "social_follow",
  COMMENT_REPLY = "comment_reply",
  GAMIFICATION_MILESTONE = "gamification_milestone",
  SYSTEM_ALERT = "system_alert",
  LEARNER_PERFORMANCE = "learner_performance",
  ADMIN_NOTIFICATION = "admin_notification",
}

export interface FCMNotificationPayload {
  type: NotificationType;
  recipientId?: string;
  recipientIds?: string[];
  topic?: string;
  condition?: string;
  title: string;
  body: string;
  image?: string;
  data?: Record<string, string>;
  actionUrl?: string;
}

interface NotificationAnalytics {
  notificationId: string;
  type: NotificationType;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  sentAt: Date;
  errors?: string[];
}

/**
 * Send notification to single recipient
 */
export const sendNotificationToUser = async (
  userId: string,
  token: string,
  payload: Omit<FCMNotificationPayload, "recipientIds" | "topic" | "condition">,
): Promise<NotificationAnalytics> => {
  const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  try {
    const fcmPayload = {
      notification: {
        title: payload.title,
        body: payload.body,
        image: payload.image,
      },
      data: {
        ...payload.data,
        type: payload.type,
        notificationId,
        ...(payload.actionUrl && { actionUrl: payload.actionUrl }),
      },
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: "/icons/favicon-192x192.png",
          badge: "/icons/badge-72x72.png",
          tag: payload.type, // Groups notifications by type
          color: "#4F46E5", // Indigo color
        },
        fcmOptions: {
          link: payload.actionUrl || "/",
        },
      },
    };

    const response = await sendToDevice(token, fcmPayload);

    // Log analytics
    await logNotificationAnalytics({
      notificationId,
      type: payload.type,
      recipientCount: 1,
      successCount: 1,
      failureCount: 0,
      sentAt: new Date(),
    });

    console.log(`Notification sent to user ${userId}:`, response);

    return {
      notificationId,
      type: payload.type,
      recipientCount: 1,
      successCount: 1,
      failureCount: 0,
      sentAt: new Date(),
    };
  } catch (error) {
    console.error(`Error sending notification to user ${userId}:`, error);

    // Log error analytics
    await logNotificationAnalytics({
      notificationId,
      type: payload.type,
      recipientCount: 1,
      successCount: 0,
      failureCount: 1,
      sentAt: new Date(),
      errors: [error instanceof Error ? error.message : "Unknown error"],
    });

    throw error;
  }
};

/**
 * Send notification to multiple recipients
 */
export const sendNotificationToUsers = async (
  userIds: string[],
  tokens: string[],
  payload: Omit<FCMNotificationPayload, "recipientId" | "topic" | "condition">,
): Promise<NotificationAnalytics> => {
  const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  try {
    if (tokens.length === 0) {
      return {
        notificationId,
        type: payload.type,
        recipientCount: 0,
        successCount: 0,
        failureCount: 0,
        sentAt: new Date(),
      };
    }

    const fcmPayload = {
      notification: {
        title: payload.title,
        body: payload.body,
        image: payload.image,
      },
      data: {
        ...payload.data,
        type: payload.type,
        notificationId,
        title: payload.title,
        body: payload.body,
        ...(payload.image && { image: payload.image }),
        ...(payload.actionUrl && { actionUrl: payload.actionUrl }),
      },
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: "/icons/favicon-192x192.png",
          badge: "/icons/badge-72x72.png",
          tag: payload.type,
          color: "#4F46E5",
        },
        fcmOptions: {
          link: payload.actionUrl || "/",
        },
      },
    };

    const response = await sendMulticast(tokens, fcmPayload);

    // Log analytics
    await logNotificationAnalytics({
      notificationId,
      type: payload.type,
      recipientCount: tokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount,
      sentAt: new Date(),
    });

    console.log(
      `Notification sent to ${response.successCount}/${tokens.length} recipients`,
    );

    return {
      notificationId,
      type: payload.type,
      recipientCount: tokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount,
      sentAt: new Date(),
    };
  } catch (error) {
    console.error(
      `Error sending notification to ${tokens.length} users:`,
      error,
    );

    // Log error analytics
    await logNotificationAnalytics({
      notificationId,
      type: payload.type,
      recipientCount: tokens.length,
      successCount: 0,
      failureCount: tokens.length,
      sentAt: new Date(),
      errors: [error instanceof Error ? error.message : "Unknown error"],
    });

    throw error;
  }
};

/**
 * Send notification to topic
 */
export const sendNotificationToTopic = async (
  topic: string,
  payload: Omit<
    FCMNotificationPayload,
    "recipientId" | "recipientIds" | "condition"
  >,
): Promise<NotificationAnalytics> => {
  const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  try {
    const fcmPayload = {
      notification: {
        title: payload.title,
        body: payload.body,
        image: payload.image,
      },
      data: {
        ...payload.data,
        type: payload.type,
        notificationId,
        ...(payload.actionUrl && { actionUrl: payload.actionUrl }),
      },
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: "/icons/favicon-192x192.png",
          badge: "/icons/badge-72x72.png",
          tag: payload.type,
          color: "#4F46E5",
        },
        fcmOptions: {
          link: payload.actionUrl || "/",
        },
      },
    };

    const response = await sendToTopic(topic, fcmPayload);

    // Log analytics
    await logNotificationAnalytics({
      notificationId,
      type: payload.type,
      recipientCount: -1, // Unknown for topic-based
      successCount: 1,
      failureCount: 0,
      sentAt: new Date(),
    });

    console.log(`Notification sent to topic ${topic}:`, response);

    return {
      notificationId,
      type: payload.type,
      recipientCount: -1,
      successCount: 1,
      failureCount: 0,
      sentAt: new Date(),
    };
  } catch (error) {
    console.error(`Error sending notification to topic ${topic}:`, error);

    // Log error analytics
    await logNotificationAnalytics({
      notificationId,
      type: payload.type,
      recipientCount: -1,
      successCount: 0,
      failureCount: 1,
      sentAt: new Date(),
      errors: [error instanceof Error ? error.message : "Unknown error"],
    });

    throw error;
  }
};

/**
 * Send notification with condition
 * Example condition: "'topic_students' in topics && 'class_A' in topics"
 */
export const sendNotificationWithCondition = async (
  condition: string,
  payload: Omit<
    FCMNotificationPayload,
    "recipientId" | "recipientIds" | "topic"
  >,
): Promise<NotificationAnalytics> => {
  const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  try {
    const fcmPayload = {
      notification: {
        title: payload.title,
        body: payload.body,
        image: payload.image,
      },
      data: {
        ...payload.data,
        type: payload.type,
        notificationId,
        ...(payload.actionUrl && { actionUrl: payload.actionUrl }),
      },
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: "/icons/favicon-192x192.png",
          badge: "/icons/badge-72x72.png",
          tag: payload.type,
          color: "#4F46E5",
        },
        fcmOptions: {
          link: payload.actionUrl || "/",
        },
      },
    };

    const response = await sendToCondition(condition, fcmPayload);

    // Log analytics
    await logNotificationAnalytics({
      notificationId,
      type: payload.type,
      recipientCount: -1,
      successCount: 1,
      failureCount: 0,
      sentAt: new Date(),
    });

    console.log(`Notification sent with condition:`, response);

    return {
      notificationId,
      type: payload.type,
      recipientCount: -1,
      successCount: 1,
      failureCount: 0,
      sentAt: new Date(),
    };
  } catch (error) {
    console.error(`Error sending notification with condition:`, error);

    // Log error analytics
    await logNotificationAnalytics({
      notificationId,
      type: payload.type,
      recipientCount: -1,
      successCount: 0,
      failureCount: 1,
      sentAt: new Date(),
      errors: [error instanceof Error ? error.message : "Unknown error"],
    });

    throw error;
  }
};

/**
 * Log notification analytics to backend
 * NOTE: This is optional - failures won't affect notifications
 */
export const logNotificationAnalytics = async (
  analytics: NotificationAnalytics,
): Promise<void> => {
  try {
    // Analytics endpoint is optional - only log if endpoint exists
    await axios.post("/fcm/analytics", analytics);
  } catch (error) {
    // Silently fail - analytics should not block notification sending
    // In production, this would go to a separate analytics service
    if (error instanceof Error) {
      console.debug("Analytics logging skipped:", error.message);
    }
  }
};

/**
 * Get notification templates
 */
export const getNotificationTemplate = (
  type: NotificationType,
): Partial<FCMNotificationPayload> => {
  const templates: Record<NotificationType, Partial<FCMNotificationPayload>> = {
    [NotificationType.LESSON_REMINDER]: {
      title: "Lesson Reminder",
      body: "Your lesson starts in 10 minutes",
    },
    [NotificationType.ASSIGNMENT_DUE]: {
      title: "Assignment Due Soon",
      body: "Your assignment is due in 2 hours",
    },
    [NotificationType.ASSIGNMENT_SUBMITTED]: {
      title: "Assignment Submitted",
      body: "Your assignment has been submitted successfully",
    },
    [NotificationType.PRONUNCIATION_FEEDBACK]: {
      title: "Pronunciation Feedback",
      body: "Your pronunciation has been evaluated",
    },
    [NotificationType.DRILL_COMPLETED]: {
      title: "Drill Completed",
      body: "Great job! You completed the drill",
    },
    [NotificationType.ACHIEVEMENT_UNLOCKED]: {
      title: "🏆 Achievement Unlocked",
      body: "You have unlocked a new achievement",
    },
    [NotificationType.SOCIAL_FOLLOW]: {
      title: "New Follower",
      body: "Someone followed you",
    },
    [NotificationType.COMMENT_REPLY]: {
      title: "New Reply",
      body: "Someone replied to your comment",
    },
    [NotificationType.GAMIFICATION_MILESTONE]: {
      title: "🎯 Milestone Reached",
      body: "You have reached a new milestone",
    },
    [NotificationType.SYSTEM_ALERT]: {
      title: "System Alert",
      body: "Important system notification",
    },
    [NotificationType.LEARNER_PERFORMANCE]: {
      title: "Performance Update",
      body: "Your learning performance has been updated",
    },
    [NotificationType.ADMIN_NOTIFICATION]: {
      title: "Admin Message",
      body: "You have a message from the administrator",
    },
  };

  return templates[type] || templates[NotificationType.SYSTEM_ALERT];
};

export default {
  sendNotificationToUser,
  sendNotificationToUsers,
  sendNotificationToTopic,
  sendNotificationWithCondition,
  logNotificationAnalytics,
  getNotificationTemplate,
  NotificationType,
};
