"use client";

import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MarkdownText } from "@/components/ui/MarkdownText";
import { Loader2, Volume2, Pause, Play, CheckCircle, Headphones } from "lucide-react";
import { toast } from "sonner";
import { drillAPI } from "@/lib/api";
import { useTTS } from "@/hooks/useTTS";
import { trackActivity } from "@/utils/activity-cache";
import { DrillCompletionScreen, DrillLayout } from "./shared";

interface ListeningDrillProps {
  drill: any;
  assignmentId?: string;
}

export default function ListeningDrill({ drill, assignmentId }: ListeningDrillProps) {
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());
  const [hasListened, setHasListened] = useState(false);
  
  // Pre-generated audio player
  const [isPlayingPreGen, setIsPlayingPreGen] = useState(false);
  const preGenAudioRef = useRef<HTMLAudioElement | null>(null);

  const contentTitle = drill.listening_drill_title || drill.title;
  const content = drill.listening_drill_content || "";
  const audioUrl = drill.listening_drill_audio_url || "";

  // TTS hook for playing content (fallback)
  const { playAudio: playTTSAudio, isGenerating: isGeneratingAudio, isPlaying: isTTSPlaying, stopAudio: stopTTSAudio } = useTTS({
    autoPlay: false,
    onPlayStart: () => {
      setHasListened(true);
    },
    onPlayEnd: () => {
      // Audio finished
    },
    onError: (error) => {
      console.error("TTS Error:", error);
      toast.error("Failed to play audio");
    },
  });
  
  // Combined playing state
  const isPlaying = audioUrl ? isPlayingPreGen : isTTSPlaying;
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (preGenAudioRef.current) {
        preGenAudioRef.current.pause();
        preGenAudioRef.current = null;
      }
    };
  }, []);

  const handlePlay = async () => {
    if (!content.trim() && !audioUrl) {
      toast.error("No content available to play");
      return;
    }

    if (audioUrl) {
      // Play from pre-generated URL
      if (preGenAudioRef.current) {
        preGenAudioRef.current.pause();
      }
      
      const audio = new Audio(audioUrl);
      preGenAudioRef.current = audio;
      
      audio.onplay = () => {
        setIsPlayingPreGen(true);
        setHasListened(true);
      };
      audio.onended = () => setIsPlayingPreGen(false);
      audio.onerror = () => {
        setIsPlayingPreGen(false);
        // Fallback to TTS
        console.warn("Pre-generated audio failed, falling back to TTS");
        playWithTTS();
      };
      
      try {
        await audio.play();
      } catch (err) {
        console.error("Error playing pre-generated audio:", err);
        playWithTTS();
      }
    } else {
      playWithTTS();
    }
  };
  
  const playWithTTS = () => {
    // Extract plain text from markdown for TTS
    const plainText = content
      .replace(/#{1,6}\s+/g, "") // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold
      .replace(/\*(.*?)\*/g, "$1") // Remove italic
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // Remove links, keep text
      .replace(/`([^`]+)`/g, "$1") // Remove inline code
      .replace(/```[\s\S]*?```/g, "") // Remove code blocks
      .replace(/>\s+/g, "") // Remove blockquotes
      .replace(/\n{2,}/g, ". ") // Convert paragraph breaks to sentence breaks
      .replace(/\n/g, " ") // Convert line breaks to spaces
      .trim();

    if (plainText) {
      playTTSAudio(plainText);
    } else {
      toast.error("No readable content found");
    }
  };
  
  const stopAudio = () => {
    if (audioUrl && preGenAudioRef.current) {
      preGenAudioRef.current.pause();
      preGenAudioRef.current.currentTime = 0;
      setIsPlayingPreGen(false);
    } else {
      stopTTSAudio();
    }
  };

  const handleSubmit = async () => {
    if (!assignmentId) {
      toast.error("Assignment ID is missing. Cannot submit drill.");
      return;
    }

    if (!hasListened) {
      toast.error("Please listen to the content before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

      // Verify drill ID format
      const drillId = drill._id?.toString();
      if (!drillId) {
        toast.error("Invalid drill ID. Cannot submit drill.");
        setIsSubmitting(false);
        return;
      }

      await drillAPI.complete(drillId, {
        drillAssignmentId: assignmentId,
        score: 100, // Listening drills are completion-based
        timeSpent,
        listeningResults: {
          completed: true,
          timeSpent,
        },
        platform: 'web',
      });

      setIsCompleted(true);
      toast.success("Drill completed! Great job!");

      // Track activity locally (no API call)
      trackActivity("drill", drill._id, "completed", {
        title: drill.title,
        type: drill.type,
        });
    } catch (error: any) {
      toast.error("Failed to submit drill: " + (error.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleted) {
    return <DrillCompletionScreen drillType="listening" />;
  }

  return (
    <DrillLayout title={drill.title}>
        {/* Context */}
        {drill.context && (
          <Card className="mb-4">
            <p className="text-sm text-gray-700">{drill.context}</p>
          </Card>
        )}

        {/* Content Title */}
        {contentTitle && contentTitle !== drill.title && (
          <Card className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">{contentTitle}</h2>
          </Card>
        )}

        {/* Content */}
        <Card className="mb-4">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Listen to the content:</h3>
              <Button
                variant={isPlaying ? "outline" : "primary"}
                size="sm"
                onClick={isPlaying ? stopAudio : handlePlay}
                disabled={isGeneratingAudio || !content.trim()}
              >
                {isGeneratingAudio ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Play
                  </>
                )}
              </Button>
            </div>
            
            {content && (
              <div className="prose prose-sm max-w-none bg-gray-50 p-4 rounded-lg border border-gray-200">
                <MarkdownText>{content}</MarkdownText>
              </div>
            )}

            {!content && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  No content available for this listening drill.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Listening Status Card */}
        <Card className={`mb-4 ${hasListened ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasListened ? (
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Headphones className="w-5 h-5 text-amber-600" />
                </div>
              )}
              <div>
                <p className={`text-sm font-medium ${hasListened ? 'text-green-900' : 'text-amber-900'}`}>
                  {hasListened ? 'Listening Complete!' : 'Listening Required'}
                </p>
                <p className={`text-xs ${hasListened ? 'text-green-700' : 'text-amber-700'}`}>
                  {hasListened 
                    ? 'You can now complete this drill' 
                    : 'Listen to the content or mark as listened'}
                </p>
              </div>
            </div>
            
            {/* Mark as Listened Button */}
            {!hasListened && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setHasListened(true);
                  toast.success("Marked as listened!");
                }}
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Mark as Listened
              </Button>
            )}
          </div>
        </Card>

        {/* Instructions */}
        <Card className="mb-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-2">
            <Volume2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900 mb-1">Instructions</p>
              <p className="text-sm text-blue-800">
                Click the Play button to listen to the content. You can read along as you listen.
                Once you've listened, click "Complete Drill" to finish.
              </p>
            </div>
          </div>
        </Card>

        {/* Submit Button */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleSubmit}
          disabled={!hasListened || isSubmitting || !content.trim()}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Submitting...
            </>
          ) : hasListened ? (
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              Complete Drill
            </>
          ) : (
            <>
              <Headphones className="w-5 h-5 mr-2" />
              Listen First to Complete
            </>
          )}
        </Button>
    </DrillLayout>
  );
}

