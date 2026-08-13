"use client";

import { useEffect } from "react";
import {
  playDrillEndCelebration,
  playDrillEndFailure,
} from "@/lib/practice-feedback";
import { getClientPerfectCelebrationSoundUrl } from "@/lib/drill/celebration-sound-url";

/**
 * Fire end-of-drill celebration (or failure sound) once when the score screen appears.
 * When `passed`, `allowPerfectCelebration` (default true), and `Math.round(score) >= 100`,
 * gold "perfect" confetti replaces green "pass" confetti, and — unless the caller passed
 * an explicit `celebrationSoundUrl` — the perfect-score MP3 replaces the normal pass MP3.
 * Non-speech Pattern A screens (e.g. fill-blank) pass `allowPerfectCelebration: false`.
 */
export function useDrillScoreCelebration(
  passed: boolean | null | undefined,
  celebrationSoundUrl?: string,
  score?: number,
  allowPerfectCelebration: boolean = true,
): void {
  useEffect(() => {
    if (passed == null) return;
    if (passed) {
      const isPerfect =
        allowPerfectCelebration &&
        typeof score === "number" &&
        Math.round(score) >= 100;
      const confettiVariant = isPerfect ? "perfect" : "pass";
      const soundUrl =
        celebrationSoundUrl ?? (isPerfect ? getClientPerfectCelebrationSoundUrl() : undefined);
      playDrillEndCelebration(soundUrl, { confettiVariant });
    } else {
      playDrillEndFailure();
    }
  }, [passed, celebrationSoundUrl, score, allowPerfectCelebration]);
}
