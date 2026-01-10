"use client";

import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TTSButton } from "@/components/ui/TTSButton";
import {
  Loader2,
  FileText,
  BookOpen,
  Headphones,
  Eye,
  Play,
  Pause,
  CheckCircle,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { drillAPI } from "@/lib/api";
import { DrillCompletionScreen, DrillLayout } from "./shared";
import { trackActivity } from "@/utils/activity-cache";
import { useTTS } from "@/hooks/useTTS";

interface SummaryDrillProps {
  drill: any;
  assignmentId?: string;
}

export default function SummaryDrill({
  drill,
  assignmentId,
}: SummaryDrillProps) {
  const [summary, setSummary] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());
  const [wordCount, setWordCount] = useState(0);
  const [hasRead, setHasRead] = useState(false);
  const [hasListened, setHasListened] = useState(false);
  const [showPassage, setShowPassage] = useState(true);
  const [currentMode, setCurrentMode] = useState<"read" | "listen" | "write">(
    "read"
  );
  
  // Pre-generated audio player
  const [isPlayingPreGen, setIsPlayingPreGen] = useState(false);
  const preGenAudioRef = useRef<HTMLAudioElement | null>(null);

  const { playAudio: playTTSAudio, isPlaying: isTTSPlaying, stopAudio: stopTTSAudio } = useTTS();

  const articleTitle = drill.article_title || "Passage";
  const articleContent = drill.article_content || "";
  const articleAudioUrl = drill.article_audio_url || "";
  
  // Combined playing state
  const isPlaying = articleAudioUrl ? isPlayingPreGen : isTTSPlaying;
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (preGenAudioRef.current) {
        preGenAudioRef.current.pause();
        preGenAudioRef.current = null;
      }
    };
  }, []);

  // Calculate reading time (average 200 words per minute)
  const passageWordCount = articleContent
    .trim()
    .split(/\s+/)
    .filter((w: string) => w.length > 0).length;
  const readingTimeMinutes = Math.ceil(passageWordCount / 200);

  const handleSummaryChange = (value: string) => {
    setSummary(value);
    setWordCount(
      value
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length
    );
  };

  const handlePlayPassage = async () => {
    if (isPlaying) {
      // Stop based on source
      if (articleAudioUrl && preGenAudioRef.current) {
        preGenAudioRef.current.pause();
        preGenAudioRef.current.currentTime = 0;
        setIsPlayingPreGen(false);
      } else {
        stopTTSAudio();
      }
    } else {
      try {
        if (articleAudioUrl) {
          // Play from pre-generated URL
          if (preGenAudioRef.current) {
            preGenAudioRef.current.pause();
          }
          
          const audio = new Audio(articleAudioUrl);
          preGenAudioRef.current = audio;
          
          audio.onplay = () => setIsPlayingPreGen(true);
          audio.onended = () => {
            setIsPlayingPreGen(false);
            setHasListened(true);
          };
          audio.onerror = () => {
            setIsPlayingPreGen(false);
            // Fallback to TTS
            console.warn("Pre-generated audio failed, falling back to TTS");
            playTTSAudio(articleContent);
          };
          
          await audio.play();
        } else {
          // Fall back to TTS generation
          await playTTSAudio(articleContent);
        }
        setHasListened(true);
      } catch (error) {
        toast.error("Failed to play audio");
      }
    }
  };

  const handleMarkAsRead = () => {
    setHasRead(true);
    setCurrentMode("write");
    toast.success("Great! Now write your summary.");
  };

  const handleSubmit = async () => {
    if (!assignmentId) {
      toast.error("Assignment ID is missing. Cannot submit drill.");
      return;
    }

    if (!summary.trim()) {
      toast.error("Please write a summary before submitting");
      return;
    }

    if (wordCount < 30) {
      toast.error("Please write at least 30 words for your summary");
      return;
    }

    setIsSubmitting(true);
    try {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

      await drillAPI.complete(drill._id, {
        drillAssignmentId: assignmentId,
        score: 0, // Score will be set after review
        timeSpent,
        summaryResults: {
          summaryProvided: true,
          articleTitle,
          articleContent,
          summary,
          wordCount,
          reviewStatus: "pending",
        },
        platform: "web",
      });

      setIsCompleted(true);
      toast.success("Summary submitted for review!");

      trackActivity("drill", drill._id, "completed", {
        title: drill.title,
        type: drill.type,
        });
    } catch (error: any) {
      toast.error(
        "Failed to submit drill: " + (error.message || "Unknown error")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleted) {
    return (
      <DrillCompletionScreen
        title="Summary Submitted"
        message="Your summary has been submitted for review. You'll receive feedback from your tutor soon."
        drillType="summary"
      />
    );
  }

  return (
    <DrillLayout
      title={drill.title}
      backgroundGradient="bg-gradient-to-br from-green-50 to-emerald-50"
      maxWidth="3xl"
    >
      {/* Mode Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setCurrentMode("read")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
            currentMode === "read"
              ? "bg-green-600 text-white shadow-lg"
              : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Read</span>
          {hasRead && (
            <CheckCircle className="w-4 h-4 text-green-300 ml-1" />
          )}
        </button>
        <button
          onClick={() => setCurrentMode("listen")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
            currentMode === "listen"
              ? "bg-green-600 text-white shadow-lg"
              : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
          }`}
        >
          <Headphones className="w-4 h-4" />
          <span>Listen</span>
          {hasListened && (
            <CheckCircle className="w-4 h-4 text-green-300 ml-1" />
          )}
        </button>
        <button
          onClick={() => setCurrentMode("write")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
            currentMode === "write"
              ? "bg-green-600 text-white shadow-lg"
              : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Write</span>
        </button>
      </div>

      {/* Read Mode */}
      {currentMode === "read" && (
        <>
        {/* Instructions */}
        <Card className="mb-6 bg-green-50 border-green-200">
          <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
                <p className="text-sm font-semibold text-green-900 mb-1">
                  Read the Passage
                </p>
              <p className="text-sm text-green-800">
                  Read the passage carefully. Pay attention to the main ideas
                  and key details. Estimated reading time: {readingTimeMinutes}{" "}
                  min ({passageWordCount} words)
              </p>
            </div>
          </div>
        </Card>

          {/* Passage Card */}
          <Card className="mb-6 bg-white shadow-lg">
          <div className="mb-4 pb-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-green-500" />
                {articleTitle}
              </h2>
                {/*<TTSButton text={articleContent} size="md" audioUrl={articleAudioUrl} />*/}
              </div>
            </div>

            <div className="prose prose-sm max-w-none">
              <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base">
                {articleContent || "No passage content provided."}
              </div>
            </div>
          </Card>

          {/* Mark as Read Button */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleMarkAsRead}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            I've Read the Passage - Continue to Write
          </Button>
        </>
      )}

      {/* Listen Mode */}
      {currentMode === "listen" && (
        <>
          {/* Instructions */}
          <Card className="mb-6 bg-green-50 border-green-200">
            <div className="flex items-start gap-3">
              <Headphones className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-900 mb-1">
                  Listen to the Passage
                </p>
                <p className="text-sm text-green-800">
                  Listen to the passage being read aloud. You can follow along
                  with the text below or close your eyes and focus on listening.
                </p>
              </div>
            </div>
          </Card>

          {/* Audio Player Card */}
          <Card className="mb-6 bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg">
            <div className="text-center py-6">
              <h3 className="text-lg font-semibold mb-4">{articleTitle}</h3>

              <button
                onClick={handlePlayPassage}
                className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 transition-all ${
                  isPlaying
                    ? "bg-white/30 scale-110"
                    : "bg-white/20 hover:bg-white/30"
                }`}
              >
                {isPlaying ? (
                  <Pause className="w-10 h-10 text-white" />
                ) : (
                  <Play className="w-10 h-10 text-white ml-1" />
                )}
              </button>

              <p className="text-sm text-white/80">
                {isPlaying ? "Playing..." : "Tap to play"}
              </p>

              {hasListened && (
                <div className="mt-4 flex items-center justify-center gap-2 text-green-200">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">Listened</span>
                </div>
              )}
            </div>
          </Card>

          {/* Toggle Passage Visibility */}
          <Card className="mb-6 bg-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Eye className="w-4 h-4 text-gray-500" />
                Passage Text
              </h3>
              <button
                onClick={() => setShowPassage(!showPassage)}
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                {showPassage ? "Hide" : "Show"}
              </button>
          </div>
          
            {showPassage && (
          <div className="prose prose-sm max-w-none">
            <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {articleContent || "No passage content provided."}
                </div>
              </div>
            )}
          </Card>

          {/* Continue Button */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => {
              setHasListened(true);
              setCurrentMode("write");
            }}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
          >
            <FileText className="w-5 h-5 mr-2" />
            Continue to Write Summary
          </Button>
        </>
      )}

      {/* Write Mode */}
      {currentMode === "write" && (
        <>
          {/* Instructions */}
          <Card className="mb-6 bg-green-50 border-green-200">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-900 mb-1">
                  Write Your Summary
                </p>
                <p className="text-sm text-green-800">
                  Summarize the main ideas and key points from the passage.
                  Write at least 30 words. Your summary will be reviewed by your
                  tutor.
                </p>
              </div>
            </div>
          </Card>

          {/* Reference Toggle */}
          <Card className="mb-4 bg-white shadow-sm">
            <button
              onClick={() => setShowPassage(!showPassage)}
              className="w-full flex items-center justify-between"
            >
              <span className="flex items-center gap-2 font-medium text-gray-700">
                <BookOpen className="w-4 h-4 text-green-500" />
                {articleTitle}
              </span>
              <span className="text-sm text-green-600 font-medium">
                {showPassage ? "Hide Passage" : "Show Passage"}
              </span>
            </button>

            {showPassage && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="prose prose-sm max-w-none">
                  <div className="text-gray-600 leading-relaxed whitespace-pre-wrap text-sm max-h-48 overflow-y-auto">
                    {articleContent}
                  </div>
            </div>
          </div>
            )}
        </Card>

        {/* Summary Input */}
          <Card className="mb-6 bg-white shadow-lg">
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-500" />
                Your Summary
            </label>
            <div className="relative">
              <textarea
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all min-h-[200px] resize-none text-base"
                  placeholder="Write your summary here...&#10;&#10;Include the main points and key ideas from the passage. Try to use your own words."
                value={summary}
                onChange={(e) => handleSummaryChange(e.target.value)}
              />

                {/* Word count and status */}
                <div className="flex items-center justify-between mt-3 px-1">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-sm font-medium ${
                        wordCount >= 30 ? "text-green-600" : "text-gray-500"
                      }`}
                    >
                      {wordCount} {wordCount === 1 ? "word" : "words"}
                    </span>
                    {wordCount < 30 && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                        {30 - wordCount} more needed
                      </span>
                    )}
                  </div>

                  {wordCount >= 30 && (
                    <div className="flex items-center gap-1.5 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Ready</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Status indicators */}
          <div className="flex items-center justify-center gap-4 mb-4">
            {hasRead && (
              <div className="flex items-center gap-1.5 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>Read</span>
              </div>
            )}
            {hasListened && (
              <div className="flex items-center gap-1.5 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>Listened</span>
              </div>
            )}
          </div>

        {/* Submit Button */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleSubmit}
            disabled={isSubmitting || wordCount < 30}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Submit Summary for Review
              </>
          )}
        </Button>
        </>
      )}
    </DrillLayout>
  );
}
