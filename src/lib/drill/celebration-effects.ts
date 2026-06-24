import { getCelebrationSoundUrl } from '@/lib/drill/celebration-sound-url';

export { getCelebrationSoundUrl } from '@/lib/drill/celebration-sound-url';

export type DrillCompletionEffects = {
  soundUrl: string;
  triggerConfetti: boolean;
};

export function buildDrillCompletionEffects(passed: boolean): DrillCompletionEffects | null {
  if (!passed) return null;
  return { soundUrl: getCelebrationSoundUrl(), triggerConfetti: true };
}

export type DrillCompleteBodyForPassed = {
  summaryResults?: { summaryProvided?: boolean };
  listeningResults?: { completed?: boolean };
  performanceReviewSnapshot?: { passThreshold?: number };
};

export function resolveDrillPassed(
  score: number,
  body: DrillCompleteBodyForPassed,
): boolean {
  if (body.summaryResults?.summaryProvided) return true;
  if (body.listeningResults?.completed) return true;

  const passThreshold = body.performanceReviewSnapshot?.passThreshold ?? 70;
  return score >= passThreshold;
}
