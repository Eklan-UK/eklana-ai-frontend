"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Trash2 } from "lucide-react";

const BAR_COUNT = 42;

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function seededHeights(seed: string): number[] {
  let n = seed.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 7) % 2147483647;
  const next = () => {
    n = (n * 48271) % 2147483647;
    return n / 2147483647;
  };
  return Array.from({ length: BAR_COUNT }, () => 22 + next() * 78);
}

interface RecordingPreviewBarProps {
  src: string;
  onDiscard: () => void;
  onAudioError?: () => void;
  className?: string;
}

/**
 * Custom pill preview player (play, decorative waveform, time, discard).
 * Uses a hidden `<audio>` for real playback; waveform is illustrative, not a spectrum analyzer.
 */
export function RecordingPreviewBar({
  src,
  onDiscard,
  onAudioError,
  className = "",
}: RecordingPreviewBarProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const barHeights = useMemo(() => seededHeights(src), [src]);

  const syncTime = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime || 0);
    if (Number.isFinite(el.duration) && el.duration > 0) {
      setDuration(el.duration);
    }
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onLoaded = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        setDuration(el.duration);
      }
    };
    const onTime = () => syncTime();
    const onEnded = () => {
      setIsPlaying(false);
      syncTime();
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      setIsPlaying(false);
      onAudioError?.();
    };

    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("durationchange", onLoaded);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("error", onError);

    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("durationchange", onLoaded);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("error", onError);
    };
  }, [src, onAudioError, syncTime]);

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      return;
    }
    try {
      await el.play();
    } catch {
      onAudioError?.();
    }
  };

  const atStart = currentTime < 0.25;
  const atEnd = duration > 0 && Math.abs(currentTime - duration) < 0.25;
  const showTotalWhenIdle = !isPlaying && duration > 0 && (atStart || atEnd);
  const timeLabel = formatTime(showTotalWhenIdle ? duration : currentTime);

  return (
    <div className={`flex w-full items-center gap-2 ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-gray-200/90 bg-gray-100/95 py-2 pl-2 pr-3 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          onClick={() => void togglePlay()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3B883E] text-white shadow-sm transition-transform hover:bg-[#327536] active:scale-95"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4 ml-0.5" fill="currentColor" />}
        </button>

        <div className="flex h-8 min-w-0 flex-1 items-end justify-center gap-[3px] overflow-hidden px-1">
          {barHeights.map((pct, i) => (
            <div
              key={i}
              className={`w-[3px] max-w-[3px] shrink-0 rounded-full bg-[#3B883E] ${isPlaying ? "opacity-90" : "opacity-70"}`}
              style={{
                height: `${pct}%`,
                maxHeight: "100%",
              }}
            />
          ))}
        </div>

        <span className="shrink-0 tabular-nums text-xs font-medium text-gray-700">{timeLabel}</span>
      </div>

      <button
        type="button"
        onClick={onDiscard}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200/90 bg-gray-100/95 text-slate-700 shadow-sm transition-colors hover:bg-gray-200/90 active:scale-95"
        aria-label="Delete recording and re-record"
      >
        <Trash2 className="h-5 w-5" strokeWidth={2} />
      </button>
    </div>
  );
}
