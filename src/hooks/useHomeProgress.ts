"use client";

import { useQuery } from "@tanstack/react-query";

export interface HomeProgressMetrics {
  accurateSentenceUsage: number;
  responseSpeed: number;
  sentenceWeeklyChange: number;
  speedWeeklyChange: number;
}

async function fetchHomeProgress(): Promise<HomeProgressMetrics> {
  const res = await fetch("/api/v1/progress/home", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch home progress metrics");
  const data = await res.json();
  return data.data.homeProgress as HomeProgressMetrics;
}

export function useHomeProgress() {
  return useQuery<HomeProgressMetrics>({
    queryKey: ["home-progress"],
    queryFn: fetchHomeProgress,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}
