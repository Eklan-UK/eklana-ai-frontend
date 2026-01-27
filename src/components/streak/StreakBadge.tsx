"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { streakAPI } from "@/lib/api";

export function StreakBadge() {
  // Streak is disabled - always show 0
  return (
    <div className="bg-yellow-100 px-3 py-1.5 rounded-full flex items-center gap-1.5">
      <Flame className="w-4 h-4 text-yellow-600" />
      <span className="text-sm font-semibold text-gray-900">0</span>
    </div>
  );
}

