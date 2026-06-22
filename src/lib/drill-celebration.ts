import confetti from "canvas-confetti";

export function triggerDrillEndConfetti(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  confetti({
    particleCount: 150,
    spread: 100,
    origin: { y: 0.55 },
    colors: ["#22c55e", "#16a34a", "#4ade80", "#86efac"],
  });
}
