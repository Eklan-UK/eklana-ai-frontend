"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";

interface NotificationSettingProps {
  label: string;
  description?: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
}

const NotificationSetting: React.FC<NotificationSettingProps> = ({
  label,
  description,
  enabled,
  onToggle,
}) => {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-base font-semibold text-gray-900 mb-1">{label}</p>
          {description && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
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

export default function NotificationsPage() {
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
        <div className="space-y-4">
          <NotificationSetting
            label="Practice Reminders"
            description="Get notified when it's time to practice"
            enabled={practiceReminders}
            onToggle={setPracticeReminders}
          />
          <NotificationSetting
            label="Achievements"
            description="Celebrate your milestones"
            enabled={achievements}
            onToggle={setAchievements}
          />
          <NotificationSetting
            label="Streak Reminders"
            description="Don't break your learning streak"
            enabled={streakReminders}
            onToggle={setStreakReminders}
          />
          <NotificationSetting
            label="Weekly Reports"
            description="Get a summary of your progress"
            enabled={weeklyReports}
            onToggle={setWeeklyReports}
          />
          <NotificationSetting
            label="Lesson Updates"
            description="New lessons and content"
            enabled={lessonUpdates}
            onToggle={setLessonUpdates}
          />
        </div>
      </div>
    </div>
  );
}
