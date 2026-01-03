"use client";

import { useState, useEffect, useRef } from "react";
import { MarkdownText } from "./MarkdownText";

interface ProgressiveTextProps {
  text: string;
  isPlaying: boolean;
  onComplete?: () => void;
  className?: string;
  showFullText?: boolean; // If true, show full text immediately when playing
}

/**
 * ProgressiveText component that displays text progressively as TTS plays
 * or shows full text with visual indicator when TTS is active
 */
export function ProgressiveText({
  text,
  isPlaying,
  onComplete,
  className = "",
  showFullText = true, // Default: show full text with visual indicator
}: ProgressiveTextProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      if (showFullText) {
        // Show full text immediately with visual indicator
        setDisplayedText(text);
        setIsComplete(true);
      } else {
        // Progressive display: show text word by word
        setDisplayedText("");
        setIsComplete(false);
        startTimeRef.current = Date.now();

        const words = text.split(/\s+/);
        let currentIndex = 0;

        // Calculate delay per word based on text length and estimated speech duration
        // Average speaking rate is ~150 words per minute = ~4 words per second
        const wordsPerSecond = 4;
        const delayPerWord = 1000 / wordsPerSecond;

        intervalRef.current = setInterval(() => {
          if (currentIndex < words.length) {
            const wordsToShow = words.slice(0, currentIndex + 1).join(" ");
            setDisplayedText(wordsToShow);
            currentIndex++;

            if (currentIndex >= words.length) {
              setIsComplete(true);
              onComplete?.();
            }
          } else {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          }
        }, delayPerWord);
      }
    } else {
      // When not playing, show full text
      setDisplayedText(text);
      setIsComplete(true);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, text, showFullText, onComplete]);

  // Reset when text changes
  useEffect(() => {
    if (!isPlaying) {
      setDisplayedText(text);
      setIsComplete(true);
    }
  }, [text]);

  return (
    <div className={`relative ${className}`}>
      <div className={isPlaying && showFullText ? "opacity-100" : ""}>
        <MarkdownText>{displayedText || text}</MarkdownText>
      </div>
      {/* Visual indicator when TTS is playing */}
      {isPlaying && showFullText && (
        <div className="absolute -left-2 top-0 bottom-0 w-1 bg-green-500 animate-pulse rounded" />
      )}
      {/* Loading indicator for progressive text */}
      {isPlaying && !showFullText && !isComplete && (
        <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse ml-1" />
      )}
    </div>
  );
}

