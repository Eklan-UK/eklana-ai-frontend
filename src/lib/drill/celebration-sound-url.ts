export const DEFAULT_CELEBRATION_SOUND_URL =
  'https://mrsxoheopyanhton.public.blob.vercel-storage.com/Celebration%20_Sound.mp3';

/** Perfect-score (100%) celebration MP3 — replaces the normal pass sound when `Math.round(score) >= 100`. */
export const DEFAULT_PERFECT_CELEBRATION_SOUND_URL =
  'https://mrsxoheopyanhton.public.blob.vercel-storage.com/scottishperson-sound-effect-crowd-applause-and-cheering-237756.mp3';

/** Server-side URL (POST /drills/:id/complete effects). */
export function getCelebrationSoundUrl(): string {
  return process.env.CELEBRATION_SOUND_URL?.trim() || DEFAULT_CELEBRATION_SOUND_URL;
}

/** Server-side URL for a perfect (100%) score — distinct from the normal pass sound. */
export function getPerfectCelebrationSoundUrl(): string {
  return process.env.CELEBRATION_SOUND_URL_100?.trim() || DEFAULT_PERFECT_CELEBRATION_SOUND_URL;
}

/** Browser playback — uses NEXT_PUBLIC_* when set, else the same default as the API. */
export function getClientCelebrationSoundUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CELEBRATION_SOUND_URL?.trim() ||
    DEFAULT_CELEBRATION_SOUND_URL
  );
}

/** Browser playback for a perfect (100%) score — Pattern A review + mid-item celebrations. */
export function getClientPerfectCelebrationSoundUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CELEBRATION_SOUND_URL_100?.trim() ||
    DEFAULT_PERFECT_CELEBRATION_SOUND_URL
  );
}
