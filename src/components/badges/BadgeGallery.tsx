"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useBadges } from "@/hooks/useBadges";
import type { BadgeView } from "@/domain/badges/badge.types";

function BadgeProgressBar({ progress }: { progress: NonNullable<BadgeView["progress"]> }) {
  const pct = Math.min(100, Math.round((progress.current / progress.target) * 100));
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>Progress</span>
        <span>
          {progress.current}/{progress.target}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function BadgeCard({ badge }: { badge: BadgeView }) {
  return (
    <Card
      className={`p-4 ${
        badge.unlocked
          ? "bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-border"
          : "opacity-90"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-2xl ${
            badge.unlocked
              ? "bg-gradient-to-br from-yellow-400 to-orange-400"
              : "bg-muted grayscale"
          }`}
        >
          {badge.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-foreground">{badge.badgeName}</p>
            {badge.unlocked ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                Unlocked
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                Locked
              </span>
            )}
          </div>

          {badge.unlocked ? (
            <>
              <p className="text-sm text-muted-foreground mt-2">{badge.afterOutcome}</p>
              <p className="text-sm text-foreground/80 mt-2 italic">{badge.humorousLine}</p>
              {badge.unlockedAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  Unlocked {new Date(badge.unlockedAt).toLocaleDateString()}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mt-2">{badge.beforeDescription}</p>
              {badge.progress && <BadgeProgressBar progress={badge.progress} />}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

export function BadgeGallery() {
  const { data, isLoading, isError, refetch } = useBadges();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground mb-3">Could not load badges.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-sm text-primary font-medium hover:underline"
        >
          Try again
        </button>
      </Card>
    );
  }

  const unlockedCount = data.badges.filter((b) => b.unlocked).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {unlockedCount} of {data.badges.length} badges earned
      </p>
      <div className="space-y-3">
        {data.badges.map((badge) => (
          <BadgeCard key={badge.badgeId} badge={badge} />
        ))}
      </div>
    </div>
  );
}

export function BadgeGalleryLink() {
  return (
    <Link
      href="/account/badges"
      className="text-sm text-primary font-medium hover:underline"
    >
      View all badges
    </Link>
  );
}
