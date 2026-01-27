/**
 * Notification Preferences Utility
 * Manages user notification preferences stored in localStorage
 */

const NOTIFICATION_PREFS_KEY = "notification-preferences";

export interface NotificationPreferences {
  drillAssignments: boolean;
  dailyFocus: boolean;
  streakReminders: boolean;
  drillReviews: boolean;
}

export const defaultPreferences: NotificationPreferences = {
  drillAssignments: true,
  dailyFocus: true,
  streakReminders: true,
  drillReviews: true,
};

/**
 * Get stored notification preferences
 */
export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === "undefined") return defaultPreferences;
  
  try {
    const stored = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (stored) {
      return { ...defaultPreferences, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("Failed to read notification preferences:", e);
  }
  
  return defaultPreferences;
}

/**
 * Save notification preferences
 */
export function saveNotificationPreferences(prefs: NotificationPreferences): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error("Failed to save notification preferences:", e);
  }
}

/**
 * Check if a specific notification type is enabled
 */
export function isNotificationEnabled(
  type: 'drill_assigned' | 'daily_focus' | 'drill_reminder' | 'drill_reviewed' | 'drill_completed' | string
): boolean {
  const prefs = getNotificationPreferences();
  
  switch (type) {
    case 'drill_assigned':
      return prefs.drillAssignments;
    case 'daily_focus':
      return prefs.dailyFocus;
    case 'drill_reminder':
      return prefs.streakReminders;
    case 'drill_reviewed':
      return prefs.drillReviews;
    case 'drill_completed':
      return prefs.drillAssignments; // Tutors get completion notifications
    default:
      return true; // Default to enabled for unknown types
  }
}

/**
 * Update a single preference
 */
export function updateNotificationPreference(
  key: keyof NotificationPreferences,
  value: boolean
): void {
  const prefs = getNotificationPreferences();
  prefs[key] = value;
  saveNotificationPreferences(prefs);
}

