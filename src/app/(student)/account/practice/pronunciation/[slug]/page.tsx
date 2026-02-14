"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TTSButton } from "@/components/ui/TTSButton";
import { PronunciationScore } from "@/components/ui/PronunciationScore";
import { LetterLevelFeedback } from "@/components/ui/LetterLevelFeedback";
import {
  Mic,
  Loader2,
  Volume2,
  CheckCircle,
  XCircle,
  BookOpen,
} from "lucide-react";
import {
  usePronunciationProblem,
  useSubmitPronunciationWordAttempt,
} from "@/hooks/usePronunciations";
import { toast } from "sonner";
import Link from "next/link";
import type { TextScore } from "@/services/speechace.service";
import { speechaceService } from "@/services/speechace.service";
import { useAuthStore } from "@/store/auth-store";

export default function PronunciationWordPracticePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const { data, isLoading, error } = usePronunciationProblem(slug);
  const submitAttemptMutation = useSubmitPronunciationWordAttempt();
  const { user } = useAuthStore();

  const problem = data?.problem;
  const words = data?.words || [];
  const progress = data?.progress;

  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pronunciationScore, setPronunciationScore] = useState<TextScore | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [isSavingAnalytics, setIsSavingAnalytics] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "word" | "sound" | "sentence">("all");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Find the first uncompleted word or start from the beginning
  useEffect(() => {
    if (words.length > 0 && progress?.nextWord) {
      const nextWordIndex = words.findIndex(
        (w: any) => w._id.toString() === progress.nextWord._id.toString()
      );
      if (nextWordIndex !== -1) {
        setCurrentWordIndex(nextWordIndex);
      }
    }
  }, [words, progress]);

  // Filter words by type
  const filteredWords = typeFilter === "all" 
    ? words 
    : words.filter((w: any) => w.type === typeFilter);
  
  // Ensure currentWordIndex is within bounds
  const safeIndex = Math.min(currentWordIndex, filteredWords.length - 1);
  const currentWord = filteredWords[safeIndex >= 0 ? safeIndex : 0];

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
        // Auto-analyze after recording stops
        await analyzePronunciation(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setPronunciationScore(null);
    } catch (error: any) {
      toast.error("Failed to access microphone: " + error.message);
      console.error("Error accessing microphone:", error);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Analyze pronunciation with SpeechAce API (via backend due to CORS)
  // Results are displayed immediately, analytics saved in background
  const analyzePronunciation = async (audioBlob: Blob) => {
    if (!currentWord || !user?.id) return;

    setIsAnalyzing(true);
    setPronunciationScore(null);

    try {
      // Convert audio blob to base64
      const reader = new FileReader();
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      // Call SpeechAce via backend API (CORS-safe) for immediate results
      const speechAceResponse = await speechaceService.scorePronunciation(
        currentWord.word,
        audioBlob
      );

      // Display results immediately
      // The backend API returns: { code, message, data: result }
      // where result contains textScore (TextScore object) from the backend service normalization
      const result = speechAceResponse.data as any;
      let textScore: TextScore | null = null;

      // The backend service normalizes the response and returns textScore (camelCase) as the TextScore object
      // It also spreads rawData which may contain text_score (snake_case) from the raw API response
      if (result?.textScore && typeof result.textScore === 'object') {
        // textScore is the TextScore object from backend normalization
        textScore = result.textScore as TextScore;
      } else if (result?.text_score && typeof result.text_score === 'object') {
        // Fallback: check for text_score (snake_case) from raw API response
        textScore = result.text_score as TextScore;
      } else if (result?.data?.text_score) {
        // Another fallback: check nested data structure
        textScore = result.data.text_score as TextScore;
      }

      if (textScore) {
        setPronunciationScore(textScore);
        toast.success("Pronunciation analyzed successfully!");
        setIsAnalyzing(false);
      } else {
        console.error("SpeechAce response structure:", speechAceResponse);
        console.error("Result data:", result);
        throw new Error("Invalid response from SpeechAce - missing textScore. Check console for response structure.");
      }

      // Save analytics in background (non-blocking)
      setIsSavingAnalytics(true);
      saveAnalyticsInBackground(base64Audio).catch((error) => {
        console.error("Failed to save analytics:", error);
        // Don't show error to user - analytics saving is non-critical
      }).finally(() => {
        setIsSavingAnalytics(false);
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to analyze pronunciation");
      console.error("Error analyzing pronunciation:", error);
      setIsAnalyzing(false);
    }
  };

  // Save analytics in background without blocking UI
  const saveAnalyticsInBackground = async (base64Audio: string) => {
    if (!currentWord) return;

    try {
      // Submit attempt to backend for analytics (non-blocking)
      await submitAttemptMutation.mutateAsync({
        wordId: currentWord._id.toString(),
        data: {
          audioBase64: base64Audio,
          passingThreshold: 70,
        },
      });
    } catch (error: any) {
      // Silently fail - analytics saving is non-critical
      console.error("Error saving analytics:", error);
    }
  };

  // Reset for next word
  const handleNextWord = () => {
    setPronunciationScore(null);
    setAudioBlob(null);
    if (currentWordIndex < filteredWords.length - 1) {
      setCurrentWordIndex(currentWordIndex + 1);
      if (autoPlayAudio) {
        // TTS will be triggered by TTSButton autoPlay
      }
    } else {
      // All words completed
      router.push("/account/practice/pronunciation/completed");
    }
  };

  // Try again
  const handleTryAgain = () => {
    setPronunciationScore(null);
    setAudioBlob(null);
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      beginner: "bg-green-100 text-green-700",
      intermediate: "bg-yellow-100 text-yellow-700",
      advanced: "bg-red-100 text-red-700",
    };
    return colors[difficulty] || "bg-gray-100 text-gray-700";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white pb-20 md:pb-0">
        <div className="h-6"></div>
        <Header title="Pronunciation Practice" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="min-h-screen bg-white pb-20 md:pb-0">
        <div className="h-6"></div>
        <Header title="Pronunciation Practice" />
        <div className="max-w-md mx-auto px-4 py-8 md:max-w-2xl md:px-8">
          <Card className="p-8 text-center">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Problem not found</h3>
            <p className="text-gray-500 text-sm mb-4">
              The pronunciation problem you're looking for doesn't exist.
            </p>
            <Link href="/account/practice/pronunciation">
              <Button variant="outline">Back to Problems</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  if (words.length === 0 || filteredWords.length === 0) {
    return (
      <div className="min-h-screen bg-white pb-20 md:pb-0">
        <div className="h-6"></div>
        <Header title="Pronunciation Practice" />
        <div className="max-w-md mx-auto px-4 py-8 md:max-w-2xl md:px-8">
          <Card className="p-8 text-center">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No words available</h3>
            <p className="text-gray-500 text-sm mb-4">
              {typeFilter === "all" 
                ? "This problem doesn't have any words to practice yet."
                : `This problem doesn't have any ${typeFilter} items to practice. Try selecting a different type.`}
            </p>
            <Link href="/account/practice/pronunciation">
              <Button variant="outline">Back to Problems</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const wordProgress = currentWord ? progress?.wordProgress?.[currentWord._id.toString()] : null;
  const isPassed = wordProgress?.passed || (pronunciationScore && pronunciationScore.speechace_score.pronunciation >= 70);

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Pronunciation Practice" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        {/* Type Filter */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={typeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setTypeFilter("all");
              setCurrentWordIndex(0);
            }}
            className="whitespace-nowrap"
          >
            All
          </Button>
          <Button
            variant={typeFilter === "word" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setTypeFilter("word");
              setCurrentWordIndex(0);
            }}
            className="whitespace-nowrap"
          >
            Words
          </Button>
          <Button
            variant={typeFilter === "sound" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setTypeFilter("sound");
              setCurrentWordIndex(0);
            }}
            className="whitespace-nowrap"
          >
            Sounds
          </Button>
          <Button
            variant={typeFilter === "sentence" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setTypeFilter("sentence");
              setCurrentWordIndex(0);
            }}
            className="whitespace-nowrap"
          >
            Sentences
          </Button>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {filteredWords.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all ${
                index <= currentWordIndex ? "bg-green-600 w-8" : "bg-gray-300 w-2"
              }`}
            />
          ))}
        </div>

        {/* Word Card */}
        {currentWord && (
          <Card className="mb-6 bg-gradient-to-br from-green-50 to-blue-50">
            <div className="text-center py-8">
              <div className="flex items-center justify-center gap-3 mb-2">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
                  {currentWord.word}
                </h1>
                <TTSButton
                  text={currentWord.word}
                  size="lg"
                  autoPlay={autoPlayAudio && !pronunciationScore}
                />
              </div>
              <p className="text-lg md:text-xl text-gray-600 mb-6">
                {currentWord.ipa}
              </p>
            <div className="flex items-center justify-center gap-4 text-sm text-gray-500 mb-4">
              {currentWord?.type && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 capitalize">
                  {currentWord.type}
                </span>
              )}
              <div className="flex items-center gap-1">
                <Volume2 className="w-4 h-4" />
                <span className="capitalize">{currentWord?.difficulty || problem.difficulty}</span>
              </div>
              {problem.estimatedTimeMinutes && (
                <>
                  <span>•</span>
                  <span>{problem.estimatedTimeMinutes} min</span>
                </>
              )}
            </div>
            {problem.description && (
              <p className="text-sm text-gray-600 mb-4">{problem.description}</p>
            )}
            {wordProgress && wordProgress.attempts > 0 && (
              <div className="text-sm text-gray-600 mb-4">
                <p>
                  Attempts: {wordProgress.attempts} | Best Score: {wordProgress.bestScore?.toFixed(0)}%
                  {wordProgress.passed && (
                    <span className="ml-2 text-green-600 font-semibold">✓ Passed</span>
                  )}
                </p>
              </div>
            )}
            <label className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoPlayAudio}
                onChange={(e) => setAutoPlayAudio(e.target.checked)}
                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
              />
              <span>Auto-play pronunciation</span>
            </label>
            </div>
          </Card>
        )}

        {/* Listen Section */}
        {currentWord && (
          <Card className="mb-6">
            <div className="text-center py-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Listen to the correct pronunciation
              </h3>
              <div className="flex items-center justify-center gap-4">
                <TTSButton
                  text={currentWord.word}
                  size="lg"
                  variant="button"
                  autoPlay={autoPlayAudio && !pronunciationScore}
                />
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Click to hear &quot;{currentWord.word}&quot; pronounced correctly
              </p>
            </div>
          </Card>
        )}

        {/* Record Section */}
        {currentWord && (
          <Card className="mb-6">
          <div className="text-center py-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Record your pronunciation
            </h3>
            <div className="relative">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isAnalyzing}
                className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                  isRecording
                    ? "bg-red-500 hover:bg-red-600 animate-pulse"
                    : "bg-blue-500 hover:bg-blue-600"
                }`}
              >
                <Mic className="w-12 h-12 text-white" />
              </button>
              {isRecording && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap">
                  Recording... Tap to stop
                </div>
              )}
            </div>
            {!isRecording && !isAnalyzing && !pronunciationScore && (
              <p className="text-sm text-gray-500 mt-4">
                Tap the microphone to start recording
              </p>
            )}
            {isAnalyzing && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <p className="text-sm text-gray-600">Analyzing your pronunciation...</p>
              </div>
            )}
            {pronunciationScore && !isAnalyzing && (
              <p className="text-sm text-green-600 mt-4 font-medium">
                ✓ Analysis complete! Scroll down to see your score.
              </p>
            )}
          </div>
        </Card>
        )}

        {/* Pronunciation Score Section */}
        {pronunciationScore && currentWord && (
          <div className="mb-6 space-y-4">
            <PronunciationScore textScore={pronunciationScore} />
            
            {/* Letter-level feedback */}
            {pronunciationScore.word_score_list.length > 0 && (
              <LetterLevelFeedback
                word={currentWord.word}
                wordScore={pronunciationScore.word_score_list[0]}
              />
            )}

            {/* Analytics saving indicator (subtle) */}
            {isSavingAnalytics && (
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Saving progress...</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {currentWord && (
          <div className="space-y-3">
            {pronunciationScore && currentWordIndex < filteredWords.length - 1 && (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleNextWord}
                disabled={isRecording || isAnalyzing}
              >
                Next Word
              </Button>
            )}
            {pronunciationScore && currentWordIndex === filteredWords.length - 1 && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => router.push("/account/practice/pronunciation/completed")}
              disabled={isRecording || isAnalyzing}
            >
              Complete Practice
            </Button>
          )}
          {pronunciationScore && (
            <Button
              variant="outline"
              size="lg"
              fullWidth
              onClick={handleTryAgain}
              disabled={isRecording || isAnalyzing}
            >
              Try Again
            </Button>
          )}
          <Button
            variant="outline"
            size="lg"
            fullWidth
            onClick={() => router.back()}
            disabled={isRecording || isAnalyzing}
          >
            Back to Practice
          </Button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
