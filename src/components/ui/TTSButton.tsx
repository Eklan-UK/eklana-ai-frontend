"use client";

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
}

export function TTSButton({
  text,
  voiceId,
  size = "md",
  variant = "icon",
  className = "",
  autoPlay = false,
  disabled = false,
}: TTSButtonProps) {
  const { playAudio, isGenerating, isPlaying, stopAudio } = useTTS({
    autoPlay: autoPlay, // Pass autoPlay to hook
  });

  const handleClick = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      playAudio(text, voiceId);
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
