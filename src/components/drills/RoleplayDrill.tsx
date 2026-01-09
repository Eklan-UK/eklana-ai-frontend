"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TTSButton } from "@/components/ui/TTSButton";
import {
  CheckCircle,
  Loader2,
  MessageCircle,
  User,
  Bot,
  Mic,
  Square,
  Volume2,
  Lock,
  RotateCcw,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { drillAPI } from "@/lib/api";
import { useTTS } from "@/hooks/useTTS";
import { trackActivity } from "@/utils/activity-cache";
import { speechaceService, TextScore } from "@/services/speechace.service";
import { DrillCompletionScreen, DrillLayout, DrillProgress, WordAnalytics } from "./shared";

interface RoleplayDrillProps {
  drill: any;
  assignmentId?: string;
}

interface DialogueTurn {
  speaker: string;
  text: string;
  translation?: string;
}

interface TurnProgress {
  passed: boolean;
  score: number | null;
  attempts: number;
}

interface CompletedMessage {
  id: string;
  speaker: string;
  text: string;
  translation?: string;
  score?: number;
  timestamp: Date;
}

const PASS_THRESHOLD = 65;

export default function RoleplayDrill({ drill, assignmentId }: RoleplayDrillProps) {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [completedMessages, setCompletedMessages] = useState<CompletedMessage[]>([]);
  const [turnProgress, setTurnProgress] = useState<Record<number, TurnProgress>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pronunciationScore, setPronunciationScore] = useState<TextScore | null>(null);
  const [waitingForAI, setWaitingForAI] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // TTS for AI characters
  const { playAudio, isGenerating: isTTSGenerating, isPlaying: isTTSPlaying, stopAudio } = useTTS({
    autoPlay: true,
    onPlayEnd: () => {
      setWaitingForAI(false);
      // After AI finishes speaking, move to next turn if it's student's turn
      const nextTurn = dialogue[currentTurnIndex + 1];
      if (nextTurn && nextTurn.speaker === "student") {
        // Ready for student's turn
      }
    },
    onError: () => {
      setWaitingForAI(false);
      toast.error("Failed to play AI audio");
    },
  });

  // Drill data
  const scenes = drill.roleplay_scenes || (drill.roleplay_dialogue ? [{ dialogue: drill.roleplay_dialogue }] : []);
  const currentScene = scenes[currentSceneIndex];
  const dialogue: DialogueTurn[] = currentScene?.dialogue || [];
  const studentCharacter = drill.student_character_name || "You";
  const aiCharacters = drill.ai_character_names || ["AI"];

  const currentTurn = dialogue[currentTurnIndex];
  const isStudentTurn = currentTurn?.speaker === "student";
  const isAITurn = currentTurn && currentTurn.speaker !== "student";
  const currentProgress = turnProgress[currentTurnIndex] || { passed: false, score: null, attempts: 0 };

  // Check if conversation is complete
  const isConversationComplete = currentTurnIndex >= dialogue.length;
  const totalStudentTurns = dialogue.filter(d => d.speaker === "student").length;
  const completedStudentTurns = Object.values(turnProgress).filter(p => p.passed).length;

  // Get speaker display name
  const getSpeakerName = (speaker: string) => {
    if (speaker === "student") return studentCharacter;
    const aiIndex = parseInt(speaker.replace("ai_", "")) || 0;
    return aiCharacters[aiIndex] || "AI";
  };

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [completedMessages, currentTurnIndex]);

  // Auto-play AI turns
  useEffect(() => {
    if (isAITurn && !waitingForAI && !isTTSPlaying && !isTTSGenerating) {
      playAITurn();
    }
  }, [currentTurnIndex, isAITurn, waitingForAI, isTTSPlaying, isTTSGenerating]);

  const playAITurn = useCallback(async () => {
    if (!currentTurn || currentTurn.speaker === "student") return;

    setWaitingForAI(true);
    
    // Add AI message to completed messages
    const aiMessage: CompletedMessage = {
      id: `msg-${Date.now()}`,
      speaker: currentTurn.speaker,
      text: currentTurn.text,
      translation: currentTurn.translation,
      timestamp: new Date(),
    };
    setCompletedMessages(prev => [...prev, aiMessage]);

    // Play TTS
    await playAudio(currentTurn.text);
    
    // Move to next turn after AI finishes
      setTimeout(() => {
      setCurrentTurnIndex(prev => prev + 1);
      setWaitingForAI(false);
    }, 500);
  }, [currentTurn, playAudio]);

  // Recording functions
  const startRecording = async () => {
    if (!isStudentTurn) return;

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
        stream.getTracks().forEach((track) => track.stop());
        await analyzePronunciation(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setPronunciationScore(null);
    } catch (error: any) {
      toast.error("Failed to access microphone: " + error.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const analyzePronunciation = async (audioBlob: Blob) => {
    if (!currentTurn) return;

    setIsAnalyzing(true);
    setPronunciationScore(null);

    try {
      const speechAceResponse = await speechaceService.scorePronunciation(
        currentTurn.text,
        audioBlob
      );

      const result = speechAceResponse.data as any;
      let textScore: TextScore | null = null;

      if (result?.textScore && typeof result.textScore === "object") {
        textScore = result.textScore as TextScore;
      } else if (result?.text_score && typeof result.text_score === "object") {
        textScore = result.text_score as TextScore;
      } else if (result?.data?.text_score) {
        textScore = result.data.text_score as TextScore;
      }

      if (textScore) {
        setPronunciationScore(textScore);
        const score = textScore.speechace_score.pronunciation;
        const passed = score >= PASS_THRESHOLD;

        // Update turn progress
        setTurnProgress(prev => ({
          ...prev,
          [currentTurnIndex]: {
            passed,
            score,
            attempts: (prev[currentTurnIndex]?.attempts || 0) + 1,
          },
        }));

        if (passed) {
          toast.success(`Great! You scored ${score.toFixed(0)}% - Line passed!`);
    } else {
          toast.warning(
            `Score: ${score.toFixed(0)}%. You need at least ${PASS_THRESHOLD}% to continue. Try again!`
          );
        }
      } else {
        throw new Error("Invalid response from SpeechAce");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to analyze pronunciation");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleContinue = () => {
    if (!currentProgress.passed) {
      toast.error(`You need at least ${PASS_THRESHOLD}% to continue`);
      return;
    }

    // Add student message to completed messages
    const studentMessage: CompletedMessage = {
      id: `msg-${Date.now()}`,
      speaker: "student",
      text: currentTurn.text,
      translation: currentTurn.translation,
      score: currentProgress.score || 0,
      timestamp: new Date(),
    };
    setCompletedMessages(prev => [...prev, studentMessage]);

    // Move to next turn
    setCurrentTurnIndex(prev => prev + 1);
    setPronunciationScore(null);
  };

  const handleTryAgain = () => {
    setPronunciationScore(null);
  };

  const handleSubmit = async () => {
    if (!assignmentId) {
      toast.error("Assignment ID is missing. Cannot submit drill.");
      return;
    }

    setIsSubmitting(true);
    try {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      
      // Calculate average score from all student turns
      const studentScores = Object.values(turnProgress).filter(p => p.score !== null);
      const avgScore = studentScores.length > 0
        ? Math.round(studentScores.reduce((sum, p) => sum + (p.score || 0), 0) / studentScores.length)
        : 0;

      await drillAPI.complete(drill._id, {
        drillAssignmentId: assignmentId,
        score: avgScore,
        timeSpent,
        roleplayResults: {
          sceneScores: [{
            sceneName: currentScene?.scene_name || "Scene 1",
            score: avgScore,
            fluencyScore: avgScore,
            pronunciationScore: avgScore,
          }],
        },
        platform: "web",
      });

      setIsCompleted(true);
      toast.success("Drill completed! Great job!");

      // Track activity locally (no API call)
      trackActivity("drill", drill._id, "completed", {
        title: drill.title,
        type: drill.type,
        score: avgScore,
      });
    } catch (error: any) {
      toast.error("Failed to submit drill: " + (error.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleted) {
    return <DrillCompletionScreen drillType="roleplay" />;
  }

  return (
    <DrillLayout title={drill.title}>
      {/* Progress */}
      <DrillProgress
        current={completedStudentTurns}
        total={totalStudentTurns}
        label="Your lines"
      />

        {/* Context */}
        {drill.context && (
        <Card className="mb-4 bg-emerald-50 border-emerald-200">
            <div className="flex items-start gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
              <p className="text-sm font-semibold text-emerald-900 mb-1">Scenario</p>
              <p className="text-sm text-emerald-800">{drill.context}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Scene Info */}
        {currentScene?.scene_name && (
        <Card className="mb-4 bg-white/80">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Current Scene</p>
                <p className="text-sm font-semibold text-gray-900">{currentScene.scene_name}</p>
              </div>
            {scenes.length > 1 && (
              <div className="text-xs text-gray-500">
                Scene {currentSceneIndex + 1} of {scenes.length}
              </div>
            )}
            </div>
          </Card>
        )}

      {/* Conversation History */}
      <Card className="mb-4 max-h-64 overflow-y-auto">
        <div className="space-y-3">
          {completedMessages.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>Conversation will appear here</p>
              </div>
            ) : (
            completedMessages.map((message) => {
                const isUser = message.speaker === "student";
                return (
                  <div
                    key={message.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                    className={`max-w-[85%] rounded-2xl p-3 ${
                        isUser
                          ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {isUser ? (
                        <User className="w-3 h-3" />
                        ) : (
                        <Bot className="w-3 h-3" />
                        )}
                        <span className="text-xs font-semibold opacity-90">
                          {getSpeakerName(message.speaker)}
                      </span>
                      {isUser && message.score !== undefined && (
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                          {message.score}%
                        </span>
                      )}
                      </div>
                      <p className="text-sm">{message.text}</p>
                      {message.translation && (
                      <p className={`text-xs mt-1 opacity-75`}>
                          {message.translation}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </Card>

      {/* Current Turn Interface */}
      {!isConversationComplete && currentTurn && (
        <Card className="mb-4">
          {/* AI Turn - Show loading/playing state */}
          {isAITurn && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
                {isTTSGenerating ? (
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                ) : isTTSPlaying ? (
                  <Volume2 className="w-10 h-10 text-blue-600 animate-pulse" />
                ) : (
                  <Bot className="w-10 h-10 text-blue-600" />
                )}
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-2">
                {getSpeakerName(currentTurn.speaker)} is speaking...
              </p>
              <div className="bg-blue-50 rounded-xl p-4 max-w-md mx-auto">
                <p className="text-gray-900">{currentTurn.text}</p>
                {currentTurn.translation && (
                  <p className="text-sm text-gray-500 mt-2 italic">{currentTurn.translation}</p>
                )}
              </div>
            </div>
          )}

          {/* Student Turn - Recording Interface */}
          {isStudentTurn && (
            <div className="py-6">
              {/* Character Label */}
              <div className="text-center mb-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                  <User className="w-4 h-4" />
                  Your turn as {studentCharacter}
                </div>
              </div>

              {/* Text to Speak */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Say this line:</p>
                  <TTSButton text={currentTurn.text} size="sm" />
                </div>
                <p className="text-xl font-semibold text-gray-900 text-center">
                  "{currentTurn.text}"
                </p>
                {currentTurn.translation && (
                  <p className="text-sm text-gray-500 text-center mt-2 italic">
                    {currentTurn.translation}
                  </p>
                )}
              </div>

              {/* Recording Button */}
              <div className="flex flex-col items-center mb-6">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isAnalyzing || currentProgress.passed}
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${
                    currentProgress.passed
                      ? "bg-green-500 cursor-default"
                      : isRecording
                      ? "bg-red-500 hover:bg-red-600 animate-pulse"
                      : isAnalyzing
                      ? "bg-gray-300 cursor-not-allowed"
                      : "bg-blue-500 hover:bg-blue-600"
                  }`}
                >
                  {currentProgress.passed ? (
                    <CheckCircle className="w-12 h-12 text-white" />
                  ) : isRecording ? (
                    <Square className="w-10 h-10 text-white" />
                  ) : isAnalyzing ? (
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                  ) : (
                    <Mic className="w-12 h-12 text-white" />
                  )}
                </button>
                
                <p className="text-sm text-gray-600 mt-3 text-center">
                  {currentProgress.passed ? (
                    <span className="text-green-600 font-medium">Line passed! ✓</span>
                  ) : isRecording ? (
                    <span className="text-red-600 font-medium">Recording... Tap to stop</span>
                  ) : isAnalyzing ? (
                    <span className="text-blue-600">Analyzing your pronunciation...</span>
                  ) : (
                    <span>Tap to record your line</span>
                  )}
                </p>
                
                {currentProgress.attempts > 0 && !currentProgress.passed && (
                  <p className="text-xs text-gray-500 mt-1">
                    Attempt {currentProgress.attempts} • Need {PASS_THRESHOLD}%+ to pass
                  </p>
                )}
              </div>

              {/* Score Display */}
              {pronunciationScore && !currentProgress.passed && (
                <div className={`rounded-xl p-4 mb-4 ${
                  (pronunciationScore.speechace_score.pronunciation || 0) >= PASS_THRESHOLD
                    ? "bg-green-50 border border-green-200"
                    : "bg-amber-50 border border-amber-200"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Your Score</span>
                    <span className={`text-2xl font-bold ${
                      (pronunciationScore.speechace_score.pronunciation || 0) >= PASS_THRESHOLD
                        ? "text-green-600"
                        : "text-amber-600"
                    }`}>
                      {pronunciationScore.speechace_score.pronunciation.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        (pronunciationScore.speechace_score.pronunciation || 0) >= PASS_THRESHOLD
                          ? "bg-green-500"
                          : "bg-amber-500"
                      }`}
                      style={{ width: `${pronunciationScore.speechace_score.pronunciation}%` }}
                    />
                  </div>
                  {(pronunciationScore.speechace_score.pronunciation || 0) < PASS_THRESHOLD && (
                    <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      You need {PASS_THRESHOLD}% or higher to continue
                    </p>
                  )}
                </div>
              )}

              {/* Word Analytics */}
              {pronunciationScore && (
                <WordAnalytics pronunciationScore={pronunciationScore} />
              )}
            </div>
          )}
        </Card>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Student turn actions */}
        {isStudentTurn && !isConversationComplete && (
          <>
            {currentProgress.passed ? (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleContinue}
              >
                <ChevronRight className="w-5 h-5 mr-2" />
                Continue
              </Button>
            ) : pronunciationScore ? (
              <Button
                variant="outline"
                size="lg"
                fullWidth
                onClick={handleTryAgain}
                disabled={isRecording || isAnalyzing}
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Try Again
              </Button>
            ) : null}
          </>
        )}
          
        {/* Conversation complete - Submit */}
        {isConversationComplete && (
          <Card className="mb-4 bg-green-50 border-green-200">
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Conversation Complete!
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Great job completing all your lines. Submit to finish the drill.
              </p>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Complete Drill"
                )}
              </Button>
            </div>
          </Card>
          )}
      </div>
    </DrillLayout>
  );
}
