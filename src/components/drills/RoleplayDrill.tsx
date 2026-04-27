"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  RotateCcw,
  ChevronRight,
  AlertCircle,
  PartyPopper,
  ArrowLeftRight,
} from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { drillAPI, pronunciationAPI } from "@/lib/api";
import { useTTS } from "@/hooks/useTTS";
import { trackActivity } from "@/utils/activity-cache";
import { speechaceService, TextScore } from "@/services/speechace.service";
import { DrillCompletionScreen, DrillLayout, DrillProgress, WordAnalytics } from "./shared";
import { BookmarkButton } from "@/components/common/BookmarkButton";

interface RoleplayDrillProps {
  drill: any;
  assignmentId?: string;
}

interface DialogueTurn {
  speaker: string;
  text: string;
  translation?: string;
  audioUrl?: string;
}

interface TurnProgress {
  passed: boolean;
  score: number | null;
  attempts: number;
}

// Analytics collected silently during the session
interface TurnAnalytics {
  sceneIndex: number;
  turnIndex: number;
  text: string;
  score: number;
  textScore: TextScore | null;
  attempts: number;
  timestamp: Date;
}

type TurnProgressMap = Record<string, TurnProgress>;

function makeTurnKey(sceneIndex: number, turnIndex: number): string {
  return `${sceneIndex}-${turnIndex}`;
}

function isStudentLine(turn: DialogueTurn | undefined, roleMode: "original" | "swapped"): boolean {
  if (!turn) return false;
  return roleMode === "original" ? turn.speaker === "student" : turn.speaker !== "student";
}

function countStudentLinesInDialogue(dialogue: DialogueTurn[], roleMode: "original" | "swapped"): number {
  return dialogue.filter((t) => isStudentLine(t, roleMode)).length;
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

// Trigger confetti celebration
const triggerConfetti = () => {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#22c55e', '#16a34a', '#4ade80', '#86efac'],
  });
};

export default function RoleplayDrill({ drill, assignmentId }: RoleplayDrillProps) {
  const router = useRouter();
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [completedMessages, setCompletedMessages] = useState<CompletedMessage[]>([]);
  const [turnProgress, setTurnProgress] = useState<TurnProgressMap>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());

  // Track if we're on review screen vs completion screen
  const [showReview, setShowReview] = useState(false);

  // Role switching: allows student to practice as different character
  // "original" = student speaks student lines, AI speaks AI lines
  // "swapped" = student speaks AI lines, AI speaks student lines
  const [roleMode, setRoleMode] = useState<"original" | "swapped">("original");
  const [hasCompletedRound, setHasCompletedRound] = useState(false);
  const [showRoleSwitchOption, setShowRoleSwitchOption] = useState(false);

  // Track progress for each role mode separately
  const [originalRoleProgress, setOriginalRoleProgress] = useState<TurnProgressMap>({});
  const [swappedRoleProgress, setSwappedRoleProgress] = useState<TurnProgressMap>({});

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pronunciationScore, setPronunciationScore] = useState<TextScore | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const MAX_RECORDING_SECONDS = 120;
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);

  // AI turn state - use ref for synchronous tracking to prevent double-play
  const playedAITurnsRef = useRef<Set<string>>(new Set());
  const [isPlayingAI, setIsPlayingAI] = useState(false);

  // Silent analytics collection during the session
  const [sessionAnalytics, setSessionAnalytics] = useState<TurnAnalytics[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Audio player ref for pre-generated audio
  const preGenAudioRef = useRef<HTMLAudioElement | null>(null);

  // TTS for AI characters (fallback if no pre-generated audio)
  const {
    playAudio: playTTSAudio,
    isGenerating: isTTSGenerating,
    isPlaying: isTTSPlaying,
    stopAudio: stopTTSAudio
  } = useTTS({
    autoPlay: false,
  });

  // Drill data — memoize so scene-advance effects do not re-fire every render in legacy single-scene path
  const scenes = useMemo(
    () =>
      drill.roleplay_scenes || (drill.roleplay_dialogue ? [{ dialogue: drill.roleplay_dialogue }] : []),
    [drill.roleplay_scenes, drill.roleplay_dialogue],
  );
  const currentScene = scenes[currentSceneIndex];
  const dialogue: DialogueTurn[] = currentScene?.dialogue || [];
  const studentCharacter = drill.student_character_name || "You";
  const aiCharacters = drill.ai_character_names || ["AI"];

  const currentTurn = dialogue[currentTurnIndex];

  // In swapped mode, roles are reversed:
  // - Original student lines become AI lines (AI speaks them)
  // - Original AI lines become student lines (student speaks them)
  const isStudentTurn = roleMode === "original"
    ? currentTurn?.speaker === "student"
    : currentTurn?.speaker !== "student";
  const isAITurn = roleMode === "original"
    ? currentTurn && currentTurn.speaker !== "student"
    : currentTurn?.speaker === "student";
  const currentTurnKey = makeTurnKey(currentSceneIndex, currentTurnIndex);
  const currentProgress = turnProgress[currentTurnKey] || { passed: false, score: null, attempts: 0 };

  /** All scenes finished (past last line of the last non-empty flow). */
  const isEntireDrillComplete = useMemo(() => {
    if (scenes.length === 0) return true;
    const d = currentScene?.dialogue || [];
    if (d.length === 0) {
      return currentSceneIndex >= scenes.length - 1;
    }
    return currentSceneIndex >= scenes.length - 1 && currentTurnIndex >= d.length;
  }, [scenes, currentSceneIndex, currentScene, currentTurnIndex]);

  const totalStudentTurns = useMemo(
    () =>
      scenes.reduce(
        (sum: number, sc: { dialogue?: DialogueTurn[] }) =>
          sum + countStudentLinesInDialogue(sc?.dialogue || [], roleMode),
        0,
      ),
    [scenes, roleMode],
  );

  const completedStudentTurns = useMemo(() => {
    let n = 0;
    for (const [key, p] of Object.entries(turnProgress)) {
      if (!p.passed) continue;
      const [si, ti] = key.split("-").map(Number);
      const t = (scenes[si]?.dialogue || [])[ti];
      if (t && isStudentLine(t, roleMode)) n += 1;
    }
    return n;
  }, [turnProgress, scenes, roleMode]);

  // Get character name for the role the student is currently playing
  const currentStudentRole = roleMode === "original"
    ? studentCharacter
    : aiCharacters[0] || "AI";
  const currentAIRole = roleMode === "original"
    ? aiCharacters[0] || "AI"
    : studentCharacter;

  // Get speaker display name
  const getSpeakerName = (speaker: string) => {
    if (speaker === "student") return studentCharacter;
    const aiIndex = parseInt(speaker.replace("ai_", "")) || 0;
    return aiCharacters[aiIndex] || "AI";
  };

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [completedMessages, currentTurnIndex, currentSceneIndex]);

  // Move to next turn after AI finishes
  const moveToNextTurn = useCallback(() => {
    setIsPlayingAI(false);
    setCurrentTurnIndex(prev => prev + 1);
  }, []);

  // Play AI turn - only called once per turn
  const playAITurn = useCallback(async (turn: DialogueTurn, turnIndex: number) => {
    const turnKey = makeTurnKey(currentSceneIndex, turnIndex);
    if (playedAITurnsRef.current.has(turnKey)) {
      return; // Already played, skip
    }
    playedAITurnsRef.current.add(turnKey);
    setIsPlayingAI(true);

    // Add AI message to completed messages
    const aiMessage: CompletedMessage = {
      id: `msg-${Date.now()}-${turnKey}`,
      speaker: turn.speaker,
      text: turn.text,
      translation: turn.translation,
      timestamp: new Date(),
    };
    setCompletedMessages(prev => [...prev, aiMessage]);

    // Play audio
    const audioUrl = turn.audioUrl;

    if (audioUrl) {
      // Play from pre-generated URL
      if (preGenAudioRef.current) {
        preGenAudioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      preGenAudioRef.current = audio;

      audio.onended = () => {
        setTimeout(moveToNextTurn, 300);
      };
      audio.onerror = async () => {
        console.warn("Pre-generated audio failed, falling back to TTS");
        try {
          await playTTSAudio(turn.text);
          setTimeout(moveToNextTurn, 500);
        } catch {
          moveToNextTurn();
        }
      };

      try {
        await audio.play();
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error("Error playing pre-generated audio:", err);
        }
        try {
          await playTTSAudio(turn.text);
          setTimeout(moveToNextTurn, 500);
        } catch {
          moveToNextTurn();
        }
      }
    } else {
      // Use TTS generation
      try {
        await playTTSAudio(turn.text);
        // After TTS finishes, move to next turn
        setTimeout(moveToNextTurn, 500);
      } catch (error) {
        console.error("TTS failed:", error);
        toast.error("Failed to play AI audio");
        moveToNextTurn();
      }
    }
  }, [playTTSAudio, moveToNextTurn, currentSceneIndex]);

  // Auto-play AI turns - only if not already played
  useEffect(() => {
    if (
      isAITurn &&
      currentTurn &&
      !playedAITurnsRef.current.has(makeTurnKey(currentSceneIndex, currentTurnIndex)) &&
      !isPlayingAI &&
      !isTTSGenerating &&
      !isTTSPlaying
    ) {
      playAITurn(currentTurn, currentTurnIndex);
    }
  }, [currentSceneIndex, currentTurnIndex, currentTurn, isAITurn, isPlayingAI, isTTSGenerating, isTTSPlaying, playAITurn]);

  // Skip scenes with no dialogue
  useEffect(() => {
    if (isCompleted) return;
    if (!scenes.length) return;
    const d = scenes[currentSceneIndex]?.dialogue || [];
    if (d.length > 0) return;
    if (currentSceneIndex < scenes.length - 1) {
      setCurrentSceneIndex((i) => i + 1);
      setCurrentTurnIndex(0);
      setCompletedMessages([]);
      setPronunciationScore(null);
    }
  }, [currentSceneIndex, scenes, isCompleted]);

  // After a scene ends, advance to the next (multi-scene)
  useEffect(() => {
    if (isCompleted) return;
    if (showReview) return;
    if (!scenes.length) return;
    const d = scenes[currentSceneIndex]?.dialogue || [];
    if (d.length === 0) return;
    if (currentTurnIndex < d.length) return;
    if (currentSceneIndex < scenes.length - 1) {
      const next = currentSceneIndex + 1;
      const nextName = scenes[next]?.scene_name || `Scene ${next + 1}`;
      setCurrentSceneIndex(next);
      setCurrentTurnIndex(0);
      setCompletedMessages([]);
      setPronunciationScore(null);
      toast.success(`Next: ${nextName}`);
    }
  }, [currentSceneIndex, currentTurnIndex, scenes, isCompleted, showReview]);

  const clearRecordingTimers = () => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (autoStopTimerRef.current) { clearTimeout(autoStopTimerRef.current); autoStopTimerRef.current = null; }
  };

  // Recording functions
  const startRecording = async () => {
    if (!isStudentTurn) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 32000,
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
      setRecordingSeconds(0);
      setPronunciationScore(null);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      autoStopTimerRef.current = setTimeout(() => {
        stopRecording();
        toast.info("Recording stopped — 2 minute limit reached.");
      }, MAX_RECORDING_SECONDS * 1000);
    } catch (error: any) {
      toast.error("Failed to access microphone: " + error.message);
    }
  };

  const stopRecording = () => {
    clearRecordingTimers();
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Helper function to convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64 = base64String.includes(',')
          ? base64String.split(',')[1]
          : base64String;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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
        const newAttempts = (turnProgress[currentTurnKey]?.attempts || 0) + 1;

        // Update turn progress
        setTurnProgress((prev) => ({
          ...prev,
          [currentTurnKey]: {
            passed,
            score,
            attempts: newAttempts,
          },
        }));

        // Silently collect analytics for review screen
        setSessionAnalytics((prev) => [
          ...prev,
          {
            sceneIndex: currentSceneIndex,
            turnIndex: currentTurnIndex,
            text: currentTurn.text,
            score,
            textScore,
            attempts: newAttempts,
            timestamp: new Date(),
          },
        ]);

        if (passed) {
          // Trigger confetti celebration
          triggerConfetti();
          toast.success(`Great! You scored ${score.toFixed(0)}% - Line passed!`);
        } else {
          toast.warning(
            `Score: ${score.toFixed(0)}%. You need at least ${PASS_THRESHOLD}% to continue. Try again!`
          );
        }

        // Record pronunciation attempt
        try {
          const audioBase64 = await blobToBase64(audioBlob);
          await pronunciationAPI.createDrillAttempt({
            text: currentTurn.text,
            audioBase64,
            drillId: drill._id,
            drillType: 'roleplay',
            passingThreshold: PASS_THRESHOLD,
          });
        } catch (error) {
          // Log but don't fail the drill if pronunciation recording fails
          console.error('Failed to record pronunciation attempt:', error);
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

  /** Clears scoring UI and unlocks mic so the student can redo the line (before or after passing). */
  const handleRetrySpeaking = () => {
    setPronunciationScore(null);
    setTurnProgress((prev) => ({
      ...prev,
      [currentTurnKey]: {
        passed: false,
        score: null,
        attempts: prev[currentTurnKey]?.attempts ?? 0,
      },
    }));
    setSessionAnalytics((prev) =>
      prev.filter(
        (a) =>
          !(a.sceneIndex === currentSceneIndex && a.turnIndex === currentTurnIndex),
      ),
    );
  };

  /** Same role: restart entire roleplay from scene 1 / first line (after completion screen). */
  const handleRestartDrill = () => {
    setCurrentSceneIndex(0);
    setCurrentTurnIndex(0);
    setCompletedMessages([]);
    playedAITurnsRef.current = new Set();
    setTurnProgress({});
    setOriginalRoleProgress({});
    setSwappedRoleProgress({});
    setPronunciationScore(null);
    setSessionAnalytics([]);
    setShowRoleSwitchOption(false);
    setHasCompletedRound(false);
    setShowReview(false);
    setIsPlayingAI(false);
    stopTTSAudio();
    if (preGenAudioRef.current) {
      preGenAudioRef.current.pause();
      preGenAudioRef.current = null;
    }
    toast.success(`Starting over from the beginning as ${currentStudentRole}.`);
  };

  const retrySpeakingButtonClass =
    "w-full bg-white border-2 border-[#3B883E] text-[#3B883E] hover:bg-emerald-50/80 font-semibold text-base py-3.5 rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2";

  // Switch roles - student becomes AI character and vice versa
  const handleSwitchRoles = () => {
    // Save current progress to the appropriate role progress state
    if (roleMode === "original") {
      setOriginalRoleProgress(turnProgress);
    } else {
      setSwappedRoleProgress(turnProgress);
    }

    // Toggle role mode
    const newMode = roleMode === "original" ? "swapped" : "original";
    setRoleMode(newMode);

    // Reset for new round (all scenes, composite turn keys)
    setCurrentSceneIndex(0);
    setCurrentTurnIndex(0);
    setCompletedMessages([]);
    playedAITurnsRef.current = new Set();
    setPronunciationScore(null);
    setShowRoleSwitchOption(false);

    // Load progress for the new role (if any previous progress exists)
    const savedProgress = newMode === "original" ? originalRoleProgress : swappedRoleProgress;
    setTurnProgress(savedProgress);

    // Clear session analytics for fresh round
    setSessionAnalytics([]);

    toast.success(`Switched roles! You are now playing as ${newMode === "original" ? studentCharacter : aiCharacters[0] || "AI"}`);
  };

  // Go to review screen instead of completing immediately
  const handleShowReview = () => {
    setShowReview(true);
  };

  // Show role switch option when the full multi-scene drill is complete
  useEffect(() => {
    if (isEntireDrillComplete && !showRoleSwitchOption && !showReview && !isCompleted) {
      setHasCompletedRound(true);
      setShowRoleSwitchOption(true);
    }
  }, [isEntireDrillComplete, showRoleSwitchOption, showReview, isCompleted]);

  const handleSubmit = async () => {
    if (!assignmentId) {
      toast.error("Assignment ID is missing. Cannot submit drill.");
      return;
    }

    setIsSubmitting(true);
    try {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

      // Mean of all recorded line scores (same weighting as before, with composite keys)
      const allScores = Object.values(turnProgress)
        .map((p) => p.score)
        .filter((s): s is number => s != null);
      const avgScore = allScores.length > 0
        ? Math.round(allScores.reduce((sum, s) => sum + s, 0) / allScores.length)
        : 0;

      const sceneScores = scenes.map((scene: { scene_name?: string; dialogue?: DialogueTurn[] }, sceneIndex: number) => {
        const d = scene?.dialogue || [];
        const lineScores: number[] = [];
        for (let turnIndex = 0; turnIndex < d.length; turnIndex++) {
          const t = d[turnIndex];
          if (!isStudentLine(t, roleMode)) continue;
          const s = turnProgress[makeTurnKey(sceneIndex, turnIndex)]?.score;
          if (s != null) lineScores.push(s);
        }
        const sceneAvg = lineScores.length > 0
          ? Math.round(lineScores.reduce((a, b) => a + b, 0) / lineScores.length)
          : 0;
        return {
          sceneName: scene.scene_name || `Scene ${sceneIndex + 1}`,
          score: sceneAvg,
          fluencyScore: sceneAvg,
          pronunciationScore: sceneAvg,
        };
      });

      await drillAPI.complete(drill._id, {
        drillAssignmentId: assignmentId,
        score: avgScore,
        timeSpent,
        roleplayResults: {
          sceneScores,
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

      // Refresh the page to update drill status
      router.refresh();
    } catch (error: any) {
      toast.error("Failed to submit drill: " + (error.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cleanup audio and recording timers on unmount
  useEffect(() => {
    return () => {
      clearRecordingTimers();
      if (preGenAudioRef.current) {
        preGenAudioRef.current.pause();
        preGenAudioRef.current = null;
      }
      stopTTSAudio();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopTTSAudio]);

  if (isCompleted) {
    return (
      <DrillCompletionScreen
        drillType="roleplay"
        returnPath="/account/drills"
        returnLabel="Back to My Plan"
        refreshOnMount={true}
      />
    );
  }

  // Review Screen - Shows all analytics collected during the session
  if (showReview) {
    const studentScores = Object.values(turnProgress).filter(p => p.score !== null);
    const avgScore = studentScores.length > 0
      ? Math.round(studentScores.reduce((sum, p) => sum + (p.score || 0), 0) / studentScores.length)
      : 0;
    const totalAttempts = Object.values(turnProgress).reduce((sum, p) => sum + p.attempts, 0);

    return (
      <DrillLayout title="Review Performance" hideNavigation>
        {/* Overall Score */}
        <Card className="mb-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <div className="text-center py-6">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mb-4">
              <span className="text-3xl font-bold text-white">{avgScore}%</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Overall Score</h2>
            <p className="text-sm text-gray-600">
              {completedStudentTurns} lines completed • {totalAttempts} total attempts
            </p>
          </div>
        </Card>

        {/* Per-Turn Analytics */}
        <h3 className="text-lg font-bold text-gray-900 mb-4">Line-by-Line Analysis</h3>
        <div className="space-y-4 mb-6">
          {sessionAnalytics
            .filter((a, index, arr) =>
              arr.findIndex(
                (b) =>
                  b.sceneIndex === a.sceneIndex &&
                  b.turnIndex === a.turnIndex &&
                  b.score >= a.score
              ) === index
            )
            .sort((a, b) => a.sceneIndex - b.sceneIndex || a.turnIndex - b.turnIndex)
            .map((analytics, idx) => (
              <Card key={`${analytics.sceneIndex}-${analytics.turnIndex}-${idx}`} className="border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-500 mb-1">
                      {scenes.length > 1
                        ? `Scene ${analytics.sceneIndex + 1} · Line ${analytics.turnIndex + 1}`
                        : `Line ${analytics.turnIndex + 1}`}
                    </p>
                    <p className="text-base text-gray-900">{analytics.text}</p>
                  </div>
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold ${analytics.score >= PASS_THRESHOLD
                      ? "bg-green-100 text-green-600"
                      : "bg-amber-100 text-amber-600"
                    }`}>
                    {analytics.score.toFixed(0)}%
                  </div>
                </div>
                {analytics.textScore && (
                  <WordAnalytics pronunciationScore={analytics.textScore} />
                )}
                <div className="text-xs text-gray-500 mt-2">
                  Attempts: {analytics.attempts}
                </div>
              </Card>
            ))}
        </div>

        {/* Submit Button */}
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
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              Complete Drill
            </>
          )}
        </Button>
      </DrillLayout>
    );
  }

  return (
    <DrillLayout title={drill.title} hideNavigation>
      {/* Role Mode Indicator - only show when in swapped mode */}
      {roleMode === "swapped" && (
        <div className="mb-4 flex items-center justify-center gap-2 px-4 py-2 bg-primary-50 border border-primary-200 rounded-xl">
          <ArrowLeftRight className="w-4 h-4 text-primary-600" />
          <span className="text-sm text-primary-700">
            <strong>Role Swapped:</strong> You're playing as <strong>{currentStudentRole}</strong>
          </span>
        </div>
      )}

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
              // In swapped mode, the "student" speaker messages are actually AI played
              // and non-student speaker messages are what the user spoke
              const isUserMessage = roleMode === "original"
                ? message.speaker === "student"
                : message.speaker !== "student";

              // Get display name based on role mode
              const displayName = roleMode === "original"
                ? getSpeakerName(message.speaker)
                : message.speaker === "student"
                  ? currentAIRole  // AI is now playing original student lines
                  : currentStudentRole; // User is now playing original AI lines

              return (
                <div
                  key={message.id}
                  className={`flex ${isUserMessage ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 ${isUserMessage
                        ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                        : "bg-gray-100 text-gray-900"
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isUserMessage ? (
                        <User className="w-3 h-3" />
                      ) : (
                        <Bot className="w-3 h-3" />
                      )}
                      <span className="text-xs font-semibold opacity-90">
                        {displayName}
                      </span>
                      {isUserMessage && message.score !== undefined && (
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                          {message.score}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm">{message.text}</p>
                    {message.translation && (
                      <p className="text-xs mt-1 opacity-75">
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
      {!isEntireDrillComplete && currentTurn && (
        <Card className="mb-4">
          {/* AI Turn - Show loading/playing state */}
          {isAITurn && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
                {isTTSGenerating ? (
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                ) : isPlayingAI || isTTSPlaying ? (
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
                  Your turn as {currentStudentRole}
                  {roleMode === "swapped" && (
                    <span className="ml-1 px-2 py-0.5 bg-primary-100 text-primary-600 text-xs rounded-full">
                      Switched
                    </span>
                  )}
                </div>
              </div>

              {/* Text to Speak */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Say this line:</p>
                    <TTSButton
                      text={currentTurn.text}
                      size="sm"
                      audioUrl={currentTurn.audioUrl}
                    />
                    <BookmarkButton
                      itemId={currentTurn.text}
                      itemType="sentence"
                      content={currentTurn.text}
                      translation={currentTurn.translation}
                      context={currentScene?.context}
                      sourceDrillId={drill._id}
                      className="ml-1"
                    />
                  </div>
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
                <div className="relative w-24 h-24">
                  {isRecording && (
                    <svg className="absolute inset-0 -rotate-90" viewBox="0 0 96 96">
                      <circle cx="48" cy="48" r="44" fill="none" stroke="#fecaca" strokeWidth="4" />
                      <circle
                        cx="48" cy="48" r="44" fill="none" stroke="#ef4444" strokeWidth="4"
                        strokeDasharray={2 * Math.PI * 44}
                        strokeDashoffset={2 * Math.PI * 44 * (1 - recordingSeconds / MAX_RECORDING_SECONDS)}
                        strokeLinecap="round"
                        className="transition-[stroke-dashoffset] duration-1000 linear"
                      />
                    </svg>
                  )}
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isAnalyzing || currentProgress.passed}
                    className={`absolute inset-0 rounded-full flex items-center justify-center transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${currentProgress.passed
                        ? "bg-green-500 cursor-default"
                        : isRecording
                          ? "bg-red-500 hover:bg-red-600"
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
                </div>

                {isRecording && (
                  <div className="mt-3 bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold inline-block">
                    {MAX_RECORDING_SECONDS - recordingSeconds}s remaining · Tap to stop
                  </div>
                )}

                {!isRecording && (
                  <p className="text-sm text-gray-600 mt-3 text-center">
                    {currentProgress.passed ? (
                      <span className="text-green-600 font-medium">Line passed! ✓</span>
                    ) : isAnalyzing ? (
                      <span className="text-blue-600">Analyzing your pronunciation — longer recordings may take a moment...</span>
                    ) : (
                      <span>Tap to record your line</span>
                    )}
                  </p>
                )}

                {currentProgress.attempts > 0 && !currentProgress.passed && (
                  <p className="text-xs text-gray-500 mt-1">
                    Attempt {currentProgress.attempts} • Need {PASS_THRESHOLD}%+ to pass
                  </p>
                )}
              </div>

              {/* Simple Score Display - Analytics shown on review screen */}
              {pronunciationScore && !currentProgress.passed && (
                <div className={`rounded-xl p-4 mb-4 ${(pronunciationScore.speechace_score.pronunciation || 0) >= PASS_THRESHOLD
                    ? "bg-green-50 border border-green-200"
                    : "bg-amber-50 border border-amber-200"
                  }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Your Score</span>
                    <span className={`text-2xl font-bold ${(pronunciationScore.speechace_score.pronunciation || 0) >= PASS_THRESHOLD
                        ? "text-green-600"
                        : "text-amber-600"
                      }`}>
                      {pronunciationScore.speechace_score.pronunciation.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${(pronunciationScore.speechace_score.pronunciation || 0) >= PASS_THRESHOLD
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

              {/* Confetti celebration shown when passed - no analytics here */}
              {currentProgress.passed && pronunciationScore && (
                <div className="rounded-xl p-4 mb-4 bg-green-50 border border-green-200 text-center">
                  <PartyPopper className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-lg font-bold text-green-700">
                    {pronunciationScore.speechace_score.pronunciation.toFixed(0)}% - Passed!
                  </p>
                  <p className="text-sm text-green-600">Click Continue to proceed</p>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Student turn actions */}
        {isStudentTurn && !isEntireDrillComplete && (
          <>
            {currentProgress.passed ? (
              <div className="space-y-3">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleContinue}
                >
                  <ChevronRight className="w-5 h-5 mr-2" />
                  Continue
                </Button>
                <button
                  type="button"
                  className={retrySpeakingButtonClass}
                  onClick={handleRetrySpeaking}
                  disabled={isRecording || isAnalyzing}
                >
                  <RotateCcw className="w-5 h-5 shrink-0" />
                  Retry speaking
                </button>
                <p className="text-xs text-center text-gray-500 px-2">
                  Redo this line if you want a higher score before moving on.
                </p>
              </div>
            ) : pronunciationScore ? (
              <button
                type="button"
                className={retrySpeakingButtonClass}
                onClick={handleRetrySpeaking}
                disabled={isRecording || isAnalyzing}
              >
                <RotateCcw className="w-5 h-5 shrink-0" />
                Retry speaking
              </button>
            ) : null}
          </>
        )}

        {/* Conversation complete - Show Review and Role Switch options */}
        {isEntireDrillComplete && (
          <Card className="mb-4 bg-green-50 border-green-200">
            <div className="text-center py-4">
              <PartyPopper className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Conversation Complete!
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                Great job completing all your lines as <strong>{currentStudentRole}</strong>!
              </p>

              {/* Role mode indicator */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-full text-sm mb-4">
                <User className="w-4 h-4 text-green-600" />
                <span className="text-gray-600">You played:</span>
                <span className="font-semibold text-gray-900">{currentStudentRole}</span>
              </div>

              <div className="space-y-3">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleShowReview}
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Review Performance
                </Button>

                {/* Role Switch Option */}
                <Button
                  variant="outline"
                  size="lg"
                  fullWidth
                  onClick={handleSwitchRoles}
                  className="border-primary-300 text-primary-700 hover:bg-primary-50"
                >
                  <ArrowLeftRight className="w-5 h-5 mr-2" />
                  Switch Roles & Practice as {roleMode === "original" ? aiCharacters[0] || "AI" : studentCharacter}
                </Button>
                <button
                  type="button"
                  className={`${retrySpeakingButtonClass} mt-4`}
                  onClick={handleRestartDrill}
                >
                  <RotateCcw className="w-5 h-5 shrink-0" />
                  Restart drill
                </button>
                <p className="text-xs text-gray-500 mt-2 text-center px-2">
                  Start from the first line again as {currentStudentRole} — same role, scores reset for this run.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DrillLayout>
  );
}
