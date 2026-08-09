"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Square, Volume2, X } from "lucide-react";
import {
  ACCENT_VOICE_GROUPS,
  ACCENT_VOICE_OPTIONS,
  VOICE_PREVIEW_SAMPLE_TEXT,
  type AccentVoiceKey,
} from "@/services/tts-accent-voices";

export type VoicePreviewDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function VoicePreviewDialog({ open, onClose }: VoicePreviewDialogProps) {
  const [playingKey, setPlayingKey] = useState<AccentVoiceKey | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingKey(null);
  }, []);

  useEffect(() => {
    if (!open) {
      stopPlayback();
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, stopPlayback]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  const playPreview = useCallback(
    (key: AccentVoiceKey, url: string) => {
      if (playingKey === key) {
        stopPlayback();
        return;
      }

      stopPlayback();

      const audio = new Audio(url);
      audio.setAttribute("playsinline", "true");
      audioRef.current = audio;
      setPlayingKey(key);

      audio.onended = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          setPlayingKey(null);
        }
      };
      audio.onerror = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          setPlayingKey(null);
        }
      };

      void audio.play().catch(() => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          setPlayingKey(null);
        }
      });
    },
    [playingKey, stopPlayback],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-preview-dialog-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Close voice preview"
        onClick={onClose}
      />
      <div
        className="relative z-[101] flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <h2
              id="voice-preview-dialog-title"
              className="flex items-center gap-2 text-base font-bold text-gray-900"
            >
              <Volume2 className="h-4 w-4 text-green-600" />
              Preview voices
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              All samples say: &ldquo;{VOICE_PREVIEW_SAMPLE_TEXT}&rdquo;
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {ACCENT_VOICE_GROUPS.map((group) => {
            const voices = ACCENT_VOICE_OPTIONS.filter(
              (opt) => opt.group === group.id,
            );
            if (voices.length === 0) return null;
            return (
              <section key={group.id} className="mb-5 last:mb-1">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                  {group.label}
                </h3>
                <ul className="space-y-1.5">
                  {voices.map((voice) => {
                    const hasUrl = Boolean(voice.previewAudioUrl);
                    const isPlaying = playingKey === voice.key;
                    return (
                      <li
                        key={voice.key}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2"
                      >
                        <span className="min-w-0 truncate text-sm font-medium text-gray-900">
                          {voice.label}
                        </span>
                        <button
                          type="button"
                          disabled={!hasUrl}
                          onClick={() => {
                            if (!voice.previewAudioUrl) return;
                            playPreview(voice.key, voice.previewAudioUrl);
                          }}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-green-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={
                            isPlaying
                              ? `Stop ${voice.label}`
                              : `Play ${voice.label}`
                          }
                        >
                          {isPlaying ? (
                            <>
                              <Square className="h-3.5 w-3.5 fill-current" />
                              Stop
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5 fill-current" />
                              Play
                            </>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
