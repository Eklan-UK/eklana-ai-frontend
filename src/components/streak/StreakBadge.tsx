"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { streakAPI } from "@/lib/api";

export function StreakBadge() {
  const [currentStreak, setCurrentStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStreak();
  }, []);

  const fetchStreak = async () => {
    try {
      const response = await streakAPI.getStreak();
      const data = (response as any).data || response;
      setCurrentStreak(data?.currentStreak || 0);
    } catch (error: any) {
      console.error("Failed to fetch streak:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-yellow-100 px-3 py-1.5 rounded-full flex items-center gap-1.5">
        <Flame className="w-4 h-4 text-yellow-600" />
        <span className="text-sm font-semibold text-gray-900">-</span>
      </div>
    );
  }

  return (
    <div className="bg-yellow-100 px-3 py-1.5 rounded-full flex items-center gap-1.5">
      <Flame className="w-4 h-4 text-yellow-600" />
      <span className="text-sm font-semibold text-gray-900">{currentStreak}</span>
    </div>
  );
}

