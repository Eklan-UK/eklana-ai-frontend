"use client";

import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MarkdownText } from "@/components/ui/MarkdownText";
import { Loader2, Volume2, Pause, Play, CheckCircle, Headphones } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { completeLearnerDrill } from "@/lib/drill/complete-learner-drill";
import {
  clearCheckpoint,
  markAssignedDrillInProgress,
} from "@/lib/drill/drill-checkpoint";
import { useTTS } from "@/hooks/useTTS";
import { resolveAccentVoiceId } from "@/services/tts-accent-voices";
import { useLocalDrillProgress } from "@/hooks/useLocalDrillProgress";
import { trackActivity } from "@/utils/activity-cache";
import { DrillCompletionScreen, DrillLayout } from "./shared";
import { DrillBookmarkToggle } from "@/components/drills/DrillBookmarkToggle";
import type { DrillConfettiVariant } from "@/lib/drill-celebration";

interface ListeningDrillProps {
  drill: any;
  assignmentId?: string;
}

export default function ListeningDrill({ drill, assignmentId }: ListeningDrillProps) {
  const queryClient = useQueryClient();
  const localProgress = useLocalDrillProgress({
    drillId: String(drill._id),
    drillType: "listening",
    assignmentId,
  });
  const [isCompleted, setIsCompleted] = useState(false);
  const [celebrationSoundUrl, setCelebrationSoundUrl] = useState<string>();
  const [confettiVariant, setConfettiVariant] = useState<DrillConfettiVariant>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());
  const [hasListened, setHasListened] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  
  // Pre-generated audio player
  const [isPlayingPreGen, setIsPlayingPreGen] = useState(false);
  const preGenAudioRef = useRef<HTMLAudioElement | null>(null);
  const markListenedRef = useRef<(listened: boolean) => void>(() => {});
  const markedInProgressRef = useRef(false);

  const markInProgressOnce = () => {
    if (!assignmentId || markedInProgressRef.current) return;
    markedInProgressRef.current = true;
    void markAssignedDrillInProgress(
      String(drill._id),
      assignmentId,
      "listening",
      new Date(startTime),
    );
  };

  const contentTitle = drill.listening_drill_title || drill.title;
  const content = drill.listening_drill_content || "";
  const audioUrl = drill.listening_drill_audio_url || "";
  const drillVoiceId = resolveAccentVoiceId(drill.tts_voice_key);

  markListenedRef.current = (listened: boolean) => {
    setHasListened(listened);
    localProgress.persist({
      resumeFromIndex: listened ? 1 : 0,
      completedItemCount: listened ? 1 : 0,
      partialResults: { hasListened: listened },
      startedAt: new Date(startTime).toISOString(),
    });
    if (listened) markInProgressOnce();
  };

  // TTS hook for playing content (fallback)
  const { playAudio: playTTSAudio, isGenerating: isGeneratingAudio, isPlaying: isTTSPlaying, stopAudio: stopTTSAudio } = useTTS({
    autoPlay: false,
    onPlayStart: () => {
      markListenedRef.current(true);
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

  useEffect(() => {
    if (!localProgress.isReady) return;
    const local = localProgress.hydrate();
    if (local?.partialResults?.hasListened === true) {
      setHasListened(true);
      markInProgressOnce();
    }
    setIsHydrating(false);
  }, [localProgress.isReady]);

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
        markListenedRef.current(true);
      };
      audio.onended = () => setIsPlayingPreGen(false);
      audio.onerror = () => {
        setIsPlayingPreGen(false);
        console.warn("Pre-generated audio failed, falling back to TTS");
        playWithTTS();
      };
      
      try {
        await audio.play();
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error("Error playing pre-generated audio:", err);
        }
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
      playTTSAudio(plainText, drillVoiceId);
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

      const result = await completeLearnerDrill(queryClient, drillId, {
        drillAssignmentId: assignmentId,
        score: 100, // Listening drills are completion-based
        timeSpent,
        listeningResults: {
          completed: true,
          timeSpent,
        },
        platform: 'web',
      });

      setCelebrationSoundUrl(result.data?.effects?.soundUrl);
      setConfettiVariant(result.data?.effects?.confettiVariant);

      localProgress.clear();
      void clearCheckpoint(drillId, assignmentId);
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

  if (isHydrating) {
    return (
      <DrillLayout title={drill.title} headerRight={<DrillBookmarkToggle drillId={String(drill._id)} />}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DrillLayout>
    );
  }

  if (isCompleted) {
    return (
      <DrillCompletionScreen
        drillType="listening"
        celebrate
        celebrationSoundUrl={celebrationSoundUrl}
        confettiVariant={confettiVariant}
      />
    );
  }

  return (
    <DrillLayout
      title={drill.title}
      headerRight={<DrillBookmarkToggle drillId={String(drill._id)} />}
    >
        {/* Context */}
        {drill.context && (
          <Card className="mb-4">
            <p className="text-sm text-foreground">{drill.context}</p>
          </Card>
        )}

        {/* Content Title */}
        {contentTitle && contentTitle !== drill.title && (
          <Card className="mb-4">
            <h2 className="text-xl font-bold text-foreground">{contentTitle}</h2>
          </Card>
        )}

        {/* Content */}
        <Card className="mb-4">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">Listen to the content:</h3>
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
              <div className="prose prose-sm max-w-none bg-muted p-4 rounded-lg border border-border">
                <MarkdownText>{content}</MarkdownText>
              </div>
            )}

            {!content && (
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-4">
                <p className="text-sm text-foreground">
                  No content available for this listening drill.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Listening Status Card */}
        <Card className={`mb-4 ${hasListened ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-amber-500/10 border-amber-500/25'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasListened ? (
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Headphones className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
              )}
              <div>
                <p className={`text-sm font-medium ${hasListened ? 'text-foreground' : 'text-foreground'}`}>
                  {hasListened ? 'Listening Complete!' : 'Listening Required'}
                </p>
                <p className="text-xs text-muted-foreground">
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
                  markListenedRef.current(true);
                  toast.success("Marked as listened!");
                }}
                className="border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/15"
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

