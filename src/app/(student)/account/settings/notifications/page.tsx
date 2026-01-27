"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { 
  Bell, 
  BellOff, 
  BookOpen, 
  Target, 
  Flame, 
  CheckCircle,
  Loader2,
  AlertCircle,
  Smartphone,
} from "lucide-react";
import { useWebPush } from "@/hooks/useWebPush";

// Notification preferences storage key
const NOTIFICATION_PREFS_KEY = "notification-preferences";

interface NotificationPreferences {
  drillAssignments: boolean;
  dailyFocus: boolean;
  streakReminders: boolean;
  drillReviews: boolean;
}

const defaultPreferences: NotificationPreferences = {
  drillAssignments: true,
  dailyFocus: true,
  streakReminders: true,
  drillReviews: true,
};

function getStoredPreferences(): NotificationPreferences {
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

function savePreferences(prefs: NotificationPreferences) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error("Failed to save notification preferences:", e);
  }
}

interface NotificationSettingProps {
  label: string;
  description?: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}

const NotificationSetting: React.FC<NotificationSettingProps> = ({
  label,
  description,
  enabled,
  onToggle,
  icon,
  disabled = false,
}) => {
  return (
    <Card className={disabled ? "opacity-50" : ""}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          {icon && <div className="text-gray-600">{icon}</div>}
          <div className="flex-1">
            <p className="text-base font-semibold text-gray-900 mb-1">
              {label}
            </p>
            {description && (
              <p className="text-sm text-gray-500">{description}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => !disabled && onToggle(!enabled)}
          disabled={disabled}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            enabled ? "bg-green-600" : "bg-gray-300"
          } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div
            className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
              enabled ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </Card>
  );
};

export default function SettingsNotificationsPage() {
  const [mounted, setMounted] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  
  const { 
    isSupported, 
    isSubscribed, 
    permission, 
    isLoading, 
    error,
    subscribe, 
    unsubscribe 
  } = useWebPush();

  // Load preferences on mount
  useEffect(() => {
    setMounted(true);
    setPreferences(getStoredPreferences());
  }, []);

  // Save preferences when they change
  const updatePreference = (key: keyof NotificationPreferences, value: boolean) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    savePreferences(newPrefs);
  };

  const handleTogglePush = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  // Detect Brave browser
  const isBrave = typeof window !== 'undefined' && 
    // @ts-ignore - Brave adds this property
    (navigator.brave?.isBrave || window.navigator.userAgent.includes('Brave'));

  // Determine push status
  const getPushStatus = () => {
    if (!isSupported) {
      return { 
        status: "unsupported", 
        text: isBrave ? "Check Brave Shields settings" : "Not supported in this browser",
        color: "text-amber-500"
      };
    }
    if (permission === "denied") {
      return { 
        status: "denied", 
        text: "Blocked - Enable in browser settings",
        color: "text-red-500"
      };
    }
    if (isSubscribed) {
      return { 
        status: "enabled", 
        text: "Push notifications enabled",
        color: "text-green-600"
      };
    }
    return { 
      status: "disabled", 
      text: "Click to enable",
      color: "text-gray-500"
    };
  };

  const pushStatus = getPushStatus();
  const canTogglePush = isSupported && permission !== "denied";

  if (!mounted) {
    return (
      <div className="min-h-screen bg-white">
        <div className="h-6" />
        <Header showBack title="Notifications" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-green-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-8">
      {/* Status Bar Space */}
      <div className="h-6" />

      <Header showBack title="Notifications" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        {/* Push Notification Master Toggle */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Push Notifications
          </h2>
          
          <Card className={`${isSubscribed ? 'border-green-200 bg-green-50/50' : 'border-gray-200'}`}>
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                isSubscribed ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                {isSubscribed ? (
                  <Bell className="w-6 h-6 text-green-600" />
                ) : (
                  <BellOff className="w-6 h-6 text-gray-400" />
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">
                    Browser Notifications
                  </h3>
                  <span className={`text-xs font-medium ${pushStatus.color}`}>
                    {pushStatus.text}
                  </span>
                </div>
                
                <p className="text-sm text-gray-500 mb-4">
                  Receive notifications even when the app is closed or in the background.
                </p>

                {error && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-red-600 text-sm mb-2">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                    {error.includes('push service error') && (
                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <p className="text-xs text-amber-800 font-medium mb-2">
                          🔧 Fix for Brave Browser:
                        </p>
                        <ol className="text-xs text-amber-700 list-decimal list-inside space-y-1">
                          <li>Click the <strong>Brave Shields</strong> icon (lion) in the address bar</li>
                          <li>Set shields to <strong>Down</strong> for this site, OR</li>
                          <li>Under Advanced Controls, allow &quot;All cookies&quot;</li>
                          <li>Refresh the page and click Enable again</li>
                        </ol>
                        <p className="text-xs text-amber-600 mt-2">
                          Note: Push notifications require connecting to Google&apos;s servers, 
                          which Brave may block for privacy.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  variant={isSubscribed ? "outline" : "primary"}
                  size="sm"
                  onClick={handleTogglePush}
                  disabled={!canTogglePush || isLoading}
                  className={isSubscribed ? "" : "bg-green-600 hover:bg-green-700"}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isSubscribed ? "Disabling..." : "Enabling..."}
                    </>
                  ) : isSubscribed ? (
                    <>
                      <BellOff className="w-4 h-4 mr-2" />
                      Disable Notifications
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4 mr-2" />
                      Enable Notifications
                    </>
                  )}
                </Button>

                {permission === "denied" && (
                  <p className="text-xs text-gray-500 mt-3">
                    To enable notifications, click the lock icon in your browser&apos;s address bar 
                    and allow notifications for this site.
                  </p>
                )}

                {isBrave && !isSubscribed && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-800 font-medium mb-2">
                      🦁 Using Brave Browser?
                    </p>
                    <p className="text-xs text-blue-700">
                      Brave&apos;s privacy features may block push notifications. If you get an error, 
                      try lowering Brave Shields for this site.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Notification Types */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            Notification Types
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Choose which notifications you want to receive. These apply to both 
            in-app and push notifications.
          </p>
        </div>

        <div className="space-y-4">
          <NotificationSetting
            label="Drill Assignments"
            description="When your tutor assigns you a new drill"
            enabled={preferences.drillAssignments}
            onToggle={(value) => updatePreference("drillAssignments", value)}
            icon={<BookOpen className="w-5 h-5" />}
          />
          
          <NotificationSetting
            label="Today's Focus"
            description="Daily practice activities available"
            enabled={preferences.dailyFocus}
            onToggle={(value) => updatePreference("dailyFocus", value)}
            icon={<Target className="w-5 h-5" />}
          />
          
          <NotificationSetting
            label="Streak Reminders"
            description="Reminders to maintain your learning streak"
            enabled={preferences.streakReminders}
            onToggle={(value) => updatePreference("streakReminders", value)}
            icon={<Flame className="w-5 h-5" />}
          />
          
          <NotificationSetting
            label="Drill Reviews"
            description="When your tutor reviews your submissions"
            enabled={preferences.drillReviews}
            onToggle={(value) => updatePreference("drillReviews", value)}
            icon={<CheckCircle className="w-5 h-5" />}
          />
        </div>

        {/* Mobile App Info */}
        <Card className="mt-8 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Mobile App Coming Soon
              </p>
              <p className="text-xs text-gray-600">
                Get the best notification experience with our upcoming mobile app. 
                Push notifications will work even better on your phone!
              </p>
            </div>
          </div>
        </Card>

        {/* In-App Notifications Info */}
        <Card className="mt-4 bg-gray-50 border-gray-200">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                In-App Notifications
              </p>
              <p className="text-xs text-gray-600">
                You&apos;ll always receive in-app notifications (bell icon) regardless of push 
                notification settings. These preferences control which types you see.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
