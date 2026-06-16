"use client";

import { useEffect, useState } from "react";
import { Flame, Award, Calendar } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { streakAPI } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  streakStartDate: string | null;
  todayCompleted: boolean;
  yesterdayCompleted: boolean;
  weeklyActivity: Array<{
    date: string;
    completed: boolean;
    score?: number;
  }>;
  badges: Array<{
    badgeId: string;
    badgeName: string;
    unlockedAt: string;
    milestone: number;
  }>;
}

export function StreakDisplay() {
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStreakData();
  }, []);

  const fetchStreakData = async () => {
    try {
      const response = await streakAPI.getStreak();
      const data = (response as any).data || response;
      setStreakData(data);
    } catch (error: any) {
      console.error("Failed to fetch streak data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-yellow-600" />
      </div>
    );
  }

  if (!streakData) {
    return null;
  }

  const dayNames = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="space-y-4">
      {/* Streak Card */}
      <Card className="bg-gradient-to-br from-orange-500/15 to-yellow-500/10 border-border">
        <div className="text-center py-6">
          <div className="relative inline-block mb-4">
            <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-yellow-400 rounded-full flex items-center justify-center shadow-lg">
              <Flame className="w-12 h-12 text-white" />
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-400 px-4 py-1 rounded-full">
              <span className="text-lg font-bold text-yellow-950">
                {streakData.currentStreak}
              </span>
            </div>
          </div>
          <p className="text-lg font-semibold text-foreground mb-1">
            {streakData.currentStreak > 0
              ? streakData.currentStreak === 1
                ? "1-day streak"
                : `${streakData.currentStreak}-day streak`
              : "Day Streak"}
          </p>
          {streakData.currentStreak > 0 ? (
            <p className="text-sm text-muted-foreground">
              Consecutive UTC days with activity — keep it going! 🔥
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Start your streak today!</p>
          )}
        </div>
      </Card>

      {/* Weekly Activity */}
      <Card>
        <h3 className="text-lg font-bold text-foreground mb-4">This Week</h3>
        <div className="grid grid-cols-7 gap-2">
          {streakData.weeklyActivity.map((day, index) => {
            const date = new Date(day.date);
            const dayName = dayNames[date.getUTCDay()];

            return (
              <div
                key={index}
                className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full font-black text-xs ${
                  day.completed
                    ? "bg-green-600 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
                title={day.date}
              >
                {dayName}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="text-center">
            <Award className="w-6 h-6 text-primary-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground mb-1">
              {streakData.longestStreak}
            </p>
            <p className="text-xs text-muted-foreground">Longest Streak</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <Calendar className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground mb-1">
              {streakData.badges.length}
            </p>
            <p className="text-xs text-muted-foreground">Badges</p>
          </div>
        </Card>
      </div>

      {/* Badges */}
      {streakData.badges.length > 0 && (
        <Card>
          <h3 className="text-lg font-bold text-foreground mb-4">Your Badges</h3>
          <div className="space-y-3">
            {streakData.badges.map((badge) => (
              <div
                key={badge.badgeId}
                className="flex items-center gap-3 p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-border"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center text-2xl">
                  🔥
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{badge.badgeName}</p>
                  <p className="text-xs text-muted-foreground">
                    Unlocked {new Date(badge.unlockedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

