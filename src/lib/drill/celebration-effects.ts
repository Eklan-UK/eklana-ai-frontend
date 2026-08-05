import { getCelebrationSoundUrl } from '@/lib/drill/celebration-sound-url';

export { getCelebrationSoundUrl } from '@/lib/drill/celebration-sound-url';

export type DrillConfettiVariant = 'pass' | 'perfect';

export type DrillCompletionEffects = {
  soundUrl: string;
  triggerConfetti: boolean;
  confettiVariant: DrillConfettiVariant;
};

/** `score` drives gold vs green confetti: `Math.round(score) >= 100` → `perfect`. */
export function buildDrillCompletionEffects(
  passed: boolean,
  score?: number,
): DrillCompletionEffects | null {
  if (!passed) return null;
  const confettiVariant: DrillConfettiVariant =
    typeof score === 'number' && Math.round(score) >= 100 ? 'perfect' : 'pass';
  return { soundUrl: getCelebrationSoundUrl(), triggerConfetti: true, confettiVariant };
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
