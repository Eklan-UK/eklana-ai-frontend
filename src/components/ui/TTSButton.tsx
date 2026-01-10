"use client";

import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import { Button } from "./Button";

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
}: TTSButtonProps) {
  // Use TTS hook for generating audio on-the-fly
  const { playAudio: playTTSAudio, isGenerating, isPlaying: isTTSPlaying, stopAudio: stopTTSAudio } = useTTS({
    autoPlay: autoPlay && !audioUrl, // Only auto-play via TTS if no audioUrl
  });
  
  // State for playing pre-generated audio
  const [isPlayingUrl, setIsPlayingUrl] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Combined playing state
  const isPlaying = audioUrl ? isPlayingUrl : isTTSPlaying;
  
  // Auto-play pre-generated audio if specified
  useEffect(() => {
    if (autoPlay && audioUrl && !isPlayingUrl) {
      playFromUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, audioUrl]);
  
  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playFromUrl = () => {
    if (!audioUrl) return;
    
    // Stop any existing audio
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    audio.onplay = () => setIsPlayingUrl(true);
    audio.onended = () => setIsPlayingUrl(false);
    audio.onerror = () => {
      setIsPlayingUrl(false);
      // Fallback to TTS if pre-generated audio fails
      console.warn("Pre-generated audio failed, falling back to TTS");
      playTTSAudio(text, voiceId);
    };
    
    audio.play().catch((err) => {
      console.error("Error playing audio:", err);
      setIsPlayingUrl(false);
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
  };

  const handleClick = () => {
    if (isPlaying) {
      // Stop based on source
      if (audioUrl) {
        stopUrlAudio();
      } else {
        stopTTSAudio();
      }
    } else {
      // Play based on source
      if (audioUrl) {
        playFromUrl();
      } else {
        playTTSAudio(text, voiceId);
      }
    }
  };

  if (variant === "button") {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={handleClick}
        disabled={disabled || isGenerating}
        className={className}
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
            Play
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
      title={isPlaying ? "Stop audio" : "Play audio"}
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
