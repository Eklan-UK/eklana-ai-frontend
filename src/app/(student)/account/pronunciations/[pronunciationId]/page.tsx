"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
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
} from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import { pronunciationAPI } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";

interface PronunciationAttempt {
  textScore: number;
  passed: boolean;
  wordScores: Array<{ word: string; score: number }>;
  incorrectLetters?: string[];
  incorrectPhonemes?: string[];
  textFeedback?: string;
  wordFeedback?: Array<{ word: string; feedback: string }>;
}

export default function PronunciationPracticePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pronunciationId = params.pronunciationId as string;
  const assignmentId = searchParams.get("assignmentId") || "";

  const [pronunciation, setPronunciation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [attemptResult, setAttemptResult] = useState<PronunciationAttempt | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [assignment, setAssignment] = useState<any>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // TTS hook for pronunciation audio
  const { playAudio: playTTS, isGenerating: isGeneratingTTS, isPlaying: isPlayingTTS, stopAudio: stopTTS } = useTTS({
    autoPlay: false,
  });

  // Load pronunciation data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load pronunciation
        const pronunciationResponse = await pronunciationAPI.getLearnerPronunciations();
        const pronunciations = pronunciationResponse.data?.pronunciations || [];
        const found = pronunciations.find(
          (p: any) => p.pronunciation?._id === pronunciationId || p.pronunciation?._id?.toString() === pronunciationId
        );
        
        if (found) {
          setPronunciation(found.pronunciation);
          setAssignment(found);
        } else {
          toast.error("Pronunciation not found");
          router.push("/account/pronunciations");
          return;
        }

        // Load attempts if assignmentId is provided
        if (assignmentId) {
          try {
            const attemptsData = await pronunciationAPI.getAttempts(pronunciationId);
            setAttempts(attemptsData.data?.attempts || []);
            setAssignment(attemptsData.data?.assignment || found);
          } catch (error) {
            console.error("Failed to load attempts:", error);
          }
        }
      } catch (error: any) {
        toast.error("Failed to load pronunciation: " + error.message);
        router.push("/account/pronunciations");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [pronunciationId, assignmentId, router]);

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

  // Play pronunciation audio (TTS or uploaded)
  const handlePlayPronunciation = () => {
    if (!pronunciation) return;

    if (pronunciation.audioUrl) {
      // Use uploaded audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(pronunciation.audioUrl);
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
      playTTS(pronunciation.text);
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
    if (!audioBlob || !pronunciation) {
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
          const base64Audio = (reader.result as string).split(",")[1];

          // Submit attempt
          const result = await pronunciationAPI.submitAttempt(pronunciationId, {
            assignmentId: assignmentId || undefined,
            audioBase64: base64Audio,
            passingThreshold: 70,
          });
          const attemptData = result.data?.attempt;

          setAttemptResult({
            textScore: attemptData.textScore,
            passed: attemptData.passed,
            wordScores: attemptData.wordScores || [],
            incorrectLetters: attemptData.incorrectLetters || [],
            incorrectPhonemes: attemptData.incorrectPhonemes || [],
            textFeedback: attemptData.textFeedback,
            wordFeedback: attemptData.wordFeedback || [],
          });

          // Update assignment status
          if (result.data?.assignment) {
            setAssignment(result.data.assignment);
          }

          // Reload attempts
          if (assignmentId) {
            try {
              const attemptsData = await pronunciationAPI.getAttempts(pronunciationId);
              setAttempts(attemptsData.data?.attempts || []);
            } catch (error) {
              console.error("Failed to reload attempts:", error);
            }
          }

          if (attemptData.passed) {
            toast.success(`Great! You passed with a score of ${attemptData.textScore}%`);
          } else {
            toast.warning(`Score: ${attemptData.textScore}%. Keep practicing!`);
          }
        } catch (error: any) {
          toast.error("Failed to submit attempt: " + error.message);
        } finally {
          setIsAnalyzing(false);
        }
      };

      reader.readAsDataURL(audioBlob);
    } catch (error: any) {
      toast.error("Failed to process audio: " + error.message);
      setIsAnalyzing(false);
    }
  };

  // Retry pronunciation
  const handleRetry = () => {
    setAttemptResult(null);
    setAudioBlob(null);
    audioChunksRef.current = [];
  };

  // Check if pronunciation is completed
  const isCompleted = assignment?.status === "completed";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!pronunciation) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6"></div>
      <Header title="Practice Pronunciation" />

      <div className="max-w-4xl mx-auto px-4 py-6 md:px-8">
        <Link href="/account/pronunciations">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Pronunciations
          </Button>
        </Link>

        {/* Pronunciation Card */}
        <Card className="p-8 mb-6">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {pronunciation.title}
            </h1>
            {pronunciation.phonetic && (
              <p className="text-lg text-gray-600 mb-4">{pronunciation.phonetic}</p>
            )}
            <p className="text-2xl text-gray-800 font-medium">{pronunciation.text}</p>
            {pronunciation.description && (
              <p className="text-sm text-gray-500 mt-2">{pronunciation.description}</p>
            )}
          </div>

          {/* Audio Controls */}
          <div className="flex items-center justify-center gap-4 mb-6">
            {isPlayingAudio || isPlayingTTS ? (
              <Button onClick={handleStopAudio} variant="outline">
                <Pause className="w-4 h-4 mr-2" />
                Stop
              </Button>
            ) : (
              <Button onClick={handlePlayPronunciation} variant="outline" disabled={isGeneratingTTS}>
                {isGeneratingTTS ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 mr-2" />
                    {pronunciation.audioUrl ? "Play Audio" : "Play TTS"}
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={handlePlayPronunciation}
              variant="outline"
              disabled={isGeneratingTTS}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Replay
            </Button>
          </div>

          {/* Status Badge */}
          {isCompleted && (
            <div className="text-center mb-4">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <CheckCircle className="w-4 h-4" />
                Completed
              </span>
            </div>
          )}
        </Card>

        {/* Recording Section */}
        {!isCompleted && (
          <Card className="p-8 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Record Your Pronunciation</h2>

            <div className="flex flex-col items-center gap-4">
              {!audioBlob && !isRecording && (
                <Button
                  onClick={startRecording}
                  size="lg"
                  className="w-full max-w-md"
                  variant="primary"
                >
                  <Mic className="w-5 h-5 mr-2" />
                  Start Recording
                </Button>
              )}

              {isRecording && (
                <div className="w-full max-w-md">
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="flex items-center gap-2 text-red-600">
                      <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                      <span className="font-medium">Recording...</span>
                    </div>
                  </div>
                  <Button
                    onClick={stopRecording}
                    size="lg"
                    className="w-full bg-red-600 text-white hover:bg-red-700 border-red-600"
                    variant="outline"
                  >
                    <Pause className="w-5 h-5 mr-2" />
                    Stop Recording
                  </Button>
                </div>
              )}

              {audioBlob && !isRecording && !attemptResult && (
                <div className="w-full max-w-md space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">Recording complete</p>
                    <audio controls className="w-full" src={URL.createObjectURL(audioBlob)}>
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                  <div className="flex gap-4">
                    <Button onClick={handleRetry} variant="outline" className="flex-1">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                    <Button
                      onClick={submitAttempt}
                      disabled={isAnalyzing}
                      className="flex-1"
                      variant="primary"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Submit
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Attempt Result */}
        {attemptResult && (
          <Card className="p-8 mb-6">
            <div className="text-center mb-6">
              {attemptResult.passed ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle className="w-16 h-16 text-green-600" />
                  <h2 className="text-2xl font-bold text-green-600">Great Job!</h2>
                  <p className="text-lg text-gray-700">
                    Score: <span className="font-bold">{attemptResult.textScore}%</span>
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <XCircle className="w-16 h-16 text-orange-600" />
                  <h2 className="text-2xl font-bold text-orange-600">Keep Practicing!</h2>
                  <p className="text-lg text-gray-700">
                    Score: <span className="font-bold">{attemptResult.textScore}%</span>
                    {" "}(Need {70}% to pass)
                  </p>
                </div>
              )}
            </div>

            {attemptResult.textFeedback && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-700">{attemptResult.textFeedback}</p>
              </div>
            )}

            {attemptResult.incorrectLetters && attemptResult.incorrectLetters.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Letters to practice:
                </p>
                <div className="flex flex-wrap gap-2">
                  {attemptResult.incorrectLetters.map((letter, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium"
                    >
                      {letter}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {attemptResult.wordScores && attemptResult.wordScores.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Word Scores:</p>
                <div className="space-y-2">
                  {attemptResult.wordScores.map((wordScore, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium">{wordScore.word}</span>
                      <span
                        className={`text-sm font-bold ${
                          wordScore.score >= 70 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {wordScore.score}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!attemptResult.passed && (
              <div className="flex justify-center mt-6">
                <Button onClick={handleRetry} variant="primary" size="lg">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            )}

            {attemptResult.passed && (
              <div className="flex justify-center mt-6">
                <Link href="/account/pronunciations">
                  <Button variant="primary" size="lg">
                    Continue to Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        )}

        {/* Attempts History */}
        {attempts.length > 0 && (
          <Card className="p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Attempt History</h2>
            <div className="space-y-2">
              {attempts.map((attempt: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Attempt #{attempt.attemptNumber}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(attempt.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-lg font-bold ${
                        attempt.passed ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {attempt.textScore}%
                    </span>
                    {attempt.passed ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

