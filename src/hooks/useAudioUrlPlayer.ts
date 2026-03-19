import { useCallback, useEffect, useRef, useState } from "react";

interface UseAudioUrlPlayerOptions {
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
  onError?: (error: Error) => void;
}

export function useAudioUrlPlayer(options: UseAudioUrlPlayerOptions = {}) {
  const { onPlayStart, onPlayEnd, onError } = options;
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current = null;
    setIsPlaying(false);
  }, []);

  const play = useCallback(
    async (url: string) => {
      stop();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => {
        setIsPlaying(true);
        onPlayStart?.();
      };
      audio.onended = () => {
        setIsPlaying(false);
        onPlayEnd?.();
      };
      audio.onerror = () => {
        setIsPlaying(false);
        onError?.(new Error("Failed to play audio URL"));
      };
      await audio.play();
    },
    [onError, onPlayEnd, onPlayStart, stop]
  );

  useEffect(() => stop, [stop]);

  return { play, stop, isPlaying };
}

