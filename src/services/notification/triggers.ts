/**
 * Notification Triggers
 * Event-based notification triggers for various app events
 */

// FCM-based notification imports
import {
  sendNotificationToUser,
  sendNotificationToUsers,
  NotificationType,
} from "@/lib/fcm-trigger";
import { connectToDatabase } from "@/lib/api/db";
import FCMToken from "@/models/fcm-token";
import User from "@/models/user";
import { StreakService } from "@/services/streak.service";
import { sendNotification } from "@/services/notification";
import { PushToken } from "@/models/push-token.model";

/**
 * Trigger when a drill is assigned to a student
 */
export async function onDrillAssigned(
  studentId: string,
  drill: {
    _id: string;
    title: string;
    type: string;
  },
  tutor: {
    name?: string;
    firstName?: string;
    lastName?: string;
  },
) {
  const tutorName =
    tutor.name ||
    `${tutor.firstName || ""} ${tutor.lastName || ""}`.trim() ||
    "Your tutor";

  console.log("[Notification Trigger] onDrillAssigned called:", {
    studentId,
    drillId: drill._id,
    drillTitle: drill.title,
    tutorName,
  });

  try {
    await connectToDatabase();

    // Get student's FCM tokens
    const fcmTokens = await FCMToken.find({
      userId: studentId,
      isActive: true,
    })
      .select("token")
      .lean()
      .exec();

    if (fcmTokens.length === 0) {
      console.warn(
        "[Notification Trigger] No active FCM tokens found for student:",
        studentId,
      );
      return null;
    }

    const tokens = fcmTokens.map((t) => t.token);

    const result = await sendNotificationToUsers([studentId], tokens, {
      title: "New Drill Assigned! 📚",
      body: `${tutorName} assigned you "${drill.title}"`,
      type: NotificationType.ASSIGNMENT_DUE,
      data: {
        screen: "DrillDetail",
        resourceId: drill._id,
        resourceType: "drill",
        url: `/account/drills/${drill._id}`,
      },
    });

    console.log("[Notification Trigger] onDrillAssigned result:", result);
    return result;
  } catch (error) {
    console.error("[Notification Trigger] onDrillAssigned error:", error);
    throw error;
  }
}

/**
 * Trigger when a drill is due soon (reminder)
 */
export async function onDrillDueSoon(
  studentId: string,
  drill: {
    _id: string;
    title: string;
  },
  hoursUntilDue: number,
) {
  const timeText =
    hoursUntilDue <= 1
      ? "in less than an hour"
      : hoursUntilDue <= 24
        ? `in ${hoursUntilDue} hours`
        : "tomorrow";

  console.log("[Notification Trigger] onDrillDueSoon called:", {
    studentId,
    drillId: drill._id,
    hoursUntilDue,
  });

  try {
    await connectToDatabase();

    // Get student's FCM tokens
    const fcmTokens = await FCMToken.find({
      userId: studentId,
      isActive: true,
    })
      .select("token")
      .lean()
      .exec();

    if (fcmTokens.length === 0) {
      console.warn(
        "[Notification Trigger] No active FCM tokens found for student:",
        studentId,
      );
      return null;
    }

    const tokens = fcmTokens.map((t) => t.token);

    const result = await sendNotificationToUsers([studentId], tokens, {
      title: "Drill Due Soon ⏰",
      body: `"${drill.title}" is due ${timeText}`,
      type: NotificationType.LESSON_REMINDER,
      data: {
        screen: "DrillDetail",
        resourceId: drill._id,
        resourceType: "drill",
        url: `/account/drills/${drill._id}`,
      },
    });

    console.log("[Notification Trigger] onDrillDueSoon result:", result);
    return result;
  } catch (error) {
    console.error("[Notification Trigger] onDrillDueSoon error:", error);
    throw error;
  }
}

/**
 * Daily practice reminder sent to a learner.
 * pendingCount > 0: they have drills to do.
 * pendingCount === 0: they've finished or have none assigned — send a motivational nudge.
 */
export async function onDrillPracticeReminder(
  studentId: string,
  pendingCount: number,
  streakDays: number,
) {
  const hasPending = pendingCount > 0;
  const drillWord = pendingCount === 1 ? "drill" : "drills";

  const title = hasPending ? "Time to practise! 📚" : "Well done today! 💪";
  const body = hasPending
    ? `You have ${pendingCount} ${drillWord} waiting. Open your plan and keep the streak going!`
    : streakDays > 0
      ? `You've finished your drills. Keep your ${streakDays}-day streak alive — revisit one to stay sharp.`
      : "You've finished your drills. Revisit one to keep your skills sharp.";

  console.log("[Notification Trigger] onDrillPracticeReminder called:", {
    studentId,
    pendingCount,
    streakDays,
  });

  try {
    await connectToDatabase();

    const fcmTokens = await FCMToken.find({
      userId: studentId,
      isActive: true,
    })
      .select("token")
      .lean()
      .exec();

    if (fcmTokens.length === 0) {
      console.warn(
        "[Notification Trigger] No active FCM tokens for student:",
        studentId,
      );
      return null;
    }

    const tokens = fcmTokens.map((t) => t.token);

    const result = await sendNotificationToUsers([studentId], tokens, {
      title,
      body,
      type: NotificationType.DRILL_REMINDER,
      data: {
        screen: "MyPlan",
        url: "/account/drills",
      },
    });

    console.log("[Notification Trigger] onDrillPracticeReminder result:", result);
    return result;
  } catch (error) {
    console.error("[Notification Trigger] onDrillPracticeReminder error:", error);
    throw error;
  }
}

/**
 * Trigger when a tutor reviews a student's submission
 */
export async function onDrillReviewed(
  studentId: string,
  drill: {
    _id: string;
    title: string;
  },
  assignmentId: string,
  feedback?: {
    score?: number;
    allCorrect?: boolean;
  },
) {
  let body = `Your submission for "${drill.title}" has been reviewed`;

  if (feedback?.allCorrect) {
    body = `Great job! All answers correct on "${drill.title}" ✨`;
  } else if (feedback?.score !== undefined) {
    body = `Your "${drill.title}" was reviewed. Score: ${feedback.score}%`;
  }

  console.log("[Notification Trigger] onDrillReviewed called:", {
    studentId,
    drillId: drill._id,
    feedback,
  });

  try {
    await connectToDatabase();

    // Get student's FCM tokens
    const fcmTokens = await FCMToken.find({
      userId: studentId,
      isActive: true,
    })
      .select("token")
      .lean()
      .exec();

    if (fcmTokens.length === 0) {
      console.warn(
        "[Notification Trigger] No active FCM tokens found for student:",
        studentId,
      );
      return null;
    }

    const tokens = fcmTokens.map((t) => t.token);

    const result = await sendNotificationToUsers([studentId], tokens, {
      title: "Drill Reviewed! ✅",
      body,
      type: NotificationType.ASSIGNMENT_SUBMITTED,
      data: {
        screen: "DrillCompleted",
        resourceId: drill._id,
        resourceType: "drill",
        url: `/account/drills/${drill._id}/completed?assignmentId=${assignmentId}`,
        assignmentId,
      },
    });

    console.log("[Notification Trigger] onDrillReviewed result:", result);
    return result;
  } catch (error) {
    console.error("[Notification Trigger] onDrillReviewed error:", error);
    throw error;
  }
}

/**
 * Trigger when a student completes a drill (notify tutor)
 */
export async function onDrillCompleted(
  tutorId: string,
  student: {
    _id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
  },
  drill: {
    _id: string;
    title: string;
  },
  assignmentId: string,
  score?: number,
) {
  const studentName =
    student.name ||
    `${student.firstName || ""} ${student.lastName || ""}`.trim() ||
    "A student";

  let body = `${studentName} completed "${drill.title}"`;
  if (score !== undefined) {
    body += ` with a score of ${score}%`;
  }

  console.log("[Notification Trigger] onDrillCompleted called:", {
    tutorId,
    studentId: student._id,
    drillId: drill._id,
    score,
  });

  try {
    await connectToDatabase();

    // Get tutor's FCM tokens
    const fcmTokens = await FCMToken.find({
      userId: tutorId,
      isActive: true,
    })
      .select("token")
      .lean()
      .exec();

    if (fcmTokens.length === 0) {
      console.warn(
        "[Notification Trigger] No active FCM tokens found for tutor:",
        tutorId,
      );
      return null;
    }

    const tokens = fcmTokens.map((t) => t.token);

    const result = await sendNotificationToUsers([tutorId], tokens, {
      title: "Drill Completed 📝",
      body,
      type: NotificationType.DRILL_COMPLETED,
      data: {
        screen: "TutorStudentDetail",
        resourceId: student._id,
        resourceType: "student",
        url: `/tutor/students/${student._id}`,
        drillId: drill._id,
        assignmentId,
      },
    });

    console.log("[Notification Trigger] onDrillCompleted result:", result);
    return result;
  } catch (error) {
    console.error("[Notification Trigger] onDrillCompleted error:", error);
    throw error;
  }
}

/**
 * Trigger when daily focus becomes available
 */
export async function onDailyFocusAvailable(
  userIds: string[],
  focus: {
    _id: string;
    title: string;
  },
) {
  console.log("[Notification Trigger] onDailyFocusAvailable called:", {
    userCount: userIds.length,
    focusId: focus._id,
    focusTitle: focus.title,
  });

  if (userIds.length === 0) {
    console.warn(
      "[Notification Trigger] No user IDs provided to onDailyFocusAvailable",
    );
    return null;
  }

  try {
    await connectToDatabase();

    // Get FCM tokens for all users
    const fcmTokens = await FCMToken.find({
      userId: { $in: userIds },
      isActive: true,
    })
      .select("userId token")
      .lean()
      .exec();

    if (fcmTokens.length === 0) {
      console.warn(
        "[Notification Trigger] No active FCM tokens found for users:",
        userIds,
      );
      return null;
    }

    // Group tokens by user for tracking
    const tokensByUser = new Map<string, string[]>();
    for (const tokenDoc of fcmTokens) {
      const userId = tokenDoc.userId.toString();
      if (!tokensByUser.has(userId)) {
        tokensByUser.set(userId, []);
      }
      tokensByUser.get(userId)!.push(tokenDoc.token);
    }

    // Flatten all tokens for sending
    const tokens = fcmTokens.map((t) => t.token);
    const usersWithTokens = Array.from(tokensByUser.keys());

    const result = await sendNotificationToUsers(usersWithTokens, tokens, {
      title: "Today's Focus is Ready! 🎯",
      body: focus.title,
      type: NotificationType.ASSIGNMENT_DUE,
      data: {
        screen: "DailyFocus",
        resourceId: focus._id,
        resourceType: "daily_focus",
        url: `/account/daily-focus/${focus._id}`,
      },
    });

    console.log("[Notification Trigger] onDailyFocusAvailable result:", result);
    return result;
  } catch (error) {
    console.error("[Notification Trigger] onDailyFocusAvailable error:", error);
    throw error;
  }
}

/**
 * Trigger when a student earns an achievement
 */
export async function onAchievementUnlocked(
  studentId: string,
  achievement: {
    id: string;
    title: string;
    description: string;
    icon?: string;
  },
) {
  console.log("[Notification Trigger] onAchievementUnlocked called:", {
    studentId,
    achievementId: achievement.id,
    achievementTitle: achievement.title,
  });

  try {
    await connectToDatabase();

    // Get student's FCM tokens
    const fcmTokens = await FCMToken.find({
      userId: studentId,
      isActive: true,
    })
      .select("token")
      .lean()
      .exec();

    if (fcmTokens.length === 0) {
      console.warn(
        "[Notification Trigger] No active FCM tokens found for student:",
        studentId,
      );
      return null;
    }

    const tokens = fcmTokens.map((t) => t.token);

    const result = await sendNotificationToUsers([studentId], tokens, {
      title: "Achievement Unlocked! 🏆",
      body: `${achievement.title}: ${achievement.description}`,
      type: NotificationType.ACHIEVEMENT_UNLOCKED,
      data: {
        screen: "Achievements",
        resourceId: achievement.id,
        resourceType: "achievement",
        url: "/account/achievements",
        ...(achievement.icon && { achievementIcon: achievement.icon }),
      },
    });

    console.log("[Notification Trigger] onAchievementUnlocked result:", result);
    return result;
  } catch (error) {
    console.error("[Notification Trigger] onAchievementUnlocked error:", error);
    throw error;
  }
}

/**
 * Trigger for streak reminders.
 *
 * Waterfall delivery — no duplicates:
 *   1. Always fire the unified path (Expo mobile + modern Web Push).
 *   2. Check if the student has an active modern web push token.
 *   3. Only run legacy FCM if they do NOT — prevents double-notifying
 *      web users who are registered in both collections.
 */
export async function onStreakReminder(studentId: string, streakDays: number) {
  console.log("[Notification Trigger] onStreakReminder called:", {
    studentId,
    streakDays,
  });

  try {
    await connectToDatabase();

    const liveStreakData = await StreakService.getStreakData(studentId);
    const resolvedStreakDays = liveStreakData.currentStreak;

    if (resolvedStreakDays <= 0) {
      return null;
    }

    const title = "Don't Break Your Streak! 🔥";
    const body = `You have a ${resolvedStreakDays}-day streak. Complete a drill today to keep it going!`;
    const notifData = { screen: "Home", url: "/account" };

    // Step 1: Always fire unified path (Expo mobile + modern Web Push)
    const unifiedResult = await sendNotification({
      userId: studentId,
      title,
      body,
      type: "drill_reminder",
      data: notifData,
    });

    // Step 2: Lightweight check for a modern web push token
    const hasModernWebToken = await PushToken.exists({
      userId: studentId,
      platform: "web",
      isActive: true,
    });

    // Step 3: FCM fallback only when user has no modern web token
    let fcmResult = null;
    if (!hasModernWebToken) {
      const fcmTokens = await FCMToken.find({
        userId: studentId,
        isActive: true,
      })
        .select("token")
        .lean()
        .exec();

      if (fcmTokens.length > 0) {
        fcmResult = await sendNotificationToUsers(
          [studentId],
          fcmTokens.map((t) => t.token),
          {
            title,
            body,
            type: NotificationType.LESSON_REMINDER,
            data: { screen: "Home", url: "/account" },
          },
        );
      }
    }

    const anySent = unifiedResult.totalSent > 0 || fcmResult !== null;
    const result = anySent ? { unified: unifiedResult, fcm: fcmResult } : null;

    console.log("[Notification Trigger] onStreakReminder result:", result);
    return result;
  } catch (error) {
    console.error("[Notification Trigger] onStreakReminder error:", error);
    throw error;
  }
}

/**
 * Trigger when a new student is assigned to a tutor
 */
export async function onStudentAssigned(
  tutorId: string,
  student: {
    _id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email: string;
  },
) {
  const studentName =
    student.name ||
    `${student.firstName || ""} ${student.lastName || ""}`.trim() ||
    student.email;

  console.log("[Notification Trigger] onStudentAssigned called:", {
    tutorId,
    studentId: student._id,
    studentName,
  });

  try {
    await connectToDatabase();

    // Get tutor's FCM tokens
    const fcmTokens = await FCMToken.find({
      userId: tutorId,
      isActive: true,
    })
      .select("token")
      .lean()
      .exec();

    if (fcmTokens.length === 0) {
      console.warn(
        "[Notification Trigger] No active FCM tokens found for tutor:",
        tutorId,
      );
      return null;
    }

    const tokens = fcmTokens.map((t) => t.token);

    const result = await sendNotificationToUsers([tutorId], tokens, {
      title: "New Student Assigned 👋",
      body: `${studentName} has been assigned to you`,
      type: NotificationType.ADMIN_NOTIFICATION,
      data: {
        screen: "TutorStudentDetail",
        resourceId: student._id,
        resourceType: "student",
        url: `/tutor/students/${student._id}`,
      },
    });

    console.log("[Notification Trigger] onStudentAssigned result:", result);
    return result;
  } catch (error) {
    console.error("[Notification Trigger] onStudentAssigned error:", error);
    throw error;
  }
}

/**
 * Trigger for system announcements
 */
export async function onSystemAnnouncement(
  userIds: string[],
  announcement: {
    title: string;
    body: string;
    url?: string;
  },
) {
  console.log('[Notification Trigger] onSystemAnnouncement called:', {
    userCount: userIds.length,
    title: announcement.title,
  });

  if (userIds.length === 0) {
    console.warn('[Notification Trigger] No user IDs provided to onSystemAnnouncement');
    return null;
  }

  try {
    await connectToDatabase();

    // Get FCM tokens for all users
    const fcmTokens = await FCMToken.find({
      userId: { $in: userIds },
      isActive: true,
    })
      .select('userId token')
      .lean()
      .exec();

    if (fcmTokens.length === 0) {
      console.warn('[Notification Trigger] No active FCM tokens found for users:', userIds);
      return null;
    }

    // Group tokens by user for tracking
    const tokensByUser = new Map<string, string[]>();
    for (const tokenDoc of fcmTokens) {
      const userId = tokenDoc.userId.toString();
      if (!tokensByUser.has(userId)) {
        tokensByUser.set(userId, []);
      }
      tokensByUser.get(userId)!.push(tokenDoc.token);
    }

    // Flatten all tokens for sending
    const tokens = fcmTokens.map((t) => t.token);
    const usersWithTokens = Array.from(tokensByUser.keys());

    const result = await sendNotificationToUsers(
      usersWithTokens,
      tokens,
      {
        title: announcement.title,
        body: announcement.body,
        type: NotificationType.SYSTEM_ALERT,
        data: {
          screen: "Notifications",
          url: announcement.url || "/account/notifications",
        },
      }
    );

    console.log('[Notification Trigger] onSystemAnnouncement result:', result);
    return result;
  } catch (error) {
    console.error('[Notification Trigger] onSystemAnnouncement error:', error);
    throw error;
  }
}
