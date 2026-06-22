"use client";

import { useEffect } from "react";
import {
  playDrillEndCelebration,
  playDrillEndFailure,
} from "@/lib/practice-feedback";

/** Fire end-of-drill celebration (or failure sound) once when the score screen appears. */
export function useDrillScoreCelebration(
  passed: boolean | null | undefined,
): void {
  useEffect(() => {
    if (passed == null) return;
    if (passed) {
      playDrillEndCelebration();
    } else {
      playDrillEndFailure();
    }
  }, [passed]);
}
