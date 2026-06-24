export const DEFAULT_CELEBRATION_SOUND_URL =
  'https://mrsxoheopyanhton.public.blob.vercel-storage.com/Celebration%20_Sound.mp3';

/** Server-side URL (POST /drills/:id/complete effects). */
export function getCelebrationSoundUrl(): string {
  return process.env.CELEBRATION_SOUND_URL?.trim() || DEFAULT_CELEBRATION_SOUND_URL;
}

/** Browser playback — uses NEXT_PUBLIC_* when set, else the same default as the API. */
export function getClientCelebrationSoundUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CELEBRATION_SOUND_URL?.trim() ||
    DEFAULT_CELEBRATION_SOUND_URL
  );
}
