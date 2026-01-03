"use client";

import { ProgressiveText } from "./ProgressiveText";
import { TTSButton } from "./TTSButton";
import { Bot } from "lucide-react";

interface AIMessageProps {
  text: string;
  isPlaying: boolean;
  isGenerating: boolean;
  onPlay: () => void;
  onStop: () => void;
  autoPlay?: boolean;
  showTTSButton?: boolean;
}

export function AIMessage({
  text,
  isPlaying,
  isGenerating,
  onPlay,
  onStop,
  autoPlay = false,
  showTTSButton = true,
}: AIMessageProps) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-gray-500">
            AI Partner
          </span>
        </div>
        <ProgressiveText
          text={text}
          isPlaying={isPlaying}
          showFullText={true} // Show full text with visual indicator
          className="text-sm leading-relaxed"
        />
      </div>
      {showTTSButton && (
        <div className="flex-shrink-0">
          <TTSButton
            text={text}
            size="sm"
            autoPlay={true}
            disabled={isGenerating}
          />
        </div>
      )}
    </div>
  );
}
