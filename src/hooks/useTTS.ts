import { useState, useCallback, useRef } from "react";
import { generateTTS } from "@/services/tts.service";
import { toast } from "sonner";

interface UseTTSOptions {
  autoPlay?: boolean;
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
  onError?: (error: Error) => void;
  /** Override the backend TTS endpoint. Defaults to '/api/v1/tts'. */
  apiPath?: string;
}

type PreloadedClip = {
  objectUrl: string;
  audio: HTMLAudioElement;
};

const preloadedClips = new Map<string, PreloadedClip>();

function ttsCacheKey(text: string, voiceId?: string, apiPath?: string) {
  return `${apiPath || "/api/v1/tts"}:${text}:${voiceId || "default"}`;
}

/** Fetch + decode TTS without playing — shared across hook instances for instant replay. */
export async function preloadTTSAudio(
  text: string,
  voiceId?: string,
  apiPath?: string,
): Promise<void> {
  const trimmed = text?.trim();
  if (!trimmed) return;

  const key = ttsCacheKey(trimmed, voiceId, apiPath);
  if (preloadedClips.has(key)) return;

  const blob = await generateTTS({ text: trimmed, voiceId, apiPath });
  const objectUrl = URL.createObjectURL(blob);
  const audio = new Audio(objectUrl);
  audio.preload = "auto";
  audio.setAttribute("playsinline", "true");
  preloadedClips.set(key, { objectUrl, audio });
  audio.load();
}

function attachPlaybackHandlers(
  audio: HTMLAudioElement,
  handlers: {
    onPlayStart?: () => void;
    onPlayEnd?: () => void;
    onError?: (error: Error) => void;
    setIsPlaying: (v: boolean) => void;
    setIsGenerating: (v: boolean) => void;
  },
) {
  audio.onplay = () => {
    handlers.setIsPlaying(true);
    handlers.setIsGenerating(false);
    handlers.onPlayStart?.();
  };

  audio.onended = () => {
    handlers.setIsPlaying(false);
    handlers.onPlayEnd?.();
  };

  audio.onerror = (e) => {
    const mediaErr = audio.error;
    if (mediaErr?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED && !audio.src) return;
    if (mediaErr?.message?.includes("abort") || mediaErr?.message?.includes("Abort")) return;

    handlers.setIsPlaying(false);
    handlers.setIsGenerating(false);
    const error = new Error("Failed to play audio");
    console.error("Error playing audio:", e);
    handlers.onError?.(error);
    toast.error("Failed to play audio");
  };
}

export function useTTS(options: UseTTSOptions = {}) {
  const { onPlayStart, onPlayEnd, onError, apiPath } = options;
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  /** True when objectUrlRef points at a one-off clip we should revoke on stop/end. */
  const ownsObjectUrlRef = useRef(false);
  /** True when playing from the shared preload cache (do not revoke URL). */
  const fromPreloadCacheRef = useRef(false);

  const detachActiveAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.onplay = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (objectUrlRef.current && ownsObjectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    objectUrlRef.current = null;
    ownsObjectUrlRef.current = false;
    fromPreloadCacheRef.current = false;
    setIsPlaying(false);
  }, []);

  const preloadAudio = useCallback(
    async (text: string, voiceId?: string) => {
      try {
        await preloadTTSAudio(text, voiceId, apiPath);
      } catch (error) {
        console.warn("TTS preload failed:", error);
      }
    },
    [apiPath],
  );

  const playAudio = useCallback(
    async (text: string, voiceId?: string) => {
      try {
        detachActiveAudio();
        setIsGenerating(true);
        setIsPlaying(false);

        const trimmed = text?.trim();
        if (!trimmed) {
          setIsGenerating(false);
          return;
        }

        const key = ttsCacheKey(trimmed, voiceId, apiPath);
        let clip = preloadedClips.get(key);

        if (!clip) {
          await preloadTTSAudio(trimmed, voiceId, apiPath);
          clip = preloadedClips.get(key);
        }

        if (clip) {
          const audio = clip.audio;
          audio.currentTime = 0;
          audioRef.current = audio;
          objectUrlRef.current = clip.objectUrl;
          ownsObjectUrlRef.current = false;
          fromPreloadCacheRef.current = true;
          setCurrentAudioUrl(clip.objectUrl);

          attachPlaybackHandlers(audio, {
            onPlayStart,
            onPlayEnd,
            onError,
            setIsPlaying,
            setIsGenerating,
          });

          const playNow = async () => {
            try {
              await audio.play();
            } catch (playErr: unknown) {
              const err = playErr as { name?: string };
              setIsGenerating(false);
              setIsPlaying(false);
              if (err.name === "AbortError") return;
              if (err.name === "NotAllowedError") {
                onError?.(new Error("Audio blocked — tap anywhere first, then try again."));
                toast.error("Audio blocked by browser. Tap the page and try again.");
              } else {
                console.error("Error playing audio:", playErr);
                onError?.(new Error("Failed to play audio"));
                toast.error("Failed to play audio. Please try again.");
              }
            }
          };

          if (audio.readyState >= 2) {
            await playNow();
          } else {
            const playWhenReady = () => {
              void playNow();
            };
            audio.addEventListener("canplay", playWhenReady, { once: true });
            audio.addEventListener("canplaythrough", playWhenReady, { once: true });
            audio.addEventListener("loadeddata", playWhenReady, { once: true });
            setTimeout(() => {
              if (audio.readyState >= 2) void playNow();
            }, 100);
          }
          return;
        }

        // Fallback: generate and play without cache entry
        const audioBlob = await generateTTS({
          text: trimmed,
          voiceId,
          apiPath,
        });

        const audioObjectUrl = URL.createObjectURL(audioBlob);
        objectUrlRef.current = audioObjectUrl;
        ownsObjectUrlRef.current = true;
        fromPreloadCacheRef.current = false;
        setCurrentAudioUrl(audioObjectUrl);

        const audio = new Audio(audioObjectUrl);
        audio.setAttribute("playsinline", "true");
        audio.muted = false;
        audio.volume = 1;
        audio.preload = "auto";
        audioRef.current = audio;

        attachPlaybackHandlers(audio, {
          onPlayStart,
          onPlayEnd: () => {
            if (ownsObjectUrlRef.current && objectUrlRef.current) {
              URL.revokeObjectURL(objectUrlRef.current);
              objectUrlRef.current = null;
              ownsObjectUrlRef.current = false;
            }
            onPlayEnd?.();
          },
          onError,
          setIsPlaying,
          setIsGenerating,
        });

        audio.load();
        await audio.play();
      } catch (error: unknown) {
        setIsGenerating(false);
        setIsPlaying(false);
        const err = error instanceof Error ? error : new Error("Failed to generate speech");
        onError?.(err);
        toast.error(err.message || "Failed to generate speech");
      }
    },
    [apiPath, detachActiveAudio, onPlayStart, onPlayEnd, onError],
  );

  const stopAudio = useCallback(() => {
    detachActiveAudio();
    setIsGenerating(false);
  }, [detachActiveAudio]);

  const pauseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const resumeAudio = useCallback(() => {
    if (audioRef.current) {
      void audioRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  return {
    playAudio,
    preloadAudio,
    stopAudio,
    pauseAudio,
    resumeAudio,
    isGenerating,
    isPlaying,
    currentAudioUrl,
  };
}
