/**
 * Notification Triggers
 * Event-based notification triggers for various app events
 */

// FCM-based notification imports
import {
  sendNotificationToUsers,
  NotificationType,
} from "@/lib/fcm-trigger";
import { connectToDatabase } from "@/lib/api/db";
import FCMToken from "@/models/fcm-token";
import { StreakService } from "@/services/streak.service";
import { sendUnifiedWithFcmFallback } from "@/services/notification/delivery";
import { encodeWeekStartDate } from "@/lib/challenges/weekly-challenge-url";

export type OnDrillAssignedDeps = {
  connect?: typeof connectToDatabase;
  sendUnified?: typeof sendUnifiedWithFcmFallback;
};

/**
 * Trigger when a drill is assigned to a student.
 * In-app inbox + Expo / web push / legacy FCM fallback (no early return on missing FCM).
 *
 * Mobile payload contract:
 *   data.screen = 'DrillDetail'
 *   data.resourceId = drillId
 *   data.url = '/account/drills/{id}'
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
  deps: OnDrillAssignedDeps = {},
) {
  const tutorName =
    tutor.name ||
    `${tutor.firstName || ""} ${tutor.lastName || ""}`.trim() ||
    "Your tutor";

  const title = "New Drill Assigned! 📚";
  const body = `${tutorName} assigned you "${drill.title}"`;
  const drillPath = `/account/drills/${drill._id}`;
  const notifData = {
    screen: "DrillDetail",
    resourceId: drill._id,
    resourceType: "drill",
    url: drillPath,
  };
  const connect = deps.connect ?? connectToDatabase;
  const sendUnified = deps.sendUnified ?? sendUnifiedWithFcmFallback;

  console.log("[Notification Trigger] onDrillAssigned called:", {
    studentId,
    drillId: drill._id,
    drillTitle: drill.title,
    tutorName,
  });

  try {
    await connect();

    const delivery = await sendUnified({
      userId: studentId,
      title,
      body,
      type: "drill_assigned",
      data: notifData,
      fcmType: NotificationType.ASSIGNMENT_DUE,
      fcmData: {
        screen: "DrillDetail",
        resourceId: drill._id,
        resourceType: "drill",
        url: drillPath,
      },
      actionUrl: drillPath,
    });

    const result = delivery.delivered
      ? { unified: delivery.unified, fcm: delivery.fcm, pushDelivered: delivery.pushDelivered }
      : null;

    if (!delivery.pushDelivered) {
      console.warn(
        "[Notification Trigger] No push delivery for student (in-app may still exist):",
        studentId,
      );
    }

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
 * 6 PM local-time nudge when the learner has not completed a qualifying drill today.
 */
export async function onDailyPracticeNudge(
  studentId: string,
  params?: { pendingCount?: number; streakDays?: number },
) {
  const pendingCount = params?.pendingCount ?? 0;
  let body =
    "You haven't completed a drill yet today. Open your plan and keep learning.";
  if (pendingCount > 0) {
    const drillWord = pendingCount === 1 ? "drill" : "drills";
    body += ` You have ${pendingCount} ${drillWord} waiting.`;
  }

  const title = "Time to practise today";

  console.log("[Notification Trigger] onDailyPracticeNudge called:", {
    studentId,
    pendingCount,
    streakDays: params?.streakDays,
  });

  try {
    await connectToDatabase();

    const notifData = { screen: "MyPlan", url: "/account/drills" };

    const delivery = await sendUnifiedWithFcmFallback({
      userId: studentId,
      title,
      body,
      type: "drill_reminder",
      data: notifData,
      fcmType: NotificationType.DRILL_REMINDER,
      fcmData: notifData,
      actionUrl: "/account/drills",
    });

    const result = delivery.delivered
      ? { unified: delivery.unified, fcm: delivery.fcm, pushDelivered: delivery.pushDelivered }
      : null;

    if (!delivery.pushDelivered) {
      console.warn(
        "[Notification Trigger] No push delivery for student (in-app may still exist):",
        studentId,
      );
    }

    console.log("[Notification Trigger] onDailyPracticeNudge result:", result);
    return result;
  } catch (error) {
    console.error("[Notification Trigger] onDailyPracticeNudge error:", error);
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

    const notifData = { screen: "MyPlan", url: "/account/drills" };

    const delivery = await sendUnifiedWithFcmFallback({
      userId: studentId,
      title,
      body,
      type: "drill_reminder",
      data: notifData,
      fcmType: NotificationType.DRILL_REMINDER,
      fcmData: notifData,
      actionUrl: "/account/drills",
    });

    const result = delivery.delivered
      ? { unified: delivery.unified, fcm: delivery.fcm, pushDelivered: delivery.pushDelivered }
      : null;

    if (!delivery.pushDelivered) {
      console.warn(
        "[Notification Trigger] No push delivery for student (in-app may still exist):",
        studentId,
      );
    }

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

    const delivery = await sendUnifiedWithFcmFallback({
      userId: studentId,
      title,
      body,
      type: "drill_reminder",
      data: notifData,
      fcmType: NotificationType.LESSON_REMINDER,
      fcmData: notifData,
      actionUrl: "/account",
    });

    const result = delivery.delivered
      ? { unified: delivery.unified, fcm: delivery.fcm, pushDelivered: delivery.pushDelivered }
      : null;

    console.log("[Notification Trigger] onStreakReminder result:", result);
    return result;
  } catch (error) {
    console.error("[Notification Trigger] onStreakReminder error:", error);
    throw error;
  }
}

/**
 * Class session reminder — in-app + push alongside email cron.
 *
 * Mobile payload contract:
 *   data.screen = 'Classes'
 *   data.resourceId = sessionId
 *   data.url = '/account/classes'
 */
export async function onClassSessionReminder(
  studentId: string,
  params: {
    sessionId: string;
    seriesTitle: string;
    minutesBefore: number;
    joinUrl?: string;
  },
) {
  const { sessionId, seriesTitle, minutesBefore } = params;
  const title =
    minutesBefore === 60
      ? 'Class starts in 1 hour'
      : `Class starts in ${minutesBefore} minute${minutesBefore === 1 ? '' : 's'}`;
  const body = `${seriesTitle} — tap to open your schedule.`;
  const notifData = {
    screen: 'Classes',
    resourceId: sessionId,
    url: '/account/classes',
  };

  console.log('[Notification Trigger] onClassSessionReminder called:', {
    studentId,
    sessionId,
    minutesBefore,
  });

  try {
    await connectToDatabase();

    const delivery = await sendUnifiedWithFcmFallback({
      userId: studentId,
      title,
      body,
      type: 'class_session_reminder',
      data: notifData,
      fcmType: NotificationType.CLASS_SESSION_REMINDER,
      fcmData: {
        screen: 'Classes',
        resourceId: sessionId,
        url: '/account/classes',
        sessionId,
        reminderKind: String(minutesBefore),
      },
      actionUrl: '/account/classes',
    });

    const result = delivery.delivered
      ? { unified: delivery.unified, fcm: delivery.fcm, pushDelivered: delivery.pushDelivered }
      : null;

    console.log('[Notification Trigger] onClassSessionReminder result:', result);
    return result;
  } catch (error) {
    console.error('[Notification Trigger] onClassSessionReminder error:', error);
    throw error;
  }
}

/**
 * Post-class NPS form — in-app + push alongside email cron.
 *
 * Mobile payload contract:
 *   data.screen = 'NpsForm'
 *   data.url = formUrl (web deep link)
 */
export async function onClassNpsForm(
  studentId: string,
  params: {
    formUrl: string;
    classTitle: string;
    sessionId?: string;
  },
) {
  const { formUrl, classTitle, sessionId } = params;
  const title = 'How was your class?';
  const body = `Share your feedback on "${classTitle}".`;
  const notifData = {
    screen: 'NpsForm',
    url: formUrl,
    ...(sessionId ? { resourceId: sessionId } : {}),
  };

  console.log('[Notification Trigger] onClassNpsForm called:', {
    studentId,
    sessionId,
    formUrl,
  });

  try {
    await connectToDatabase();

    const delivery = await sendUnifiedWithFcmFallback({
      userId: studentId,
      title,
      body,
      type: 'class_nps_form',
      data: notifData,
      fcmType: NotificationType.CLASS_NPS_FORM,
      fcmData: {
        screen: 'NpsForm',
        url: formUrl,
        ...(sessionId ? { sessionId, resourceId: sessionId } : {}),
      },
      actionUrl: formUrl,
    });

    const result = delivery.delivered
      ? { unified: delivery.unified, fcm: delivery.fcm, pushDelivered: delivery.pushDelivered }
      : null;

    console.log('[Notification Trigger] onClassNpsForm result:', result);
    return result;
  } catch (error) {
    console.error('[Notification Trigger] onClassNpsForm error:', error);
    throw error;
  }
}

/**
 * Weekly drill digest — in-app + push alongside email cron.
 *
 * Mobile payload contract:
 *   data.screen = 'MyPlan'
 *   data.url = '/account/drills'
 */
export async function onWeeklyDrillDigest(
  studentId: string,
  params: {
    drillCount: number;
    drillTitles?: string[];
    weekKey: string;
  },
) {
  const { drillCount, weekKey } = params;
  const title = 'Your Outstanding Drills';
  const body = `You have ${drillCount} outstanding drill${drillCount === 1 ? '' : 's'}. Open your plan to get started.`;
  const notifData = {
    screen: 'MyPlan',
    url: '/account/drills',
    resourceType: 'drill_digest',
    weekKey,
  };

  console.log('[Notification Trigger] onWeeklyDrillDigest called:', {
    studentId,
    drillCount,
    weekKey,
  });

  try {
    await connectToDatabase();

    const delivery = await sendUnifiedWithFcmFallback({
      userId: studentId,
      title,
      body,
      type: 'weekly_drill_digest',
      data: notifData,
      fcmType: NotificationType.WEEKLY_DRILL_DIGEST,
      fcmData: {
        screen: 'MyPlan',
        url: '/account/drills',
        resourceType: 'drill_digest',
        weekKey,
        drillCount: String(drillCount),
      },
      actionUrl: '/account/drills',
    });

    const result = delivery.delivered
      ? { unified: delivery.unified, fcm: delivery.fcm, pushDelivered: delivery.pushDelivered }
      : null;

    console.log('[Notification Trigger] onWeeklyDrillDigest result:', result);
    return result;
  } catch (error) {
    console.error('[Notification Trigger] onWeeklyDrillDigest error:', error);
    throw error;
  }
}

/**
 * Weekly challenge ready — in-app + push alongside email after generation.
 *
 * Mobile payload contract:
 *   data.screen = 'WeeklyChallenge' (practice/weekly-challenge/[weekStartDate])
 *   data.url = '/account/practice/weekly-challenge/{encodeWeekStartDate(weekStartDate)}'
 *   data.resourceType = 'weekly_challenge'
 *   data.weekStartDate = ISO string
 */
export async function onWeeklyChallengeReady(
  studentId: string,
  params: {
    drillCount: number;
    drillTypes?: string[];
    weekStartDate: string;
  },
) {
  const { drillCount, weekStartDate } = params;
  const title = 'Your weekly challenge is ready';
  const drillWord = drillCount === 1 ? 'drill' : 'drills';
  const body = `${drillCount} personalized ${drillWord} based on your practice over the past 7 days. Start your challenge now.`;
  const challengePath = `/account/practice/weekly-challenge/${encodeWeekStartDate(weekStartDate)}`;
  const notifData = {
    screen: 'WeeklyChallenge',
    url: challengePath,
    resourceType: 'weekly_challenge',
    weekStartDate,
  };

  console.log('[Notification Trigger] onWeeklyChallengeReady called:', {
    studentId,
    drillCount,
    weekStartDate,
  });

  try {
    await connectToDatabase();

    const delivery = await sendUnifiedWithFcmFallback({
      userId: studentId,
      title,
      body,
      type: 'weekly_challenge_ready',
      data: notifData,
      fcmType: NotificationType.WEEKLY_CHALLENGE_READY,
      fcmData: {
        screen: 'WeeklyChallenge',
        url: challengePath,
        resourceType: 'weekly_challenge',
        weekStartDate,
        drillCount: String(drillCount),
      },
      actionUrl: challengePath,
    });

    const result = delivery.delivered
      ? { unified: delivery.unified, fcm: delivery.fcm, pushDelivered: delivery.pushDelivered }
      : null;

    console.log('[Notification Trigger] onWeeklyChallengeReady result:', result);
    return result;
  } catch (error) {
    console.error('[Notification Trigger] onWeeklyChallengeReady error:', error);
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
