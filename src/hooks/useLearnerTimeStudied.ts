"use client";

import { useQuery } from "@tanstack/react-query";

export interface MyDrillRow {
  latestAttempt: { timeSpent?: number } | null;
  status?: string;
  completedAt?: string;
}

/** Total seconds from latest attempts on assigned drills (proxy for time studied). */
async function fetchTimeStudiedSeconds(): Promise<number> {
  const res = await fetch("/api/v1/drills/learner/my-drills?limit=200", {
    cache: "no-store",
  });
  if (!res.ok) return 0;
  const json = await res.json();
  const rows: MyDrillRow[] = json.data?.drills || json.drills || [];
  let total = 0;
  for (const row of rows) {
    const s = row.latestAttempt?.timeSpent;
    if (typeof s === "number" && s > 0) total += s;
  }
  return total;
}

export function useLearnerTimeStudied() {
  return useQuery({
    queryKey: ["learner-time-studied"],
    queryFn: fetchTimeStudiedSeconds,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}
