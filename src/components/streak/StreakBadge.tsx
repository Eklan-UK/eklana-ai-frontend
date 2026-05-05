"use client";

import { Flame } from "lucide-react";
import Link from "next/link";
import { useUserStreak } from "@/hooks/useUserStreak";

export function StreakBadge() {
  const { data: streak, isLoading, isError } = useUserStreak();
  const count =
    isError || streak == null ? 0 : Math.max(0, streak.currentStreak ?? 0);

  return (
    <Link
      href="/account/streak"
      className="bg-yellow-100 px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-yellow-200/80 transition-colors"
      aria-label={`Streak: ${isLoading ? "loading" : count} days. View streak`}
    >
      <Flame className="w-4 h-4 text-yellow-600 shrink-0" aria-hidden />
      <span className="text-sm font-semibold text-yellow-950 tabular-nums min-w-[1ch] text-center">
        {isLoading ? "—" : count}
      </span>
    </Link>
  );
}
