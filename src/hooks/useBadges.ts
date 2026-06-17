"use client";

import { useQuery } from "@tanstack/react-query";
import type { BadgeStateResponse } from "@/domain/badges/badge.types";
import { queryKeys } from "@/lib/react-query";

async function fetchBadges(): Promise<BadgeStateResponse> {
  const res = await fetch("/api/v1/badges", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load badges");
  const json = await res.json();
  return json.data;
}

export function useBadges() {
  return useQuery<BadgeStateResponse>({
    queryKey: queryKeys.badges.all,
    queryFn: fetchBadges,
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });
}
