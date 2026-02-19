# Push Notification Enhancement & Utilization Guide

**Project:** Elkan AI - English Learning Platform  
**Date:** January 23, 2026  
**Focus:** Advanced utilization strategies for push notifications

---

## 📊 Table of Contents

1. [Current Implementation Overview](#current-implementation-overview)
2. [Additional Notification Triggers](#additional-notification-triggers)
3. [Advanced Features](#advanced-features)
4. [Integration Opportunities](#integration-opportunities)
5. [Implementation Priority Matrix](#implementation-priority-matrix)
6. [Code Templates](#code-templates)
7. [Analytics & Monitoring](#analytics--monitoring)
8. [Best Practices](#best-practices)

---

## 🔄 Current Implementation Overview

### ✅ Currently Implemented Triggers

| Trigger | Type | Who | Purpose |
|---------|------|-----|---------|
| Drill Assigned | `drill_assigned` | Student | New drill from tutor |
| Drill Due Soon | `drill_reminder` | Student | Upcoming deadline |
| Drill Reviewed | `drill_reviewed` | Student | Tutor feedback ready |
| Drill Completed | `drill_completed` | Tutor | Student finished drill |
| Daily Focus Available | `daily_focus` | Student | New daily goal |
| Achievement Unlocked | `achievement` | Student | Milestone reached |
| Streak Reminder | `drill_reminder` | Student | Keep streak alive |
| Student Assigned | `drill_assigned` | Tutor | New student onboarded |
| **Total Current** | **8 types** | - | - |

### 📱 Supported Platforms

- ✅ **Web Push** (browsers)
- ✅ **Expo Push** (mobile React Native)
- ⏳ **FCM** (prepared but optional)

---

## 🚀 Additional Notification Triggers

### **Category 1: Learning Progress & Milestones** 🎯

#### 1.1 - Course Progress Notifications
```typescript
// onCourseProgressMilestone
onCourseProgressMilestone(studentId, {
  progress: 45,          // 45% complete
  nextMilestone: 50,     // Next milestone at 50%
  courseName: "English Fundamentals"
})

Notification:
- Title: "45% Progress! 📈"
- Body: "You're halfway through English Fundamentals!"
- Type: "progress_milestone" (new)
- Navigate to: Course detail page
```

**When to Send:** When user reaches 25%, 50%, 75%, 90%, 100%

---

#### 1.2 - Level/Proficiency Advancement
```typescript
// onProficiencyLevelUp
onProficiencyLevelUp(studentId, {
  area: "Pronunciation",      // Grammar | Vocabulary | Listening
  oldLevel: "A2",
  newLevel: "B1",
  improvementPercent: 15
})

Notification:
- Title: "Level Up! 🎉"
- Body: "Pronunciation: A2 → B1 (+15% improvement)"
- Type: "level_advancement" (new)
- Navigate to: Profile/progress page
```

**When to Send:** When learner completes enough drills to advance level

---

#### 1.3 - Pronunciation Improvement Alerts
```typescript
// onPronunciationImprovement
onPronunciationImprovement(studentId, {
  word: "Vocabulary",
  oldScore: 62,
  newScore: 85,
  improvement: 23
})

Notification:
- Title: "Pronunciation Getting Better! 🗣️"
- Body: "Vocabulary accuracy improved from 62% to 85%"
- Type: "pronunciation_improvement" (new)
- Navigate to: Pronunciation practice page
```

**When to Send:** When user improves specific pronunciation score significantly (20%+)

---

#### 1.4 - Skill Gap Alerts
```typescript
// onSkillGapDetected
onSkillGapDetected(studentId, {
  skillArea: "Grammar",
  currentAccuracy: 45,
  benchmark: 75,
  recommendedDrill: "past-tense-drills"
})

Notification:
- Title: "Grammar Area Needs Focus 📝"
- Body: "Consider practicing past tense to improve from 45% to 75%"
- Type: "skill_recommendation" (new)
- Navigate to: Recommended drill
```

**When to Send:** When score falls below benchmark for area

---

### **Category 2: Engagement & Retention** 💪

#### 2.1 - Streak Milestones
```typescript
// onStreakMilestone
onStreakMilestone(studentId, {
  days: 7,               // 7-day streak
  nextMilestone: 14
})

Notification:
- Title: "7-Day Streak! 🔥"
- Body: "Amazing! Keep it going for 14 days!"
- Type: "streak_milestone" (new)
- Navigate to: Streak page
```

**When to Send:** At 3, 7, 14, 30, 60, 100, 365 days

---

#### 2.2 - Inactivity Warnings
```typescript
// onInactivityWarning
onInactivityWarning(studentId, {
  daysSinceLastActivity: 3,
  streakAtRisk: 7
})

Notification:
- Title: "Streak at Risk! ⚠️"
- Body: "You haven't practiced in 3 days. Practice now to keep your 7-day streak!"
- Type: "engagement_alert" (new)
- Navigate to: Home/drills
```

**When to Send:** After 3 days of no activity (configurable)

---

#### 2.3 - Personalized Learning Reminders
```typescript
// onPersonalizedReminder
onPersonalizedReminder(studentId, {
  time: "morning",       // Or "afternoon", "evening"
  recommendation: "pronunciation-practice",
  learningStyle: "auditory"
})

Notification:
- Title: "Time for Your Lesson! 📚"
- Body: "Let's practice your pronunciation skills this morning"
- Type: "personalized_reminder" (new)
- Navigate to: Personalized lesson
```

**When to Send:** At optimal learning times (configurable per user)

---

#### 2.4 - Challenge Invitations
```typescript
// onChallengeInvitation
onChallengeInvitation(studentId, {
  challenger: "John Doe",
  challengeType: "vocabulary",
  duration: "7-days"
})

Notification:
- Title: "Challenge from John! ⚔️"
- Body: "7-day vocabulary challenge. Beat their score!"
- Type: "social_challenge" (new)
- Navigate to: Challenge detail
```

**When to Send:** When peer/friend sends challenge

---

### **Category 3: Social & Community** 👥

#### 3.1 - Peer Feedback Notifications
```typescript
// onPeerFeedback
onPeerFeedback(studentId, {
  peer: "Jane Smith",
  drillId: "drill-123",
  feedbackType: "encouragement"  // correction | question
})

Notification:
- Title: "Jane Left Feedback! 💬"
- Body: "Check out what Jane said about your pronunciation"
- Type: "social_feedback" (new)
- Navigate to: Drill detail with comments
```

**When to Send:** When peer comments on drill attempt

---

#### 3.2 - Group Study Notifications
```typescript
// onGroupActivityInvitation
onGroupActivityInvitation(studentId, {
  group: "Advanced English Group",
  activity: "Speaking Practice",
  time: "2026-01-24T18:00:00Z"
})

Notification:
- Title: "Group Practice Starting Soon! 👋"
- Body: "Advanced English Group - Speaking Practice in 30 minutes"
- Type: "group_activity" (new)
- Navigate to: Group activity detail
```

**When to Send:** 30 min before scheduled group activity

---

#### 3.3 - Leaderboard Updates
```typescript
// onLeaderboardChange
onLeaderboardChange(studentId, {
  newRank: 5,
  previousRank: 8,
  leaderboardType: "weekly"  // weekly | monthly | allTime
})

Notification:
- Title: "Climbing the Leaderboard! 📊"
- Body: "You're now #5 on the weekly leaderboard!"
- Type: "leaderboard_update" (new)
- Navigate to: Leaderboard
```

**When to Send:** When rank improves by 3+ positions

---

### **Category 4: Administrative & Tutor Actions** 👨‍🏫

#### 4.1 - Assignment Bulk Notifications
```typescript
// onBulkAssignment (NEW)
// Notify multiple students at once
onBulkAssignment(studentIds: string[], {
  drill: { _id, title },
  tutor: { name },
  dueDate: Date,
  priority: "high"  // normal | high | urgent
})

Notification:
- Title: "New Assignment from [Tutor]! 📌"
- Body: "Complete [Drill] by [Date]"
- Type: "bulk_assignment" (new)
- Navigate to: Drill detail
```

**When to Send:** When tutor assigns drill to multiple students

---

#### 4.2 - Tutor Availability Notifications
```typescript
// onTutorAvailable
onTutorAvailable(studentId, {
  tutor: { name },
  availableFor: "1-hour"
})

Notification:
- Title: "[Tutor] is Now Available! 👨‍🏫"
- Body: "Book a 1-hour session now before they go offline"
- Type: "tutor_availability" (new)
- Navigate to: Booking page
```

**When to Send:** When tutor comes online (if student interested)

---

#### 4.3 - Performance Review Due
```typescript
// onPerformanceReviewDue (NEW)
onPerformanceReviewDue(studentId, {
  tutorName: "Sarah Johnson",
  lastReview: "2025-12-24"
})

Notification:
- Title: "Performance Review Available! 📋"
- Body: "Sarah Johnson has completed your quarterly review"
- Type: "performance_review" (new)
- Navigate to: Review page
```

**When to Send:** When tutor completes quarterly/monthly review

---

#### 4.4 - Payment/Subscription Reminders
```typescript
// onSubscriptionReminder (NEW)
onSubscriptionReminder(studentId, {
  daysUntilExpiry: 7,
  planName: "Premium",
  renewalAmount: 29.99
})

Notification:
- Title: "Subscription Expiring Soon! 💳"
- Body: "Your Premium plan expires in 7 days. Renew to keep your streak!"
- Type: "subscription_reminder" (new)
- Navigate to: Billing page
```

**When to Send:** 30, 7, 3, and 1 days before expiry

---

### **Category 5: Gamification & Rewards** 🏆

#### 5.1 - Badge Earned Notifications
```typescript
// onBadgeEarned
onBadgeEarned(studentId, {
  badge: {
    id: "speed-reader",
    title: "Speed Reader",
    description: "Read 100 articles"
  }
})

Notification:
- Title: "New Badge! 🎖️"
- Body: "Speed Reader - Read 100 articles"
- Type: "badge_earned" (new)
- Navigate to: Badges/achievements page
```

**When to Send:** When specific achievement threshold reached

---

#### 5.2 - Milestone Celebrations
```typescript
// onDaysMilestone
onDaysMilestone(studentId, {
  days: 100,
  nextMilestone: 365
})

Notification:
- Title: "100 Days of Learning! 🎊"
- Body: "You've been learning for 100 days! Keep going toward 365!"
- Type: "milestone_celebration" (new)
- Navigate to: Profile/timeline
```

**When to Send:** At 10, 30, 100, 365, 500, 1000 day marks

---

#### 5.3 - Reward Redemption Notifications
```typescript
// onRewardAvailable
onRewardAvailable(studentId, {
  reward: {
    name: "Free Month Premium",
    points: 1000,
    availability: "limited"
  }
})

Notification:
- Title: "Reward Unlocked! 🎁"
- Body: "You have enough points for a Free Month Premium (Limited!)"
- Type: "reward_available" (new)
- Navigate to: Rewards store
```

**When to Send:** When reward becomes available/achievable

---

### **Category 6: Real-time Events** ⚡

#### 6.1 - Live Class Notifications
```typescript
// onLiveClassStarting
onLiveClassStarting(studentId, {
  class: {
    title: "Advanced Conversation",
    instructor: "Mr. Singh",
    startTime: "2026-01-24T18:00:00Z"
  }
})

Notification:
- Title: "Live Class Starting! 📹"
- Body: "Advanced Conversation with Mr. Singh starts in 5 minutes"
- Type: "live_class" (new)
- Navigate to: Class room
```

**When to Send:** 5 minutes before class starts

---

#### 6.2 - Teacher Response Notifications
```typescript
// onTeacherResponse
onTeacherResponse(studentId, {
  teacher: "Maria Garcia",
  questionTopic: "verb-tenses",
  responseTime: "10-minutes"
})

Notification:
- Title: "Teacher Replied! 💌"
- Body: "Maria Garcia answered your question about verb tenses"
- Type: "message_received" (new)
- Navigate to: Messages/Q&A
```

**When to Send:** When teacher responds to student question

---

#### 6.3 - Forum Activity Notifications
```typescript
// onForumActivity
onForumActivity(studentId, {
  thread: "Tips for TOEFL Preparation",
  activity: "new-reply",  // new-reply | new-topic
  author: "Advanced User"
})

Notification:
- Title: "New Response in Forum 💭"
- Body: "Advanced User replied to 'Tips for TOEFL Preparation'"
- Type: "forum_activity" (new)
- Navigate to: Forum thread
```

**When to Send:** When followed thread gets new activity

---

### **Category 7: System & Maintenance** 🔧

#### 7.1 - System Maintenance Alerts
```typescript
// onSystemMaintenance
onSystemMaintenance(userIds: string[], {
  startTime: "2026-01-25T02:00:00Z",
  duration: "2-hours",
  impact: "api-services-offline"
})

Notification:
- Title: "Scheduled Maintenance 🔧"
- Body: "We'll be down for 2 hours starting 2:00 AM UTC for upgrades"
- Type: "system_alert" (new)
- Navigate to: Status page
```

**When to Send:** 24h and 1h before scheduled maintenance

---

#### 7.2 - Security Alerts
```typescript
// onSecurityAlert
onSecurityAlert(studentId, {
  alertType: "new-device-login",  // password-changed | unusual-activity
  device: "Chrome on Windows",
  timestamp: Date
})

Notification:
- Title: "New Login Detected 🔒"
- Body: "Your account was accessed from a new device. If this wasn't you, change your password."
- Type: "security_alert" (new)
- Navigate to: Account security
```

**When to Send:** When suspicious activity detected

---

#### 7.3 - Feature Release Announcements
```typescript
// onFeatureAnnouncement
onFeatureAnnouncement(userIds: string[], {
  feature: "AI Speaking Coach",
  description: "Get real-time feedback on your pronunciation"
})

Notification:
- Title: "New Feature Released! ✨"
- Body: "AI Speaking Coach is now available - get real-time pronunciation feedback"
- Type: "feature_announcement" (new)
- Navigate to: Feature details or feature page
```

**When to Send:** When new major feature releases

---

## 🎯 Advanced Features

### **Feature 1: Smart Scheduling/Do Not Disturb**

```typescript
// User-defined quiet hours
interface NotificationPreferences {
  quietHours: {
    enabled: boolean;
    startTime: "22:00";     // 10 PM
    endTime: "08:00";       // 8 AM
    timezone: "UTC";
    allowHighPriority: boolean;  // Critical notifications bypass quiet hours
  };
  
  frequencyLimits: {
    maxPerDay: 5;
    maxPerHour: 2;
  };
  
  typePreferences: {
    drill_assigned: true;
    achievement: true;
    social_feedback: false;
    marketing: false;
  };
}

// Implementation
async function sendNotificationWithScheduling(
  userId: string,
  notification: NotificationPayload
) {
  const preferences = await getNotificationPreferences(userId);
  
  if (isInQuietHours(preferences) && !isHighPriority(notification)) {
    // Queue for later
    await scheduleForSending(notification, getNextQuietHourEnd(preferences));
    return { queued: true, sendAt: nextAvailableTime };
  }
  
  return await sendNotification(notification);
}
```

---

### **Feature 2: Rich Notification Content**

```typescript
// Enhanced payload with multiple content types
interface EnhancedNotificationPayload {
  title: string;
  body: string;
  
  // Images
  largeIcon?: string;           // 192x192
  image?: string;               // Large image (wide)
  smallIcon?: string;           // 24x24
  
  // Actions (mobile/web)
  actions?: Array<{
    id: string;
    title: string;
    icon?: string;
  }>;
  
  // Rich content
  richData?: {
    thumbnail?: string;
    color?: string;              // Accent color
    badge?: {
      text: string;
      backgroundColor: string;
    };
  };
}

// Example usage
await sendNotification({
  userId: studentId,
  title: "Achievement Unlocked!",
  body: "You completed 10 drills!",
  type: "achievement",
  largeIcon: "https://cdn.example.com/icons/achievement-192.png",
  image: "https://cdn.example.com/achievements/10-drills.jpg",
  actions: [
    { id: "view", title: "View Achievement" },
    { id: "share", title: "Share" }
  ],
  richData: {
    color: "#FFD700",  // Gold
    badge: { 
      text: "NEW", 
      backgroundColor: "#FF5722" 
    }
  }
});
```

---

### **Feature 3: A/B Testing Notifications**

```typescript
// Test different message variants
async function sendNotificationABTest(
  userIds: string[],
  abTest: {
    testId: string;
    variants: {
      variantA: NotificationPayload;
      variantB: NotificationPayload;
    };
  }
) {
  // Split users
  const groupA = userIds.slice(0, Math.ceil(userIds.length / 2));
  const groupB = userIds.slice(Math.ceil(userIds.length / 2));
  
  // Send variant A
  await sendBatchNotifications(groupA, {
    ...abTest.variants.variantA,
    data: {
      ...abTest.variants.variantA.data,
      abTestId: abTest.testId,
      variant: "A"
    }
  });
  
  // Send variant B
  await sendBatchNotifications(groupB, {
    ...abTest.variants.variantB,
    data: {
      ...abTest.variants.variantB.data,
      abTestId: abTest.testId,
      variant: "B"
    }
  });
  
  // Track metrics
  await trackABTestMetrics(abTest.testId, groupA, groupB);
}

// Usage
await sendNotificationABTest(userIds, {
  testId: "streak-reminder-v1",
  variants: {
    variantA: {
      title: "Keep Your Streak! 🔥",
      body: "You're at 7 days. Don't break it now!",
      type: "drill_reminder"
    },
    variantB: {
      title: "7 Days Strong! 💪",
      body: "Amazing progress! Complete 1 drill to keep going.",
      type: "drill_reminder"
    }
  }
});
```

---

### **Feature 4: Notification Analytics & Tracking**

```typescript
// Track notification lifecycle
interface NotificationMetrics {
  sent: number;
  delivered: number;
  clicked: number;
  dismissed: number;
  conversions: number;
  
  // Engagement
  engagementRate: number;      // clicked / sent
  conversionRate: number;      // conversions / sent
  averageResponseTime: number; // ms
  
  // Cohort analysis
  byPlatform: {
    web: { sent, delivered, clicked };
    mobile: { sent, delivered, clicked };
  };
}

// Database schema for tracking
interface NotificationLog {
  notificationId: ObjectId;
  userId: ObjectId;
  type: NotificationType;
  
  // Events
  events: Array<{
    event: "sent" | "delivered" | "clicked" | "dismissed" | "action_clicked";
    timestamp: Date;
    metadata?: any;
  }>;
  
  // Engagement
  engagement: {
    seen: boolean;
    seenAt?: Date;
    clicked: boolean;
    clickedAt?: Date;
    clickedAction?: string;
  };
}

// Query metrics
async function getNotificationMetrics(
  filters: {
    dateRange: [Date, Date];
    type?: NotificationType;
    platform?: 'web' | 'mobile';
  }
) {
  const logs = await NotificationLog.find({
    timestamp: { $gte: filters.dateRange[0], $lte: filters.dateRange[1] },
    ...(filters.type && { type: filters.type }),
    ...(filters.platform && { "events.platform": filters.platform })
  });
  
  return {
    sent: logs.length,
    delivered: logs.filter(l => l.events.some(e => e.event === "delivered")).length,
    clicked: logs.filter(l => l.engagement.clicked).length,
    engagementRate: clicked / sent
  };
}
```

---

### **Feature 5: Triggered Notification Sequences**

```typescript
// Multi-step notification sequences
interface NotificationSequence {
  id: string;
  trigger: "user-action" | "time-based" | "condition-based";
  steps: Array<{
    order: number;
    notification: NotificationPayload;
    delayAfterPrevious?: number;  // ms
    condition?: () => Promise<boolean>;
  }>;
  maxRetries?: number;
  retryDelay?: number;
}

// Example: Onboarding sequence
const onboardingSequence: NotificationSequence = {
  id: "new-student-onboarding",
  trigger: "user-action",
  steps: [
    {
      order: 1,
      notification: {
        title: "Welcome! 👋",
        body: "Let's get you started with your first lesson",
        type: "system"
      }
    },
    {
      order: 2,
      delayAfterPrevious: 86400000,  // 24 hours
      notification: {
        title: "First Lesson Ready! 📚",
        body: "Your tutor has prepared your first drill"
      },
      condition: async (userId) => {
        return !(await hasCompletedFirstDrill(userId));
      }
    },
    {
      order: 3,
      delayAfterPrevious: 172800000,  // 48 hours
      notification: {
        title: "How's It Going? 💬",
        body: "We'd love to hear your feedback"
      }
    }
  ]
};

// Implementation
async function startNotificationSequence(
  userId: string,
  sequence: NotificationSequence
) {
  for (const step of sequence.steps) {
    try {
      // Check condition
      if (step.condition && !(await step.condition(userId))) {
        continue;
      }
      
      // Wait if needed
      if (step.delayAfterPrevious) {
        await delay(step.delayAfterPrevious);
      }
      
      // Send notification
      await sendNotification({
        ...step.notification,
        userId,
        sequenceId: sequence.id,
        sequenceStep: step.order
      });
      
      // Store log
      await logSequenceStep(userId, sequence.id, step.order);
      
    } catch (error) {
      console.error(`Failed sequence step ${step.order}`, error);
      if (step.retries < (sequence.maxRetries || 3)) {
        // Retry
        await delay(sequence.retryDelay || 3600000);
        step.retries = (step.retries || 0) + 1;
      }
    }
  }
}
```

---

## 🔌 Integration Opportunities

### **Integration 1: Email + Push Hybrid**

```typescript
// Send via both channels
async function sendMultiChannelNotification(
  userId: string,
  notification: NotificationPayload,
  channels: {
    push?: boolean;
    email?: boolean;
    inApp?: boolean;
  }
) {
  const tasks = [];
  
  if (channels.push !== false) {
    tasks.push(sendNotification(notification));
  }
  
  if (channels.email !== false) {
    tasks.push(
      sendEmailNotification(userId, {
        subject: notification.title,
        body: notification.body,
        actionUrl: getActionUrl(notification.data)
      })
    );
  }
  
  if (channels.inApp !== false) {
    tasks.push(
      createInAppNotification(userId, notification)
    );
  }
  
  return Promise.allSettled(tasks);
}
```

---

### **Integration 2: SMS for Critical Alerts**

```typescript
// For high-priority, time-sensitive notifications
async function sendCriticalAlert(
  userId: string,
  alert: {
    title: string;
    body: string;
    priority: "critical" | "high" | "normal";
  }
) {
  const user = await getUser(userId);
  const pushResult = await sendNotification({ ...alert, userId });
  
  // Send SMS for critical alerts
  if (alert.priority === "critical") {
    const smsResult = await sendSMS(user.phoneNumber, alert.body);
    return { push: pushResult, sms: smsResult };
  }
  
  return { push: pushResult };
}
```

---

### **Integration 3: In-App Notification Center**

```typescript
// Display notifications in-app with richer UI
interface InAppNotification {
  id: string;
  notification: NotificationPayload;
  position: "top" | "bottom" | "center";
  duration: number;  // ms, 0 = persistent
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

// Component usage
export function NotificationCenter() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  
  useEffect(() => {
    const unsubscribe = subscribeToNotifications((notification) => {
      const inAppNotif: InAppNotification = {
        id: notification._id,
        notification,
        position: getPosition(notification.type),
        duration: getDuration(notification.type),
        actions: [
          {
            label: "View",
            action: () => navigate(notification.data?.url)
          }
        ]
      };
      
      setNotifications(prev => [...prev, inAppNotif]);
      
      if (inAppNotif.duration > 0) {
        setTimeout(() => {
          setNotifications(prev => 
            prev.filter(n => n.id !== inAppNotif.id)
          );
        }, inAppNotif.duration);
      }
    });
    
    return unsubscribe;
  }, []);
}
```

---

### **Integration 4: Dashboard Notifications Widget**

```typescript
// Real-time notification feed on dashboard
export function NotificationFeed() {
  const { data: notifications } = useNotifications({
    limit: 10,
    skip: 0
  });
  
  const { mutate: markAsRead } = useMarkAsRead();
  const { mutate: deleteNotification } = useDeleteNotification();
  
  return (
    <div className="space-y-2">
      {notifications?.data?.map(notification => (
        <NotificationCard
          key={notification._id}
          notification={notification}
          onRead={() => markAsRead(notification._id)}
          onDelete={() => deleteNotification(notification._id)}
        />
      ))}
    </div>
  );
}
```

---

### **Integration 5: Slack/Teams Bot Notifications**

```typescript
// Send notifications to Slack for tutors
async function sendTutorSlackNotification(
  tutorId: string,
  notification: NotificationPayload
) {
  const tutor = await getTutor(tutorId);
  
  if (!tutor.slackUserId) return;
  
  await sendSlackMessage(tutor.slackUserId, {
    text: notification.title,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${notification.title}*\n${notification.body}`
        }
      }
    ]
  });
}
```

---

## 📊 Implementation Priority Matrix

### **High Impact, Low Effort** 🟢 (Implement First)

| Feature | Impact | Effort | Est. Time |
|---------|--------|--------|-----------|
| Streak Milestones | ⭐⭐⭐⭐⭐ | Easy | 2 hours |
| Inactivity Warnings | ⭐⭐⭐⭐ | Easy | 1.5 hours |
| Level Advancement | ⭐⭐⭐⭐ | Easy | 2 hours |
| Badge Earned | ⭐⭐⭐⭐ | Easy | 1.5 hours |
| Pronunciation Improvement | ⭐⭐⭐⭐ | Medium | 3 hours |
| Performance Review Due | ⭐⭐⭐ | Easy | 1 hour |

**Subtotal: ~11 hours**

### **High Impact, Medium Effort** 🟡 (Implement Next)

| Feature | Impact | Effort | Est. Time |
|---------|--------|--------|-----------|
| Smart Scheduling | ⭐⭐⭐⭐⭐ | Medium | 4 hours |
| Notification Analytics | ⭐⭐⭐⭐ | Medium | 5 hours |
| A/B Testing | ⭐⭐⭐⭐ | Medium | 4 hours |
| Personalized Reminders | ⭐⭐⭐⭐ | Medium | 3 hours |
| Live Class Notifications | ⭐⭐⭐⭐ | Medium | 3 hours |
| Multi-channel (Email) | ⭐⭐⭐⭐ | Medium | 4 hours |

**Subtotal: ~23 hours**

### **Medium Impact, Low Effort** 🟢

| Feature | Impact | Effort | Est. Time |
|---------|--------|--------|-----------|
| Milestone Celebrations | ⭐⭐⭐ | Easy | 1.5 hours |
| Skill Gap Alerts | ⭐⭐⭐ | Easy | 2 hours |
| Feature Announcements | ⭐⭐ | Easy | 1 hour |
| Reward Available | ⭐⭐⭐ | Easy | 1.5 hours |

**Subtotal: ~6 hours**

### **Nice to Have** 🔵 (Later)

| Feature | Impact | Effort | Est. Time |
|--------|--------|--------|-----------|
| Rich Notification Content | ⭐⭐⭐ | Medium | 5 hours |
| Notification Sequences | ⭐⭐⭐ | Hard | 6 hours |
| Forum Activity | ⭐⭐ | Medium | 3 hours |
| Slack Integration | ⭐⭐⭐ | Hard | 5 hours |
| Challenge Invitations | ⭐⭐⭐ | Medium | 3 hours |

**Subtotal: ~22 hours**

---

## 💻 Code Templates

### **Template 1: New Trigger Implementation**

```typescript
// /src/services/notification/triggers.ts

/**
 * Trigger when [EVENT DESCRIPTION]
 */
export async function on[EventName](
  userId: string,
  data: {
    // Required fields
  }
) {
  const [title, body] = generateMessageText(data);
  
  return sendNotification({
    userId,
    title,
    body,
    type: '[notification_type]',  // Add new type if needed
    data: {
      screen: '[ScreenName]',       // Navigation target
      resourceId: data.resourceId,
      resourceType: '[resource-type]',
      url: '/path/to/resource',
      // Additional metadata
    },
  });
}
```

---

### **Template 2: Adding New Notification Type**

```typescript
// 1. Update type definition in /src/models/notification.model.ts
export type NotificationType = 
  | 'drill_assigned'
  | 'drill_reminder'
  | 'drill_reviewed'
  | 'drill_completed'
  | 'daily_focus'
  | 'achievement'
  | 'message'
  | 'tutor_update'
  | 'system'
  // Add new type here:
  | 'new_feature';

// 2. Add to notification preferences
interface NotificationPreferences {
  typePreferences: {
    // Existing types...
    new_feature: boolean;  // Add here
  };
}

// 3. Update styling if needed in components
export const notificationTypeStyles = {
  // Existing styles...
  new_feature: {
    icon: <ZapIcon />,
    bgColor: 'bg-primary-50',
    borderColor: 'border-primary-200',
  }
};
```

---

### **Template 3: Batch Notification with Conditions**

```typescript
/**
 * Send notifications to users matching conditions
 */
export async function notifyUsersMatchingConditions(
  filter: {
    condition: (user: IUser) => boolean;
    limit?: number;
  },
  notification: NotificationPayload
) {
  const users = await User.find({})
    .select('_id')
    .limit(filter.limit || 100);
  
  const targetUserIds = users
    .filter(user => filter.condition(user))
    .map(user => user._id.toString());
  
  if (targetUserIds.length === 0) {
    console.log('No users match condition');
    return { success: 0, failed: 0 };
  }
  
  return sendBatchNotifications(targetUserIds, notification);
}

// Usage
await notifyUsersMatchingConditions(
  {
    condition: (user) => user.streak === 7,
    limit: 1000
  },
  {
    title: "7-Day Streak! 🔥",
    body: "Amazing! Keep going for 14 days!",
    type: "streak_milestone"
  }
);
```

---

## 📈 Analytics & Monitoring

### **Key Metrics to Track**

```typescript
interface NotificationMetrics {
  // Delivery
  sendRate: number;          // notifications/hour
  deliveryRate: number;      // delivered / sent (%)
  failureRate: number;       // failed / sent (%)
  
  // Engagement
  openRate: number;          // clicked / delivered (%)
  clickThroughRate: number;  // action clicks / delivered (%)
  conversionRate: number;    // completed actions / delivered (%)
  
  // User behavior
  avgTimeToOpen: number;     // seconds
  repeatedOpeners: number;   // users who opened multiple
  unsubscribeRate: number;   // unsubscribes / sent (%)
  
  // By type
  byType: {
    [key in NotificationType]: {
      sent: number;
      delivered: number;
      clicked: number;
      conversionRate: number;
    }
  };
  
  // Performance
  avgLatency: number;        // ms from send to delivery
  p95Latency: number;
  p99Latency: number;
}
```

### **Dashboard Queries**

```typescript
// Real-time notification performance
async function getRealtimeMetrics(hours: number = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const stats = await NotificationLog.aggregate([
    {
      $match: {
        createdAt: { $gte: since }
      }
    },
    {
      $group: {
        _id: "$type",
        sent: { $sum: 1 },
        delivered: {
          $sum: { $cond: [{ $in: ["delivered", "$events.event"] }, 1, 0] }
        },
        clicked: {
          $sum: { $cond: [{ $in: ["clicked", "$events.event"] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats.map(stat => ({
    type: stat._id,
    sent: stat.sent,
    deliveryRate: (stat.delivered / stat.sent * 100).toFixed(2),
    clickRate: (stat.clicked / stat.sent * 100).toFixed(2)
  }));
}
```

---

## ✅ Best Practices

### **1. Message Design**

```typescript
// ✅ Good
{
  title: "7-Day Streak! 🔥",
  body: "Amazing! Keep going for 14 days!"
}

// ❌ Bad
{
  title: "Notification",
  body: "You have a streak"
}

// Guidelines:
// - Keep titles under 50 characters
// - Keep body under 150 characters
// - Use emoji strategically (1-2 per notification)
// - Use action verbs and urgency words
// - Be specific about what happened
// - Include next action
```

---

### **2. Timing & Frequency**

```typescript
// Implement smart scheduling
const OPTIMAL_SEND_TIMES = {
  drill_assigned: "08:00",      // Morning
  drill_reminder: "18:00",      // Evening
  achievement: "anytime",        // Celebratory
  daily_focus: "09:00",          // Work start
  drill_reviewed: "immediately", // Time-sensitive
};

// Frequency caps
const FREQUENCY_LIMITS = {
  MAX_PER_DAY: 5,
  MAX_PER_HOUR: 2,
  MIN_INTERVAL: 3600000,  // 1 hour between notifications
};

// User quiet hours
const getUserQuietHours = async (userId) => {
  const preferences = await NotificationPreferences.findOne({ userId });
  return preferences?.quietHours || {
    startTime: "22:00",
    endTime: "08:00"
  };
};
```

---

### **3. Personalization**

```typescript
// Use user data to personalize
async function personalizeNotification(
  userId: string,
  baseNotification: NotificationPayload
) {
  const user = await getUser(userId);
  const prefs = await getNotificationPreferences(userId);
  
  return {
    ...baseNotification,
    // Add personal touches
    body: baseNotification.body
      .replace('{userName}', user.firstName)
      .replace('{streak}', user.currentStreak)
      .replace('{level}', user.proficiencyLevel),
    
    // Respect preferences
    type: prefs.typePreferences[baseNotification.type] 
      ? baseNotification.type 
      : null,
  };
}
```

---

### **4. Deep Linking**

```typescript
// Ensure smooth navigation from notification
const DEEP_LINK_MAP = {
  drill_assigned: (data) => `/drills/${data.resourceId}`,
  achievement: (data) => `/achievements/${data.resourceId}`,
  drill_reviewed: (data) => `/drills/${data.drillId}/review?assignmentId=${data.assignmentId}`,
  daily_focus: (data) => `/daily-focus/${data.resourceId}`,
  // ...
};

// Service worker deep linking
self.addEventListener('push', (event) => {
  const data = event.data.json();
  const url = DEEP_LINK_MAP[data.type]?.(data.data) || '/';
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: { url }
    })
  );
});
```

---

### **5. Error Handling & Retry Logic**

```typescript
// Robust error handling
async function sendNotificationWithRetry(
  payload: NotificationPayload,
  maxRetries: number = 3
) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await sendNotification(payload);
    } catch (error) {
      if (attempt === maxRetries) {
        // Final attempt failed - log and fail gracefully
        await logNotificationFailure(payload, error);
        throw error;
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;  // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

### **6. Privacy & Consent**

```typescript
// Always request permission
async function requestNotificationPermission() {
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      return true;
    }
    
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  }
  
  return false;
}

// Respect opt-outs
async function sendNotificationRespectingPreferences(
  userId: string,
  notification: NotificationPayload
) {
  const user = await getUser(userId);
  const prefs = await getNotificationPreferences(userId);
  
  // Check if user opted out of this type
  if (!prefs.typePreferences[notification.type]) {
    console.log(`User ${userId} opted out of ${notification.type}`);
    return { skipped: true };
  }
  
  return sendNotification({ ...notification, userId });
}
```

---

## 📋 Quick Implementation Checklist

### **Before Launching New Notification**

- [ ] Message is clear and actionable
- [ ] Deep link navigates to correct screen
- [ ] Respects user quiet hours
- [ ] Follows frequency limits
- [ ] Personalizes with user data
- [ ] Has proper error handling
- [ ] Logs for analytics
- [ ] Tested on Web & Mobile
- [ ] Monitored for delivery rate
- [ ] A/B tested (if applicable)

---

## 🎯 Recommended Implementation Roadmap

### **Phase 1: Foundation (Week 1)** 🟢
1. Streak Milestones
2. Inactivity Warnings
3. Level Advancement
4. Badge Earned

### **Phase 2: Engagement (Week 2)** 🟡
5. Smart Scheduling
6. Notification Analytics
7. Personalized Reminders
8. A/B Testing

### **Phase 3: Integration (Week 3)** 🟡
9. Multi-channel (Email)
10. Performance Tracking Dashboard
11. Enhanced Preferences UI
12. In-App Notification Center

### **Phase 4: Advanced (Ongoing)** 🔵
13. Notification Sequences
14. Rich Content
15. Slack Integration
16. SMS for critical alerts

---

## 📞 Support & Questions

**For implementation help:**
1. Check code templates above
2. Review existing trigger implementations in `/src/services/notification/triggers.ts`
3. Follow established patterns
4. Test thoroughly before deploying

**Key Files:**
- `/src/services/notification/` - Core services
- `/src/hooks/useNotifications.ts` - Frontend hooks
- `/src/models/notification.model.ts` - Data schema
- `/src/app/api/v1/notifications/` - API routes
- `/public/sw.js` - Service Worker

---

**Status:** Ready for implementation  
**Last Updated:** January 23, 2026  
**Version:** 2.0
