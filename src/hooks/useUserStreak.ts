"use client";

import { useQuery } from "@tanstack/react-query";

export interface StreakDataResponse {
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
    milestone?: number;
  }>;
}

async function fetchStreak(): Promise<StreakDataResponse> {
  const res = await fetch("/api/v1/users/streak", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load streak");
  const json = await res.json();
  return json.data;
}

export function useUserStreak() {
  return useQuery<StreakDataResponse>({
    queryKey: ["user-streak"],
    queryFn: fetchStreak,
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });
}
