"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeUnlockModal } from "@/components/badges/BadgeUnlockModal";
import type { BadgeUnlockCelebration } from "@/lib/badges/badge-unlock";
import { registerBadgeUnlockHandler } from "@/lib/badges/celebrate-badge-unlock";

export function BadgeUnlockProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<BadgeUnlockCelebration[]>([]);
  const current = queue[0] ?? null;

  const enqueue = useCallback((badges: BadgeUnlockCelebration[]) => {
    if (badges.length === 0) return;
    setQueue((prev) => [...prev, ...badges]);
  }, []);

  const dismissCurrent = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  useEffect(() => {
    registerBadgeUnlockHandler(enqueue);
    return () => registerBadgeUnlockHandler(null);
  }, [enqueue]);

  return (
    <>
      {children}
      <BadgeUnlockModal
        open={queue.length > 0}
        badge={current}
        onClose={dismissCurrent}
      />
    </>
  );
}
