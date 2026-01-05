"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Mic,
  Play,
  Pause,
  Volume2,
  CheckCircle,
  XCircle,
  Loader2,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  BookOpen,
} from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import {
  usePronunciationProblem,
  useSubmitPronunciationWordAttempt,
} from "@/hooks/usePronunciations";
import { toast } from "sonner";
import Link from "next/link";

interface AttemptResult {
  textScore: number;
  fluencyScore?: number;
  passed: boolean;
  wordScores?: Array<{ word: string; score: number }>;
  incorrectLetters?: string[];
  incorrectPhonemes?: string[];
  textFeedback?: string;
  wordFeedback?: Array<{ word: string; feedback: string }>;
  attemptNumber: number;
}

export default function PronunciationWordPracticePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const { data, isLoading, error } = usePronunciationProblem(slug);
  const submitAttemptMutation = useSubmitPronunciationWordAttempt();

  const problem = data?.problem;
  const words = data?.words || [];
  const progress = data?.progress;

  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [attemptResult, setAttemptResult] = useState<AttemptResult | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // TTS hook for pronunciation audio
  const { playAudio: playTTS, isGenerating: isGeneratingTTS, isPlaying: isPlayingTTS, stopAudio: stopTTS } = useTTS({
    autoPlay: false,
  });

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

  const currentWord = words[currentWordIndex];

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setAttemptResult(null);
    } catch (error: any) {
      toast.error("Failed to start recording: " + error.message);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Play word audio (uploaded or TTS)
  const handlePlayWordAudio = () => {
    if (!currentWord) return;

    if (currentWord.audioUrl) {
      // Use uploaded audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(currentWord.audioUrl);
      audioRef.current = audio;
      setIsPlayingAudio(true);
      audio.play();
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => {
        setIsPlayingAudio(false);
        toast.error("Failed to play audio");
      };
    } else {
      // Use TTS
      playTTS(currentWord.word);
    }
  };

  // Stop audio playback
  const handleStopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      setIsPlayingAudio(false);
    }
    stopTTS();
  };

  // Submit pronunciation attempt
  const submitAttempt = async () => {
    if (!audioBlob || !currentWord) {
      toast.error("Please record your pronunciation first");
      return;
    }

    setIsAnalyzing(true);
    setAttemptResult(null);

    try {
      // Convert audio blob to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Audio = reader.result as string;

          // Submit attempt
          const result = await submitAttemptMutation.mutateAsync({
            wordId: currentWord._id.toString(),
            data: {
              audioBase64: base64Audio,
              passingThreshold: 70,
            },
          });

          if (result.data?.attempt) {
            setAttemptResult(result.data.attempt);
            // Invalidate queries to refresh progress
            // This will be handled by the mutation's onSuccess
          }
        } catch (error: any) {
          toast.error(error.response?.data?.message || error.message || "Failed to submit attempt");
        } finally {
          setIsAnalyzing(false);
        }
      };

      reader.onerror = () => {
        toast.error("Failed to process audio");
        setIsAnalyzing(false);
      };

      reader.readAsDataURL(audioBlob);
    } catch (error: any) {
      toast.error("Failed to submit attempt: " + error.message);
      setIsAnalyzing(false);
    }
  };

  // Move to next word
  const handleNextWord = () => {
    if (currentWordIndex < words.length - 1) {
      setCurrentWordIndex(currentWordIndex + 1);
      setAudioBlob(null);
      setAttemptResult(null);
    } else {
      // All words completed - navigate to completion page
      router.push(`/account/practice/pronunciation/completed`);
    }
  };

  // Retry current word
  const handleRetry = () => {
    setAudioBlob(null);
    setAttemptResult(null);
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

  if (words.length === 0) {
    return (
      <div className="min-h-screen bg-white pb-20 md:pb-0">
        <div className="h-6"></div>
        <Header title="Pronunciation Practice" />
        <div className="max-w-md mx-auto px-4 py-8 md:max-w-2xl md:px-8">
          <Card className="p-8 text-center">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No words available</h3>
            <p className="text-gray-500 text-sm mb-4">
              This problem doesn't have any words to practice yet.
            </p>
            <Link href="/account/practice/pronunciation">
              <Button variant="outline">Back to Problems</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const wordProgress = progress?.wordProgress?.get(currentWord._id.toString());
  const isPassed = wordProgress?.passed || attemptResult?.passed;
  const canProceed = isPassed && attemptResult !== null;

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header title={problem.title} showBack />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        {/* Progress Bar */}
        {progress && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>
                Word {currentWordIndex + 1} of {words.length}
              </span>
              <span>
                {progress.completedWords} / {progress.totalWords} completed
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${((currentWordIndex + 1) / words.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Problem Info */}
        <Card className="mb-6 bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(problem.difficulty)}`}>
                {problem.difficulty}
              </span>
              {problem.phonemes && problem.phonemes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {problem.phonemes.map((phoneme: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-white text-gray-700 rounded text-xs font-mono"
                    >
                      /{phoneme}/
                    </span>
                  ))}
                </div>
              )}
            </div>
            {problem.description && (
              <p className="text-sm text-gray-700">{problem.description}</p>
            )}
          </div>
        </Card>

        {/* Current Word */}
        <Card className="mb-6">
          <div className="p-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              {currentWord.word}
            </h2>
            <p className="text-xl md:text-2xl text-gray-600 font-mono mb-4">
              {currentWord.ipa}
            </p>

            {/* Phonemes */}
            {currentWord.phonemes && currentWord.phonemes.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {currentWord.phonemes.map((phoneme: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                  >
                    {phoneme}
                  </span>
                ))}
              </div>
            )}

            {/* Audio Playback */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <Button
                variant="outline"
                size="lg"
                onClick={isPlayingAudio || isPlayingTTS ? handleStopAudio : handlePlayWordAudio}
                disabled={isGeneratingTTS}
              >
                {isGeneratingTTS ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isPlayingAudio || isPlayingTTS ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                <span className="ml-2">
                  {isGeneratingTTS ? "Generating..." : isPlayingAudio || isPlayingTTS ? "Pause" : "Listen"}
                </span>
              </Button>
            </div>

            {/* Word Progress Info */}
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
          </div>
        </Card>

        {/* Recording Section */}
        {!attemptResult && (
          <Card className="mb-6">
            <div className="p-6 text-center">
              {!audioBlob && !isRecording && (
                <div className="space-y-4">
                  <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                    <Mic className="w-12 h-12 text-gray-400" />
                  </div>
                  <p className="text-gray-600">Click the button below to record your pronunciation</p>
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={startRecording}
                  >
                    <Mic className="w-5 h-5 mr-2" />
                    Start Recording
                  </Button>
                </div>
              )}

              {isRecording && (
                <div className="space-y-4">
                  <div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                    <Mic className="w-12 h-12 text-red-600" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900">Recording...</p>
                  <p className="text-sm text-gray-600">Speak clearly into your microphone</p>
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={stopRecording}
                  >
                    <Pause className="w-5 h-5 mr-2" />
                    Stop Recording
                  </Button>
                </div>
              )}

              {audioBlob && !isRecording && !isAnalyzing && (
                <div className="space-y-4">
                  <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-12 h-12 text-green-600" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900">Recording Complete</p>
                  <audio controls className="w-full" src={URL.createObjectURL(audioBlob)} />
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      fullWidth
                      onClick={handleRetry}
                    >
                      <RotateCcw className="w-5 h-5 mr-2" />
                      Retry
                    </Button>
                    <Button
                      variant="primary"
                      size="lg"
                      fullWidth
                      onClick={submitAttempt}
                    >
                      Submit
                    </Button>
                  </div>
                </div>
              )}

              {isAnalyzing && (
                <div className="space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600" />
                  <p className="text-lg font-semibold text-gray-900">Analyzing your pronunciation...</p>
                  <p className="text-sm text-gray-600">This may take a few seconds</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Attempt Result */}
        {attemptResult && (
          <Card className={`mb-6 ${attemptResult.passed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <div className="p-6">
              <div className="text-center mb-4">
                {attemptResult.passed ? (
                  <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-2" />
                ) : (
                  <XCircle className="w-16 h-16 text-red-600 mx-auto mb-2" />
                )}
                <h3 className={`text-2xl font-bold mb-2 ${attemptResult.passed ? "text-green-900" : "text-red-900"}`}>
                  {attemptResult.passed ? "Great Job!" : "Keep Practicing"}
                </h3>
                <p className="text-3xl font-bold mb-2">
                  Score: {attemptResult.textScore.toFixed(0)}%
                </p>
                {attemptResult.fluencyScore && (
                  <p className="text-sm text-gray-600">
                    Fluency: {attemptResult.fluencyScore.toFixed(0)}%
                  </p>
                )}
              </div>

              {/* Feedback */}
              {attemptResult.textFeedback && (
                <div className="mb-4 p-4 bg-white rounded-lg">
                  <p className="text-sm text-gray-700">{attemptResult.textFeedback}</p>
                </div>
              )}

              {/* Weak Phonemes */}
              {attemptResult.incorrectPhonemes && attemptResult.incorrectPhonemes.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Areas to improve:</p>
                  <div className="flex flex-wrap gap-2">
                    {attemptResult.incorrectPhonemes.map((phoneme, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                      >
                        {phoneme}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                {!attemptResult.passed && (
                  <Button
                    variant="outline"
                    size="lg"
                    fullWidth
                    onClick={handleRetry}
                  >
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Try Again
                  </Button>
                )}
                {attemptResult.passed && (
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleNextWord}
                  >
                    Next Word
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Navigation */}
        {!attemptResult && (
          <div className="flex gap-3">
            {currentWordIndex > 0 && (
              <Button
                variant="outline"
                size="lg"
                fullWidth
                onClick={() => {
                  setCurrentWordIndex(currentWordIndex - 1);
                  setAudioBlob(null);
                  setAttemptResult(null);
                }}
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Previous
              </Button>
            )}
            <Link href="/account/practice/pronunciation" className="flex-1">
              <Button variant="outline" size="lg" fullWidth>
                Back to Problems
              </Button>
            </Link>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

