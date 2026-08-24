"use client";

import { useState, useRef, useEffect, type MutableRefObject } from "react";
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import { Button } from "./Button";

/** Module-level exclusive playback: starting one TTSButton stops the previous. */
let activeTTSStop: (() => void) | null = null;

export function stopAllTTSButtons() {
  const stop = activeTTSStop;
  activeTTSStop = null;
  stop?.();
}

function stopPreviousTTSButton(except?: (() => void) | null) {
  if (activeTTSStop && activeTTSStop !== except) {
    const prev = activeTTSStop;
    activeTTSStop = null;
    prev();
  }
}

interface TTSButtonProps {
  text: string;
  voiceId?: string;
  size?: "sm" | "md" | "lg";
  variant?: "icon" | "button";
  className?: string;
  autoPlay?: boolean;
  disabled?: boolean;
  /** Pre-generated audio URL (Cloudinary). If provided, plays directly from URL without TTS generation */
  audioUrl?: string;
  /** Called when audio starts playing — use to stop mic recording if active. */
  onPlayStart?: () => void;
  /** Write a stop function here so the parent can stop this button's audio externally. */
  stopRef?: MutableRefObject<(() => void) | null>;
}

export function TTSButton({
  text,
  voiceId,
  size = "md",
  variant = "icon",
  className = "",
  autoPlay = false,
  disabled = false,
  audioUrl,
  onPlayStart,
  stopRef,
}: TTSButtonProps) {
  const onPlayStartRef = useRef(onPlayStart);
  onPlayStartRef.current = onPlayStart;

  const stopImplRef = useRef<() => void>(() => {});
  const stableStopRef = useRef<() => void>(() => {
    stopImplRef.current();
  });

  // Use TTS hook for generating audio on-the-fly
  const { playAudio: playTTSAudio, preloadAudio, isGenerating, isPlaying: isTTSPlaying, stopAudio: stopTTSAudio } = useTTS({
    autoPlay: autoPlay && !audioUrl,
    onPlayStart: audioUrl
      ? undefined
      : () => {
          stopPreviousTTSButton(stableStopRef.current);
          onPlayStartRef.current?.();
          activeTTSStop = stableStopRef.current;
        },
  });
  
  // State for playing pre-generated audio
  const [isPlayingUrl, setIsPlayingUrl] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadedUrlRef = useRef<HTMLAudioElement | null>(null);
  
  // Combined playing state
  const isPlaying = audioUrl ? isPlayingUrl : isTTSPlaying;

  stopImplRef.current = () => {
    if (audioUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlayingUrl(false);
    } else {
      stopTTSAudio();
    }
    if (activeTTSStop === stableStopRef.current) {
      activeTTSStop = null;
    }
  };

  // Pre-warm TTS / pre-generated audio as soon as text or URL is known
  useEffect(() => {
    if (!text?.trim() && !audioUrl) return;

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.preload = "auto";
      audio.setAttribute("playsinline", "true");
      audio.load();
      preloadedUrlRef.current = audio;
      return () => {
        audio.pause();
        if (preloadedUrlRef.current === audio) {
          preloadedUrlRef.current = null;
        }
      };
    }

    void preloadAudio(text, voiceId);
  }, [text, audioUrl, voiceId, preloadAudio]);
  
  // Auto-play pre-generated audio if specified
  useEffect(() => {
    if (autoPlay && audioUrl && !isPlayingUrl) {
      playFromUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, audioUrl]);
  
  // Cleanup audio on unmount
  useEffect(() => {
    const stopThis = stableStopRef.current;
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (activeTTSStop === stopThis) {
        activeTTSStop = null;
      }
    };
  }, []);

  // Expose a stop function to the parent via stopRef
  useEffect(() => {
    if (!stopRef) return;
    stopRef.current = () => stopImplRef.current();
  }, [stopRef]);

  const playFromUrl = () => {
    if (!audioUrl) return;

    stopPreviousTTSButton(stableStopRef.current);
    
    // Stop any existing audio
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const audio =
      preloadedUrlRef.current?.src === audioUrl
        ? preloadedUrlRef.current
        : new Audio(audioUrl);
    audioRef.current = audio;
    
    audio.onplay = () => {
      setIsPlayingUrl(true);
      onPlayStartRef.current?.();
      activeTTSStop = stableStopRef.current;
    };
    audio.onended = () => {
      setIsPlayingUrl(false);
      if (activeTTSStop === stableStopRef.current) {
        activeTTSStop = null;
      }
    };
    audio.onerror = () => {
      setIsPlayingUrl(false);
      if (activeTTSStop === stableStopRef.current) {
        activeTTSStop = null;
      }
      // Fallback to TTS if pre-generated audio fails
      console.warn("Pre-generated audio failed, falling back to TTS");
      playTTSAudio(text, voiceId);
    };
    
    audio.currentTime = 0;
    audio.play().catch((err) => {
      console.error("Error playing audio:", err);
      setIsPlayingUrl(false);
      if (activeTTSStop === stableStopRef.current) {
        activeTTSStop = null;
      }
      // Fallback to TTS
      playTTSAudio(text, voiceId);
    });
  };
  
  const stopUrlAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlayingUrl(false);
    }
    if (activeTTSStop === stableStopRef.current) {
      activeTTSStop = null;
    }
  };

  const handleClick = () => {
    if (isPlaying) {
      // Stop based on source
      if (audioUrl) {
        stopUrlAudio();
      } else {
        stopTTSAudio();
        if (activeTTSStop === stableStopRef.current) {
          activeTTSStop = null;
        }
      }
    } else {
      // Play based on source
      if (audioUrl) {
        playFromUrl();
      } else {
        stopPreviousTTSButton(stableStopRef.current);
        playTTSAudio(text, voiceId);
      }
    }
  };

  const label = isPlaying ? "Stop audio" : "Play audio";

  if (variant === "button") {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={handleClick}
        disabled={disabled || isGenerating}
        className={className}
        title={label}
        aria-label={label}
      >
        {isGenerating ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating...
          </div>
        ) : isPlaying ? (
          <>
            <VolumeX className="w-4 h-4 mr-2" />
            Stop
          </>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Volume2 className="w-4 h-4 mr-2" />
            Listen
          </div>
        )}
      </Button>
    );
  }

  // Icon variant (default)
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isGenerating}
      className={`${
        sizeClasses[size]
      } flex items-center justify-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        isPlaying
          ? "bg-red-100 text-red-600 hover:bg-red-200"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      } ${className}`}
      title={label}
      aria-label={label}
    >
      {isGenerating ? (
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
      ) : isPlaying ? (
        <VolumeX className={iconSizes[size]} />
      ) : (
        <Volume2 className={iconSizes[size]} />
      )}
    </button>
  );
}
