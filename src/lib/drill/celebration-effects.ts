import {
  getCelebrationSoundUrl,
  getPerfectCelebrationSoundUrl,
} from '@/lib/drill/celebration-sound-url';

export { getCelebrationSoundUrl } from '@/lib/drill/celebration-sound-url';

export type DrillConfettiVariant = 'pass' | 'perfect';

export type DrillCompletionEffects = {
  soundUrl: string;
  triggerConfetti: boolean;
  confettiVariant: DrillConfettiVariant;
};

/** Speech drills eligible for gold/applause 100% celebration. */
export const PERFECT_CELEBRATION_DRILL_TYPES = [
  'vocabulary',
  'pronunciation',
  'grammar',
  'roleplay',
  'key_phrases',
] as const;

export function supportsPerfectCelebration(drillType?: string | null): boolean {
  if (!drillType) return false;
  return (PERFECT_CELEBRATION_DRILL_TYPES as readonly string[]).includes(drillType);
}

/**
 * `score` drives gold vs green confetti + perfect vs normal MP3 when the drill
 * type supports perfect celebration: `Math.round(score) >= 100` → `perfect`.
 * Non-speech types (matching, listening, fill_blank, definition, …) stay `pass`
 * even at 100%.
 */
export function buildDrillCompletionEffects(
  passed: boolean,
  score?: number,
  drillType?: string | null,
): DrillCompletionEffects | null {
  if (!passed) return null;
  const isPerfect =
    supportsPerfectCelebration(drillType) &&
    typeof score === 'number' &&
    Math.round(score) >= 100;
  const confettiVariant: DrillConfettiVariant = isPerfect ? 'perfect' : 'pass';
  return {
    soundUrl: isPerfect ? getPerfectCelebrationSoundUrl() : getCelebrationSoundUrl(),
    triggerConfetti: true,
    confettiVariant,
  };
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
