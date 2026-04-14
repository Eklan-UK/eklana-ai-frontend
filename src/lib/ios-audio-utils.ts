export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Resume a suspended AudioContext — required on iOS where contexts
 * start suspended until triggered by a user gesture.
 */
export async function unlockAudioContext(
  ctx: AudioContext | null
): Promise<void> {
  if (!ctx || ctx.state !== "suspended") return;
  try {
    await ctx.resume();
  } catch {
    /* best-effort */
  }
}

/**
 * Stop every track on a MediaStream and release the mic/camera.
 * Centralizes cleanup so recording paths fully free hardware
 * before playback begins (critical on iOS to exit earpiece mode).
 */
export function releaseMediaStream(
  stream: MediaStream | null | undefined
): void {
  if (!stream) return;
  stream.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch {
      /* already stopped */
    }
  });
}
