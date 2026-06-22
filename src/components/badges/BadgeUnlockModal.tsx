"use client";

import { useEffect } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/Button";
import type { BadgeUnlockCelebration } from "@/lib/badges/badge-unlock";

export type BadgeUnlockModalProps = {
  open: boolean;
  badge: BadgeUnlockCelebration | null;
  onClose: () => void;
};

export function BadgeUnlockModal({ open, badge, onClose }: BadgeUnlockModalProps) {
  useEffect(() => {
    if (!open || !badge) return;

    confetti({
      particleCount: 200,
      spread: 120,
      origin: { y: 0.5 },
      colors: ["#fbbf24", "#f59e0b", "#d97706", "#92400e"],
    });
  }, [open, badge?.badgeId]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !badge) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/40"
        aria-label="Close badge celebration"
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 z-[70] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="badge-unlock-title"
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 text-4xl shadow-md">
            {badge.icon}
          </div>

          <p className="text-sm font-medium uppercase tracking-wide text-orange-600">
            Badge Unlocked!
          </p>
          <h2 id="badge-unlock-title" className="mt-1 text-2xl font-bold text-foreground">
            {badge.badgeName}
          </h2>

          <p className="mt-4 text-sm text-muted-foreground">{badge.afterOutcome}</p>
          <p className="mt-3 text-sm italic text-foreground/80">{badge.humorousLine}</p>

          <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
            <Button variant="primary" className="flex-1" onClick={onClose}>
              Awesome!
            </Button>
            <Link
              href="/account/badges"
              onClick={onClose}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-border bg-card px-6 py-3 text-base font-semibold text-foreground transition-all duration-200 hover:bg-muted active:scale-95"
            >
              View badges
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
