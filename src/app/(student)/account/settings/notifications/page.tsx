"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Bell, Clock, Award, Flame, BarChart3, BookOpen } from "lucide-react";

interface NotificationSettingProps {
  label: string;
  description?: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  icon?: React.ReactNode;
}

const NotificationSetting: React.FC<NotificationSettingProps> = ({
  label,
  description,
  enabled,
  onToggle,
  icon,
}) => {
  return (
    <Card>
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
          onClick={() => onToggle(!enabled)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            enabled ? "bg-green-600" : "bg-gray-300"
          }`}
        >
          <div
            className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
              enabled ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </Card>
  );
};

export default function SettingsNotificationsPage() {
  const [practiceReminders, setPracticeReminders] = useState(true);
  const [achievements, setAchievements] = useState(true);
  const [streakReminders, setStreakReminders] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(false);
  const [lessonUpdates, setLessonUpdates] = useState(true);

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Notifications" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        <div className="mb-6">
          <p className="text-base text-gray-600">
            Manage your notification preferences. Choose what updates you want to
            receive.
          </p>
        </div>

        <div className="space-y-4">
          <NotificationSetting
            label="Practice Reminders"
            description="Get notified when it's time to practice"
            enabled={practiceReminders}
            onToggle={setPracticeReminders}
            icon={<Clock className="w-5 h-5" />}
          />
          <NotificationSetting
            label="Achievements"
            description="Celebrate your milestones"
            enabled={achievements}
            onToggle={setAchievements}
            icon={<Award className="w-5 h-5" />}
          />
          <NotificationSetting
            label="Streak Reminders"
            description="Don't break your learning streak"
            enabled={streakReminders}
            onToggle={setStreakReminders}
            icon={<Flame className="w-5 h-5" />}
          />
          <NotificationSetting
            label="Weekly Reports"
            description="Get a summary of your progress"
            enabled={weeklyReports}
            onToggle={setWeeklyReports}
            icon={<BarChart3 className="w-5 h-5" />}
          />
          <NotificationSetting
            label="Lesson Updates"
            description="New lessons and content"
            enabled={lessonUpdates}
            onToggle={setLessonUpdates}
            icon={<BookOpen className="w-5 h-5" />}
          />
        </div>

        {/* Info Card */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Notification Settings
              </p>
              <p className="text-xs text-gray-600">
                You can also manage app notifications from your device settings.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

