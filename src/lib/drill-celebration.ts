import confetti from "canvas-confetti";

export type DrillConfettiVariant = "pass" | "perfect";

const PASS_COLORS = ["#22c55e", "#16a34a", "#4ade80", "#86efac"];
/** Matches BadgeUnlockModal's gold palette. */
const PERFECT_COLORS = ["#fbbf24", "#f59e0b", "#d97706", "#92400e"];

/** Confetti options per variant, exported for testing without touching the DOM. */
export function getDrillConfettiOptions(
  variant: DrillConfettiVariant = "pass",
): { particleCount: number; spread: number; origin: { y: number }; colors: string[] } {
  if (variant === "perfect") {
    return { particleCount: 200, spread: 120, origin: { y: 0.5 }, colors: PERFECT_COLORS };
  }
  return { particleCount: 150, spread: 100, origin: { y: 0.55 }, colors: PASS_COLORS };
}

export function triggerDrillEndConfetti(variant: DrillConfettiVariant = "pass"): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  confetti(getDrillConfettiOptions(variant));
}
