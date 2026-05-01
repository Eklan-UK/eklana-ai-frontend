"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
  Send,
  Square,
  Volume2,
  VolumeX,
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
import {
  DrillCompletionScreen,
  DrillLayout,
  DrillProgress,
  RecordingPreviewBar,
  RoleplayPerformanceReview,
} from "./shared";
import { transcriptFromTextScore } from "./shared/speechaceTranscript";
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
  /** Transcript from pronunciation scoring for this spoken line. */
  transcript?: string;
}

const PASS_THRESHOLD = 65;

const PRESTART_INTRO_PLACEHOLDER =
  "When you're ready, tap Let's Get Started.";

/** Avoid stacked intro TTS when React re-runs effects (Strict Mode / deps churn). */
const prestartTtsLastStartByDrillMs = new Map<string, number>();
const PRESTART_TTS_DEBOUNCE_MS = 2000;

function consumePrestartTtsDebounceSlot(drillId: string): boolean {
  const key = drillId || "_";
  const now = Date.now();
  const last = prestartTtsLastStartByDrillMs.get(key) ?? 0;
  if (now - last < PRESTART_TTS_DEBOUNCE_MS) return false;
  prestartTtsLastStartByDrillMs.set(key, now);
  return true;
}

function clearPrestartTtsDebounce(drillId: string) {
  const key = drillId || "_";
  prestartTtsLastStartByDrillMs.delete(key);
}

/** Prefer formats the browser can both record and play back in `<audio>`. */
function pickRoleplayRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ] as const;
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

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
  const [pendingSubmitBlob, setPendingSubmitBlob] = useState<Blob | null>(null);
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState<string | null>(null);
  const MAX_RECORDING_SECONDS = 120;
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);

  // AI turn state - use ref for synchronous tracking to prevent double-play
  const playedAITurnsRef = useRef<Set<string>>(new Set());
  const [isPlayingAI, setIsPlayingAI] = useState(false);

  /** Gate: AI auto-play and student mic dock wait until the learner taps "Let's Get Started". */
  const [sessionStarted, setSessionStarted] = useState(false);

  // Silent analytics collection during the session
  const [sessionAnalytics, setSessionAnalytics] = useState<TurnAnalytics[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const preGenAudioRef = useRef<HTMLAudioElement | null>(null);

  const revokeRecordingPreview = () => {
    setRecordingPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const discardPendingRecording = () => {
    setPendingSubmitBlob(null);
    revokeRecordingPreview();
  };

  useEffect(() => {
    discardPendingRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when the spoken line changes
  }, [currentSceneIndex, currentTurnIndex]);

  // TTS for AI characters (fallback if no pre-generated audio)
  const {
    playAudio: playTTSAudio,
    isGenerating: isTTSGenerating,
    isPlaying: isTTSPlaying,
    stopAudio: stopTTSAudio
  } = useTTS({
    autoPlay: false,
  });

  // Cut any leftover TTS / streamed clip from another screen when this drill loads.
  useEffect(() => {
    stopTTSAudio();
    if (preGenAudioRef.current) {
      preGenAudioRef.current.pause();
      preGenAudioRef.current.currentTime = 0;
      preGenAudioRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: silence stale audio
  }, []);

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

  /** Best score per line, grouped by scene for the review screen. */
  const reviewSceneGroups = useMemo(() => {
    const deduped = sessionAnalytics
      .filter(
        (a, index, arr) =>
          arr.findIndex(
            (b) =>
              b.sceneIndex === a.sceneIndex &&
              b.turnIndex === a.turnIndex &&
              b.score >= a.score,
          ) === index,
      )
      .sort((a, b) => a.sceneIndex - b.sceneIndex || a.turnIndex - b.turnIndex);

    const map = new Map<number, TurnAnalytics[]>();
    for (const row of deduped) {
      const list = map.get(row.sceneIndex) ?? [];
      list.push(row);
      map.set(row.sceneIndex, list);
    }

    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([sceneIndex, rows]) => ({
        sceneIndex,
        sceneTitle:
          (scenes[sceneIndex] as { scene_name?: string } | undefined)?.scene_name?.trim() ||
          (scenes.length > 1 ? `Scene ${sceneIndex + 1}` : "Scene 1"),
        rows: rows
          .sort((x, y) => x.turnIndex - y.turnIndex)
          .map((r) => ({
            sceneIndex: r.sceneIndex,
            turnIndex: r.turnIndex,
            text: r.text,
            score: r.score,
            textScore: r.textScore,
            attempts: r.attempts,
          })),
      }));
  }, [sessionAnalytics, scenes]);

  // Get character name for the role the student is currently playing
  const currentStudentRole = roleMode === "original"
    ? studentCharacter
    : aiCharacters[0] || "AI";
  const currentAIRole = roleMode === "original"
    ? aiCharacters[0] || "AI"
    : studentCharacter;

  const prestartIntro = useMemo(() => {
    const raw = (drill as { drill_intro?: string }).drill_intro;
    const t = typeof raw === "string" ? raw.trim() : "";
    if (t) return t;
    return PRESTART_INTRO_PLACEHOLDER;
  }, [drill]);

  const prestartRolesLine = useMemo(() => {
    const partners = aiCharacters.filter(Boolean);
    const aiCastStr =
      partners.length <= 1 ? partners[0] || "your partner" : partners.join(", ");

    if (roleMode === "original") {
      return `You'll play ${studentCharacter}. Your partner voices: ${aiCastStr}.`;
    }
    // Swapped: you speak the scripted AI lines; the app voices the student role.
    return `You'll play ${aiCastStr}. Your partner voices: ${studentCharacter}.`;
  }, [aiCharacters, studentCharacter, roleMode]);

  const prestartTtsText = useMemo(
    () => `${prestartIntro} ${prestartRolesLine}`,
    [prestartIntro, prestartRolesLine],
  );

  const drillIdStr = drill._id != null ? String(drill._id) : "";

  // Auto-read intro + roles when the learner lands on the pre-start screen (browser may block until a tap).
  useEffect(() => {
    if (sessionStarted) {
      stopTTSAudio();
      if (drillIdStr) clearPrestartTtsDebounce(drillIdStr);
      return;
    }
    if (isCompleted || showReview) return;

    const d = scenes[currentSceneIndex]?.dialogue;
    const turn = d?.[currentTurnIndex];
    if (!turn) return;

    if (!consumePrestartTtsDebounceSlot(drillIdStr)) return;

    void playTTSAudio(prestartTtsText);
    // playTTSAudio / stopTTSAudio are stable from useTTS; omit to avoid effect churn double-firing TTS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sessionStarted,
    isCompleted,
    showReview,
    currentSceneIndex,
    currentTurnIndex,
    scenes,
    prestartTtsText,
    drillIdStr,
  ]);

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

  // Auto-play AI turns - only after session start and if not already played
  useEffect(() => {
    if (!sessionStarted || !isAITurn || !currentTurn) return;
    if (playedAITurnsRef.current.has(makeTurnKey(currentSceneIndex, currentTurnIndex))) return;
    if (isPlayingAI || isTTSGenerating || isTTSPlaying) return;
    playAITurn(currentTurn, currentTurnIndex);
  }, [
    sessionStarted,
    currentSceneIndex,
    currentTurnIndex,
    currentTurn,
    isAITurn,
    isPlayingAI,
    isTTSGenerating,
    isTTSPlaying,
    playAITurn,
  ]);

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
      const chosenMime = pickRoleplayRecorderMimeType();
      const mediaRecorder = new MediaRecorder(
        stream,
        chosenMime
          ? { mimeType: chosenMime, audioBitsPerSecond: 32000 }
          : { audioBitsPerSecond: 32000 }
      );
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blobType =
          mediaRecorder.mimeType || chosenMime || "audio/webm";
        // Brief pause helps some mobile browsers after closing the mic track.
        await new Promise((r) => setTimeout(r, 120));
        const totalBytes = audioChunksRef.current.reduce((n, c) => n + c.size, 0);
        if (totalBytes === 0) {
          toast.error("No audio was captured. Try recording again.");
          setPendingSubmitBlob(null);
          setRecordingPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
          return;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
        setPendingSubmitBlob(audioBlob);
        setRecordingPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(audioBlob);
        });
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

  const submitPendingForAnalysis = async () => {
    if (!pendingSubmitBlob) return;
    const blob = pendingSubmitBlob;
    setPendingSubmitBlob(null);
    revokeRecordingPreview();
    await analyzePronunciation(blob);
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
      transcript: pronunciationScore
        ? transcriptFromTextScore(pronunciationScore)
        : undefined,
    };
    setCompletedMessages(prev => [...prev, studentMessage]);

    // Move to next turn
    setCurrentTurnIndex(prev => prev + 1);
    setPronunciationScore(null);
  };

  /** Clears scoring UI and unlocks mic so the student can redo the line (before or after passing). */
  const handleRetrySpeaking = () => {
    discardPendingRecording();
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
    discardPendingRecording();
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
    if (drill._id != null) clearPrestartTtsDebounce(String(drill._id));
    if (preGenAudioRef.current) {
      preGenAudioRef.current.pause();
      preGenAudioRef.current = null;
    }
    setSessionStarted(false);
    toast.success(`Starting over from the beginning as ${currentStudentRole}.`);
  };

  const retrySpeakingButtonClass =
    "w-full bg-white border-2 border-[#3B883E] text-[#3B883E] hover:bg-emerald-50/80 font-semibold text-base py-3.5 rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2";

  // Switch roles - student becomes AI character and vice versa
  const handleSwitchRoles = () => {
    discardPendingRecording();
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

    stopTTSAudio();
    if (drill._id != null) clearPrestartTtsDebounce(String(drill._id));
    setSessionStarted(false);
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

      const totalAttemptsForSnapshot = Object.values(turnProgress).reduce(
        (sum, p) => sum + p.attempts,
        0,
      );
      const statsLineForSnapshot = `${completedStudentTurns} lines completed · ${totalAttemptsForSnapshot} total attempts`;

      await drillAPI.complete(drill._id, {
        drillAssignmentId: assignmentId,
        score: avgScore,
        timeSpent,
        roleplayResults: {
          sceneScores,
        },
        performanceReviewSnapshot: {
          version: 1,
          ui: "roleplay",
          avgScore,
          statsLine: statsLineForSnapshot,
          passThreshold: PASS_THRESHOLD,
          sectionHeading: "Scene-by-Scene Analysis",
          groups: JSON.parse(JSON.stringify(reviewSceneGroups)),
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
      setRecordingPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      if (preGenAudioRef.current) {
        preGenAudioRef.current.pause();
        preGenAudioRef.current = null;
      }
      stopTTSAudio();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopTTSAudio]);

  const awaitingSubmit =
    !!pendingSubmitBlob &&
    !isAnalyzing &&
    !pronunciationScore &&
    !currentProgress.passed;

  const readyToSubmitPreview = awaitingSubmit && Boolean(recordingPreviewUrl);
  const dockMainDisabled =
    isAnalyzing ||
    currentProgress.passed ||
    (awaitingSubmit && !recordingPreviewUrl);

  const handleDockMainClick = () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    if (readyToSubmitPreview) {
      void submitPendingForAnalysis();
      return;
    }
    startRecording();
  };

  if (isCompleted) {
    const linesWithTranscript = completedMessages.filter((m) =>
      Boolean(m.transcript?.trim())
    );
    return (
      <DrillCompletionScreen
        drillType="roleplay"
        returnPath="/account/drills"
        returnLabel="Back to My Plan"
        refreshOnMount={true}
        extraContent={
          linesWithTranscript.length > 0 ? (
            <Card className="border-gray-200 text-left p-4 shadow-none">
              <p className="text-sm font-semibold text-gray-900 mb-3">
                What we heard from your lines
              </p>
              <ul className="space-y-3 text-sm text-gray-700">
                {linesWithTranscript.map((m) => (
                  <li
                    key={m.id}
                    className="border-b border-gray-100 last:border-0 pb-3 last:pb-0"
                  >
                    <p className="text-xs text-gray-500 mb-0.5">Script line</p>
                    <p className="mb-2">{m.text}</p>
                    <p className="text-xs text-gray-500 mb-0.5">Transcript</p>
                    <p className="text-gray-900">{m.transcript}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : undefined
        }
      />
    );
  }

  // Review Screen - Shows all analytics collected during the session
  if (showReview) {
    const studentScores = Object.values(turnProgress).filter((p) => p.score !== null);
    const avgScore =
      studentScores.length > 0
        ? Math.round(
            studentScores.reduce((sum, p) => sum + (p.score || 0), 0) / studentScores.length,
          )
        : 0;
    const totalAttempts = Object.values(turnProgress).reduce((sum, p) => sum + p.attempts, 0);
    const statsLine = `${completedStudentTurns} lines completed · ${totalAttempts} total attempts`;

    return (
      <DrillLayout title="Review Performance" hideNavigation>
        <RoleplayPerformanceReview
          avgScore={avgScore}
          statsLine={statsLine}
          sceneGroups={reviewSceneGroups}
          passThreshold={PASS_THRESHOLD}
          onDone={() => void handleSubmit()}
          onPracticeAgain={handleRestartDrill}
          isSubmitting={isSubmitting}
        />
      </DrillLayout>
    );
  }

  return (
    <DrillLayout title={drill.title} hideNavigation>
      <div
        className={`rounded-2xl bg-muted/30 p-4 md:p-6 shadow-sm ${
          !isCompleted && !showReview && currentTurn && !sessionStarted
            ? "flex flex-1 min-h-0 flex-col pb-28 md:pb-32"
            : `space-y-5 ${
                !isCompleted && !showReview && currentTurn && sessionStarted && isStudentTurn && !isEntireDrillComplete
                  ? awaitingSubmit
                    ? "pb-48 md:pb-56"
                    : "pb-24 md:pb-28"
                  : ""
              }`
        }`}
      >
      {sessionStarted ? (
      <>
      {roleMode === "swapped" && (
        <div className="flex items-center justify-center gap-2 px-1 py-1">
          <ArrowLeftRight className="w-4 h-4 text-primary-600 shrink-0" />
          <span className="text-sm text-primary-700 text-center">
            <strong>Role Swapped:</strong> You're playing as <strong>{currentStudentRole}</strong>
          </span>
        </div>
      )}

      <DrillProgress
        embedded
        current={completedStudentTurns}
        total={totalStudentTurns}
        label="Your lines"
      />

      {drill.context && (
        <div className="px-0.5 py-1">
          <div className="flex items-start gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-900 mb-1">Scenario</p>
              <p className="text-sm text-emerald-800">{drill.context}</p>
            </div>
          </div>
        </div>
      )}

      {currentScene?.scene_name && (
        <div className="px-0.5 py-1">
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
        </div>
      )}

      <div className="max-h-64 overflow-y-auto py-2">
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
      </div>

      {!isEntireDrillComplete && currentTurn && (
        <div className="py-2">
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
                <div className="inline-flex items-center gap-2 px-1 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                  Your turn !
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

              <div className="mb-4 flex flex-col items-center">
                {isRecording && (
                  <div className="mb-2 bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold inline-block">
                    {MAX_RECORDING_SECONDS - recordingSeconds}s remaining · Tap the mic below to stop
                  </div>
                )}

                {!isRecording && (
                  <p className="text-sm text-gray-600 text-center px-2">
                    {currentProgress.passed ? (
                      <span className="text-green-600 font-medium">Line passed! ✓</span>
                    ) : isAnalyzing ? (
                      <span className="text-blue-600">
                        Analyzing your pronunciation — longer recordings may take a moment...
                      </span>
                    ) : awaitingSubmit ? (
                      <span className="text-gray-700">
                        Listen in the player, then tap the green send button to submit, or trash to
                        re-record.
                      </span>
                    ) : (
                      <span>Use the microphone fixed at the bottom of the screen to record.</span>
                    )}
                  </p>
                )}

                {currentProgress.attempts > 0 && !currentProgress.passed && (
                  <p className="text-xs text-gray-500 mt-2">
                    Attempt {currentProgress.attempts} • Need {PASS_THRESHOLD}%+ to pass
                  </p>
                )}
              </div>

              {/* Simple Score Display - Analytics shown on review screen */}
              {pronunciationScore && !currentProgress.passed && (
                <div className={`rounded-xl p-4 mb-4 ${(pronunciationScore.speechace_score.pronunciation || 0) >= PASS_THRESHOLD
                    ? "bg-green-50/90"
                    : "bg-amber-50/90"
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
                  <p className="text-sm text-gray-600 mt-3">
                    <span className="font-medium text-gray-700">Transcript: </span>
                    {transcriptFromTextScore(pronunciationScore) || "—"}
                  </p>
                </div>
              )}

              {/* Confetti celebration shown when passed - no analytics here */}
              {currentProgress.passed && pronunciationScore && (
                <div className="rounded-xl p-4 mb-4 bg-green-50/90 text-center">
                  <PartyPopper className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-lg font-bold text-green-700">
                    {pronunciationScore.speechace_score.pronunciation.toFixed(0)}% - Passed!
                  </p>
                  <p className="text-sm text-green-600">Click Continue to proceed</p>
                  <p className="text-sm text-gray-600 mt-2">
                    <span className="font-medium text-gray-700">Transcript: </span>
                    {transcriptFromTextScore(pronunciationScore) || "—"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 pt-1">
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
                  disabled={isRecording || isAnalyzing || awaitingSubmit}
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
                disabled={isRecording || isAnalyzing || awaitingSubmit}
              >
                <RotateCcw className="w-5 h-5 shrink-0" />
                Retry speaking
              </button>
            ) : null}
          </>
        )}

        {/* Conversation complete - Show Review and Role Switch options */}
        {isEntireDrillComplete && (
          <div className="-mx-4 bg-green-50/55 px-4 py-5 text-center md:-mx-6 md:px-6">
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
        )}
      </div>
      </>
      ) : (
        <div className="flex flex-1 w-full flex-col items-stretch justify-start px-0.5 pt-0 pb-2 min-h-0">
          <div className="flex w-full max-w-lg flex-col items-start gap-4">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-200/80 bg-white shadow-sm">
              <Image
                src="/icon.png"
                alt="Eklana"
                width={36}
                height={36}
                className="object-contain"
              />
            </div>
            <div className="min-w-0 w-full">
              <div className="rounded-2xl rounded-tl-md bg-gray-100 px-4 py-3 shadow-sm">
                <p className="text-sm font-medium text-emerald-900 leading-relaxed whitespace-pre-wrap">
                  {prestartIntro}
                </p>
                <p className="mt-3 text-sm text-emerald-800/95 leading-snug">{prestartRolesLine}</p>
                {roleMode === "swapped" && (
                  <p className="mt-2 text-xs font-medium text-emerald-800/90">
                    Roles reversed — you&apos;ll speak the AI side; your partner speaks{" "}
                    <span className="font-semibold">{studentCharacter}</span>.
                  </p>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3 pl-1">
                <button
                  type="button"
                  onClick={() =>
                    isTTSPlaying || isTTSGenerating
                      ? stopTTSAudio()
                      : void playTTSAudio(prestartTtsText)
                  }
                  disabled={isTTSGenerating}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    isTTSPlaying
                      ? "bg-red-100 text-red-600 hover:bg-red-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  title={isTTSPlaying ? "Stop audio" : "Play audio again"}
                  aria-label={isTTSPlaying ? "Stop audio" : "Play audio"}
                >
                  {isTTSGenerating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isTTSPlaying ? (
                    <VolumeX className="h-3 w-3" />
                  ) : (
                    <Volume2 className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {!isCompleted && !showReview && currentTurn && !sessionStarted ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto w-full max-w-md">
            <button
              type="button"
              onClick={() => setSessionStarted(true)}
              className="w-full rounded-full bg-[#388E3C] px-8 py-4 text-center text-base font-bold text-white shadow-md transition-colors hover:bg-[#2f7a33] active:scale-[0.99]"
            >
              Let&apos;s Get Started
            </button>
          </div>
        </div>
      ) : sessionStarted && isStudentTurn && !isEntireDrillComplete && currentTurn ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto flex w-full max-w-md flex-col items-center gap-3">
            {awaitingSubmit && recordingPreviewUrl ? (
              <RecordingPreviewBar
                key={recordingPreviewUrl}
                src={recordingPreviewUrl}
                onDiscard={discardPendingRecording}
                onAudioError={() => {
                  toast.error(
                    "Preview cannot play in this browser. You can still submit for feedback."
                  );
                }}
              />
            ) : null}
            <div className="relative h-20 w-20 shrink-0 rounded-full">
              {isRecording && (
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="44" fill="none" stroke="#fecaca" strokeWidth="4" />
                  <circle
                    cx="48"
                    cy="48"
                    r="44"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="4"
                    strokeDasharray={2 * Math.PI * 44}
                    strokeDashoffset={
                      2 * Math.PI * 44 * (1 - recordingSeconds / MAX_RECORDING_SECONDS)
                    }
                    strokeLinecap="round"
                    className="transition-[stroke-dashoffset] duration-1000 linear"
                  />
                </svg>
              )}
              <button
                type="button"
                onClick={handleDockMainClick}
                disabled={dockMainDisabled}
                className={`absolute inset-0 flex items-center justify-center rounded-full shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  currentProgress.passed
                    ? "bg-emerald-600 cursor-default"
                    : isRecording
                      ? "bg-red-500 hover:bg-red-600"
                      : isAnalyzing
                        ? "bg-gray-300 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700"
                }`}
                aria-label={
                  isRecording
                    ? "Stop recording"
                    : readyToSubmitPreview
                      ? "Submit recording for feedback"
                      : "Start recording"
                }
              >
                {currentProgress.passed ? (
                  <CheckCircle className="h-8 w-8 text-white" />
                ) : isRecording ? (
                  <Square className="h-7 w-7 text-white" />
                ) : isAnalyzing ? (
                  <Loader2 className="h-7 w-7 animate-spin text-white" />
                ) : readyToSubmitPreview ? (
                  <Send className="h-8 w-8 text-white" strokeWidth={2} />
                ) : (
                  <Mic className="h-8 w-8 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DrillLayout>
  );
}
