"use client";

import { useEffect } from "react";
import {
  playDrillEndCelebration,
  playDrillEndFailure,
} from "@/lib/practice-feedback";

/**
 * Fire end-of-drill celebration (or failure sound) once when the score screen appears.
 * When `passed` and `Math.round(score) >= 100`, gold "perfect" confetti replaces green "pass" confetti.
 */
export function useDrillScoreCelebration(
  passed: boolean | null | undefined,
  celebrationSoundUrl?: string,
  score?: number,
): void {
  useEffect(() => {
    if (passed == null) return;
    if (passed) {
      const confettiVariant =
        typeof score === "number" && Math.round(score) >= 100 ? "perfect" : "pass";
      playDrillEndCelebration(celebrationSoundUrl, { confettiVariant });
    } else {
      playDrillEndFailure();
    }
  }, [passed, celebrationSoundUrl, score]);
}
