"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useBadges } from "@/hooks/useBadges";

export function HomeBadgeButton() {
  const { data, isLoading, isError } = useBadges();
  const badge = data?.featuredBadge;

  if (isLoading) {
    return (
      <div
        className="w-10 h-10 md:w-12 md:h-12 bg-muted rounded-lg animate-pulse"
        aria-hidden
      />
    );
  }

  if (isError || !badge) {
    return (
      <Link
        href="/account/badges"
        className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center hover:opacity-90 transition-opacity"
        aria-label="View badges"
      >
        <span className="text-lg md:text-xl" aria-hidden>
          🏅
        </span>
      </Link>
    );
  }

  const statusLabel = badge.unlocked ? "Unlocked" : "Locked";

  return (
    <Link
      href="/account/badges"
      className={`relative w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center hover:opacity-90 transition-opacity ${
        badge.unlocked ? "" : "opacity-80"
      }`}
      aria-label={`${badge.badgeName} badge. ${statusLabel}. View all badges`}
    >
      <span className="text-lg md:text-xl leading-none" aria-hidden>
        {badge.icon}
      </span>
      {!badge.unlocked && (
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-background rounded-full flex items-center justify-center border border-border">
          <Lock className="w-2.5 h-2.5 text-muted-foreground" aria-hidden />
        </span>
      )}
    </Link>
  );
}
