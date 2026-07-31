import { unlockAudioContext } from "@/lib/ios-audio-utils";
import { triggerDrillEndConfetti } from "@/lib/drill-celebration";
import { getClientCelebrationSoundUrl } from "@/lib/drill/celebration-sound-url";

export type PracticeFeedbackKind = "success" | "failure" | "neutral";

const HAPTIC_PATTERNS: Record<PracticeFeedbackKind, number[]> = {
  success: [40, 30, 40],
  failure: [120, 60, 120],
  neutral: [25],
};

const TONE_SEQUENCES: Record<
  PracticeFeedbackKind,
  Array<{ frequency: number; durationMs: number; gapMs: number }>
> = {
  success: [
    { frequency: 523, durationMs: 90, gapMs: 30 },
    { frequency: 659, durationMs: 110, gapMs: 0 },
  ],
  failure: [
    { frequency: 220, durationMs: 120, gapMs: 40 },
    { frequency: 165, durationMs: 130, gapMs: 0 },
  ],
  neutral: [{ frequency: 440, durationMs: 80, gapMs: 0 }],
};

let audioContext: AudioContext | null = null;
let celebrationAudio: HTMLAudioElement | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const AudioContextCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) return null;
    audioContext = new AudioContextCtor();
  }
  return audioContext;
}

export function triggerHaptic(kind: PracticeFeedbackKind): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }
  try {
    navigator.vibrate(HAPTIC_PATTERNS[kind]);
  } catch {
    /* best-effort */
  }
}

export async function playTone(kind: PracticeFeedbackKind): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;

  await unlockAudioContext(ctx);

  const now = ctx.currentTime;
  let offset = 0;

  for (const step of TONE_SEQUENCES[kind]) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = kind === "failure" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(step.frequency, now + offset);

    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.01);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + offset + step.durationMs / 1000
    );

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + step.durationMs / 1000 + 0.02);

    offset += step.durationMs / 1000 + step.gapMs / 1000;
  }
}

export function playPracticeFeedback(kind: PracticeFeedbackKind): void {
  triggerHaptic(kind);
  void playTone(kind);
}

async function playCelebrationSound(soundUrl?: string): Promise<void> {
  if (typeof window === "undefined") return;

  const url = soundUrl?.trim() || getClientCelebrationSoundUrl();
  try {
    if (celebrationAudio) {
      celebrationAudio.pause();
      celebrationAudio.src = "";
      celebrationAudio = null;
    }
    const audio = new Audio(url);
    celebrationAudio = audio;
    await audio.play();
  } catch {
    /* CDN / autoplay policy — haptics + confetti still run */
  }
}

/** End-of-drill pass: celebration MP3, haptics, and confetti. */
export function playDrillEndCelebration(soundUrl?: string): void {
  triggerHaptic("success");
  void playCelebrationSound(soundUrl);
  triggerDrillEndConfetti();
}

export function playDrillEndFailure(): void {
  triggerHaptic("failure");
  void playTone("failure");
}
