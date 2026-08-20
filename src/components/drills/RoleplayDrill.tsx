"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TTSButton, stopAllTTSButtons } from "@/components/ui/TTSButton";
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
  PartyPopper,
  ArrowLeftRight,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query";
import { drillAPI, pronunciationAPI, weeklyChallengeAPI } from "@/lib/api";
import { completeLearnerDrill } from "@/lib/drill/complete-learner-drill";
import { completeWeeklyChallengeItem } from "@/lib/challenges/weekly-challenge-client";
import type { WeeklyChallengeMeta } from "./DrillPracticeInterface";
import { useTTS } from "@/hooks/useTTS";
import { resolveAccentVoiceId } from "@/services/tts-accent-voices";
import { trackActivity } from "@/utils/activity-cache";
import { speechaceService, TextScore } from "@/services/speechace.service";
import {
  CheckpointScreen,
  DrillCompletionScreen,
  DrillLayout,
  DrillProgress,
  RecordingPreviewBar,
  RoleplayAnalysisOverlay,
  RoleplayPerformanceReview,
  type RoleplayAnalysisOverlayState,
} from "./shared";
import { transcriptFromTextScore } from "./shared/speechaceTranscript";
import { DrillBookmarkToggle } from "@/components/drills/DrillBookmarkToggle";
import { playPracticeFeedback, playPerfectItemCelebration } from "@/lib/practice-feedback";
import { useLocalDrillProgress } from "@/hooks/useLocalDrillProgress";
import { useAuthStore } from "@/store/auth-store";
import { getUserInitials } from "@/utils/user";

/** Avatar URL for an AI dialogue speaker (`ai_N` → avatars[N]); empty/missing → undefined. */
function resolveTurnAvatarUrl(
  speaker: string,
  avatars?: string[],
): string | undefined {
  const aiMatch = /^ai_(\d+)$/.exec(speaker);
  if (!aiMatch || !Array.isArray(avatars)) return undefined;
  const url = avatars[Number(aiMatch[1])]?.trim();
  return url || undefined;
}

function RoleplayAvatarChip({
  imageUrl,
  initials,
  fallback = "bot",
  size = "sm",
  className = "",
}: {
  imageUrl?: string | null;
  initials?: string;
  fallback?: "bot" | "user";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim =
    size === "lg" ? "w-20 h-20" : size === "md" ? "w-10 h-10" : "w-6 h-6";
  const iconClass =
    size === "lg" ? "w-10 h-10" : size === "md" ? "w-5 h-5" : "w-3 h-3";

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className={`${dim} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  if (fallback === "user" && initials) {
    return (
      <span
        className={`${dim} rounded-full bg-white/25 flex items-center justify-center text-[10px] font-bold shrink-0 ${className}`}
        aria-hidden
      >
        {initials}
      </span>
    );
  }

  if (fallback === "user") {
    return <User className={`${iconClass} shrink-0 ${className}`} />;
  }

  return <Bot className={`${iconClass} shrink-0 ${className}`} />;
}

interface RoleplayDrillProps {
  drill: any;
  assignmentId?: string;
  weeklyChallengeMeta?: WeeklyChallengeMeta;
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

interface SceneBreak {
  completedSceneIndex: number;
  nextSceneIndex: number;
}

type ProgressContext =
  | { source: "assignment"; assignmentId: string }
  | {
      source: "weekly_challenge";
      challengeId: string;
      challengeItemIndex: number;
      weekStartDate: string;
    };

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
  /** Pre-generated Cloudinary clip for this turn, when present. */
  audioUrl?: string;
}

const PASS_THRESHOLD = 65;
const PASS_OVERLAY_MS = 1400;
const FAIL_OVERLAY_MS = 1600;

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

export default function RoleplayDrill({
  drill,
  assignmentId,
  weeklyChallengeMeta,
}: RoleplayDrillProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const studentAvatarUrl = user?.avatar || user?.image || undefined;
  const studentInitials = getUserInitials(user);
  const localProgress = useLocalDrillProgress({
    drillId: String(drill._id ?? weeklyChallengeMeta?.challengeId ?? "roleplay"),
    drillType: "roleplay",
    assignmentId,
    weeklyChallengeMeta,
  });
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [completedMessages, setCompletedMessages] = useState<CompletedMessage[]>([]);
  const [turnProgress, setTurnProgress] = useState<TurnProgressMap>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());
  const [sceneBreak, setSceneBreak] = useState<SceneBreak | null>(null);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  /** True when saved assignment progress was restored — skip pre-start intro TTS on resume. */
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const hasLocalHydratedRef = useRef(false);

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
  const [analysisOverlay, setAnalysisOverlay] = useState<RoleplayAnalysisOverlayState | null>(null);
  const [pronunciationScore, setPronunciationScore] = useState<TextScore | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [pendingSubmitBlob, setPendingSubmitBlob] = useState<Blob | null>(null);
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState<string | null>(null);
  const MAX_RECORDING_SECONDS = 120;
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const analysisOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayGenRef = useRef(0);

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
  /** Invalidates in-flight AI playback / leftover onended + advance timers. */
  const aiPlayGenerationRef = useRef(0);
  const aiAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Stops the student listen button (TTSButton) from outside. */
  const studentTTSStopRef = useRef<(() => void) | null>(null);

  const clearAnalysisOverlayTimer = () => {
    if (analysisOverlayTimerRef.current) {
      clearTimeout(analysisOverlayTimerRef.current);
      analysisOverlayTimerRef.current = null;
    }
  };

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

  // TTS for AI characters (fallback if no pre-generated audio)
  const {
    playAudio: playTTSAudio,
    isGenerating: isTTSGenerating,
    isPlaying: isTTSPlaying,
    stopAudio: stopTTSAudio
  } = useTTS({
    autoPlay: false,
  });

  const clearAiAdvanceTimer = useCallback(() => {
    if (aiAdvanceTimerRef.current) {
      clearTimeout(aiAdvanceTimerRef.current);
      aiAdvanceTimerRef.current = null;
    }
  }, []);

  const stopAllRoleplaySpeech = useCallback(() => {
    aiPlayGenerationRef.current += 1;
    clearAiAdvanceTimer();
    if (preGenAudioRef.current) {
      preGenAudioRef.current.pause();
      preGenAudioRef.current.currentTime = 0;
      preGenAudioRef.current.onended = null;
      preGenAudioRef.current.onerror = null;
      preGenAudioRef.current = null;
    }
    stopTTSAudio();
    studentTTSStopRef.current?.();
    stopAllTTSButtons();
    setIsPlayingAI(false);
  }, [clearAiAdvanceTimer, stopTTSAudio]);

  useEffect(() => {
    discardPendingRecording();
    overlayGenRef.current += 1;
    clearAnalysisOverlayTimer();
    setAnalysisOverlay(null);
    stopAllRoleplaySpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when the spoken line changes
  }, [currentSceneIndex, currentTurnIndex]);

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

  /** ElevenLabs voice for a dialogue turn (AI character key, else drill-level accent). */
  const resolveTurnVoiceId = useCallback(
    (speaker: string): string | undefined => {
      const defaultVoiceId = resolveAccentVoiceId(drill.tts_voice_key);
      const voiceKeys = Array.isArray(drill.ai_character_voice_keys)
        ? drill.ai_character_voice_keys
        : [];
      const aiMatch = /^ai_(\d+)$/.exec(speaker);
      if (aiMatch) {
        const characterKey = voiceKeys[Number(aiMatch[1])];
        if (characterKey?.trim()) {
          return resolveAccentVoiceId(characterKey) ?? defaultVoiceId;
        }
      }
      return defaultVoiceId;
    },
    [drill.ai_character_voice_keys, drill.tts_voice_key],
  );

  const drillVoiceId = resolveAccentVoiceId(drill.tts_voice_key);

  const aiCharacterAvatars = Array.isArray(drill.ai_character_avatars)
    ? (drill.ai_character_avatars as string[])
    : undefined;

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

  const progressContext = useMemo((): ProgressContext | null => {
    if (assignmentId) {
      return { source: "assignment", assignmentId };
    }
    if (weeklyChallengeMeta) {
      return {
        source: "weekly_challenge",
        challengeId: weeklyChallengeMeta.challengeId,
        challengeItemIndex: weeklyChallengeMeta.itemIndex,
        weekStartDate: weeklyChallengeMeta.weekStartDate,
      };
    }
    return null;
  }, [assignmentId, weeklyChallengeMeta]);

  const progressDrillId = useMemo((): string | null => {
    if (assignmentId && drill._id != null) return String(drill._id);
    if (weeklyChallengeMeta) return weeklyChallengeMeta.challengeId;
    return null;
  }, [assignmentId, drill._id, weeklyChallengeMeta]);

  const buildSavePayload = useCallback(
    (opts: {
      currentSceneIndex: number;
      currentTurnIndex: number;
      pausedAtSceneBreak: boolean;
      completedSceneIndex?: number;
    }) => {
      if (!progressContext) return null;
      return {
        source: progressContext.source,
        assignmentId:
          progressContext.source === "assignment" ? progressContext.assignmentId : undefined,
        challengeId:
          progressContext.source === "weekly_challenge"
            ? progressContext.challengeId
            : undefined,
        challengeItemIndex:
          progressContext.source === "weekly_challenge"
            ? progressContext.challengeItemIndex
            : undefined,
        weekStartDate:
          progressContext.source === "weekly_challenge"
            ? progressContext.weekStartDate
            : undefined,
        currentSceneIndex: opts.currentSceneIndex,
        currentTurnIndex: opts.currentTurnIndex,
        pausedAtSceneBreak: opts.pausedAtSceneBreak,
        completedSceneIndex: opts.completedSceneIndex,
        turnProgress,
        sessionAnalytics: sessionAnalytics.map((a) => ({
          ...a,
          timestamp: a.timestamp instanceof Date ? a.timestamp.toISOString() : a.timestamp,
        })),
        roleMode,
        originalRoleProgress,
        swappedRoleProgress,
        startedAt: new Date(sessionStartTime).toISOString(),
      };
    },
    [
      progressContext,
      turnProgress,
      sessionAnalytics,
      roleMode,
      originalRoleProgress,
      swappedRoleProgress,
      sessionStartTime,
    ],
  );

  const clearCheckpoint = useCallback(async () => {
    if (!progressContext || !progressDrillId || weeklyChallengeMeta) return;
    try {
      if (progressContext.source === "assignment") {
        await drillAPI.clearRoleplayProgress(progressDrillId, {
          source: "assignment",
          assignmentId: progressContext.assignmentId,
        });
      } else {
        await drillAPI.clearRoleplayProgress(progressDrillId, {
          source: "weekly_challenge",
          challengeId: progressContext.challengeId,
          challengeItemIndex: progressContext.challengeItemIndex,
        });
      }
    } catch {
      // Non-blocking cleanup
    }
  }, [progressContext, progressDrillId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedProgress() {
      if (!localProgress.isReady) return;

      const applyLocal = (partial: Record<string, unknown>, resumeFromIndex: number) => {
        const savedSceneIndex = Number(
          partial.currentSceneIndex ?? resumeFromIndex ?? 0,
        );
        if (!Number.isFinite(savedSceneIndex) || savedSceneIndex >= scenes.length) {
          localProgress.clear();
          return false;
        }

        setTurnProgress((partial.turnProgress as TurnProgressMap) ?? {});
        setOriginalRoleProgress((partial.originalRoleProgress as TurnProgressMap) ?? {});
        setSwappedRoleProgress((partial.swappedRoleProgress as TurnProgressMap) ?? {});
        setRoleMode((partial.roleMode as "original" | "swapped") ?? "original");
        setSessionAnalytics(
          ((partial.sessionAnalytics as TurnAnalytics[]) ?? []).map((a) => ({
            ...a,
            timestamp: new Date(a.timestamp),
          })),
        );

        const pausedAtBreak = Boolean(partial.pausedAtSceneBreak);
        const completedIdx =
          partial.completedSceneIndex != null
            ? Number(partial.completedSceneIndex)
            : Math.max(0, savedSceneIndex - 1);

        if (pausedAtBreak && scenes.length > 1) {
          setSceneBreak({
            completedSceneIndex: completedIdx,
            nextSceneIndex: savedSceneIndex,
          });
        } else {
          setCurrentSceneIndex(savedSceneIndex);
          setCurrentTurnIndex(Number(partial.currentTurnIndex ?? 0));
        }

        if (partial.sessionStarted !== false) {
          setSessionStarted(true);
        }
        setHasRestoredProgress(true);
        return true;
      };

      // Local first (silent) — fresher than server milestones between scene saves
      const local = localProgress.hydrate();
      if (local) {
        if (!cancelled) {
          const applied = applyLocal(local.partialResults, local.resumeFromIndex);
          if (applied) {
            if (local.startedAt) {
              setSessionStartTime(new Date(local.startedAt).getTime());
            }
            hasLocalHydratedRef.current = true;
            setIsLoadingProgress(false);
            return;
          }
          // Outdated local was cleared — fall through to server checkpoint
        } else {
          return;
        }
      }

      if (!progressContext || !progressDrillId) {
        if (!cancelled) {
          hasLocalHydratedRef.current = true;
          setIsLoadingProgress(false);
        }
        return;
      }
      if (weeklyChallengeMeta) {
        try {
          const res = await weeklyChallengeAPI.getCheckpoint(
            weeklyChallengeMeta.weekStartDate,
            weeklyChallengeMeta.itemIndex,
          );
          if (cancelled) return;
          const cp = res.data?.checkpoint as Record<string, unknown> | null;
          if (cp && typeof cp.resumeFromIndex === 'number' && cp.resumeFromIndex > 0) {
            setCurrentSceneIndex(cp.resumeFromIndex);
            const sceneName =
              scenes[cp.resumeFromIndex]?.scene_name || `Scene ${cp.resumeFromIndex + 1}`;
            toast.success(`Welcome back — continuing from ${sceneName}.`);
          }
        } catch {
          // Non-blocking
        }
        if (!cancelled) {
          hasLocalHydratedRef.current = true;
          setIsLoadingProgress(false);
        }
        return;
      }

      try {
        const response =
          progressContext.source === "assignment"
            ? await drillAPI.getRoleplayProgress(progressDrillId, {
                source: "assignment",
                assignmentId: progressContext.assignmentId,
              })
            : await drillAPI.getRoleplayProgress(progressDrillId, {
                source: "weekly_challenge",
                challengeId: progressContext.challengeId,
                challengeItemIndex: progressContext.challengeItemIndex,
              });

        if (cancelled) return;

        const progress = response.data?.progress as Record<string, unknown> | null | undefined;
        if (!progress) {
          hasLocalHydratedRef.current = true;
          setIsLoadingProgress(false);
          return;
        }

        const savedSceneIndex = Number(progress.currentSceneIndex ?? 0);
        if (!Number.isFinite(savedSceneIndex) || savedSceneIndex >= scenes.length) {
          await clearCheckpoint();
          toast.info("Saved progress was outdated — starting fresh.");
          hasLocalHydratedRef.current = true;
          setIsLoadingProgress(false);
          return;
        }

        setTurnProgress((progress.turnProgress as TurnProgressMap) ?? {});
        setOriginalRoleProgress((progress.originalRoleProgress as TurnProgressMap) ?? {});
        setSwappedRoleProgress((progress.swappedRoleProgress as TurnProgressMap) ?? {});
        setRoleMode((progress.roleMode as "original" | "swapped") ?? "original");
        setSessionAnalytics(
          ((progress.sessionAnalytics as TurnAnalytics[]) ?? []).map((a) => ({
            ...a,
            timestamp: new Date(a.timestamp),
          })),
        );
        if (progress.startedAt) {
          setSessionStartTime(new Date(progress.startedAt as string).getTime());
        }

        const pausedAtBreak = Boolean(progress.pausedAtSceneBreak);
        const completedIdx =
          progress.completedSceneIndex != null
            ? Number(progress.completedSceneIndex)
            : Math.max(0, savedSceneIndex - 1);

        if (pausedAtBreak && scenes.length > 1) {
          setSceneBreak({
            completedSceneIndex: completedIdx,
            nextSceneIndex: savedSceneIndex,
          });
          setHasRestoredProgress(true);
          setSessionStarted(true);
          const nextName =
            scenes[savedSceneIndex]?.scene_name || `Scene ${savedSceneIndex + 1}`;
          toast.success(`Welcome back — ready to continue to ${nextName}.`);
        } else {
          setCurrentSceneIndex(savedSceneIndex);
          setCurrentTurnIndex(Number(progress.currentTurnIndex ?? 0));
          setHasRestoredProgress(true);
          setSessionStarted(true);
          const sceneName =
            scenes[savedSceneIndex]?.scene_name || `Scene ${savedSceneIndex + 1}`;
          toast.success(`Welcome back — continuing from ${sceneName}.`);
        }
      } catch {
        if (!cancelled) {
          toast.error("Could not load saved progress.");
        }
      } finally {
        if (!cancelled) {
          hasLocalHydratedRef.current = true;
          setIsLoadingProgress(false);
        }
      }
    }

    void loadSavedProgress();
    return () => {
      cancelled = true;
    };
  }, [localProgress.isReady, progressContext, progressDrillId, scenes, clearCheckpoint, weeklyChallengeMeta]);

  // Silent local twin of scene/turn progress (crash / background resume)
  useEffect(() => {
    if (!localProgress.isReady || !hasLocalHydratedRef.current || isLoadingProgress) return;
    if (isCompleted) return;
    // Avoid writing empty progress before the learner starts (or resumes)
    if (!sessionStarted && !hasRestoredProgress && !sceneBreak) return;

    localProgress.persist({
      resumeFromIndex: sceneBreak ? sceneBreak.nextSceneIndex : currentSceneIndex,
      completedItemCount: sceneBreak
        ? sceneBreak.nextSceneIndex
        : currentSceneIndex,
      partialResults: {
        currentSceneIndex: sceneBreak ? sceneBreak.nextSceneIndex : currentSceneIndex,
        currentTurnIndex: sceneBreak ? 0 : currentTurnIndex,
        pausedAtSceneBreak: Boolean(sceneBreak),
        completedSceneIndex: sceneBreak?.completedSceneIndex,
        turnProgress,
        sessionAnalytics: sessionAnalytics.map((a) => ({
          ...a,
          timestamp: a.timestamp instanceof Date ? a.timestamp.toISOString() : a.timestamp,
        })),
        roleMode,
        originalRoleProgress,
        swappedRoleProgress,
        sessionStarted,
      },
      startedAt: new Date(sessionStartTime).toISOString(),
    });
  }, [
    localProgress.isReady,
    isLoadingProgress,
    isCompleted,
    currentSceneIndex,
    currentTurnIndex,
    sceneBreak,
    turnProgress,
    sessionAnalytics,
    roleMode,
    originalRoleProgress,
    swappedRoleProgress,
    sessionStarted,
    sessionStartTime,
  ]);

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

  // Stop prestart intro voice the moment the session begins — runs once on that transition.
  useEffect(() => {
    if (!sessionStarted) return;
    stopAllRoleplaySpeech();
    if (drillIdStr) clearPrestartTtsDebounce(drillIdStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only needs sessionStarted + drillIdStr
  }, [sessionStarted, drillIdStr]);

  // Auto-read intro + roles when the learner lands on the pre-start screen (browser may block until a tap).
  useEffect(() => {
    if (sessionStarted || isCompleted || showReview || isLoadingProgress || hasRestoredProgress) {
      return;
    }

    const d = scenes[currentSceneIndex]?.dialogue;
    const turn = d?.[currentTurnIndex];
    if (!turn) return;

    if (!consumePrestartTtsDebounceSlot(drillIdStr)) return;

    void playTTSAudio(prestartTtsText, drillVoiceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- playTTSAudio is stable from useTTS
  }, [
    sessionStarted,
    isCompleted,
    showReview,
    isLoadingProgress,
    hasRestoredProgress,
    currentSceneIndex,
    currentTurnIndex,
    scenes,
    prestartTtsText,
    drillIdStr,
    drillVoiceId,
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

  const scheduleAdvanceAfterBeat = useCallback(
    (generation: number) => {
      clearAiAdvanceTimer();
      aiAdvanceTimerRef.current = setTimeout(() => {
        aiAdvanceTimerRef.current = null;
        if (generation !== aiPlayGenerationRef.current) return;
        moveToNextTurn();
      }, 300);
    },
    [clearAiAdvanceTimer, moveToNextTurn],
  );

  // Play AI turn - only called once per turn
  const playAITurn = useCallback(async (turn: DialogueTurn, turnIndex: number) => {
    const turnKey = makeTurnKey(currentSceneIndex, turnIndex);
    if (playedAITurnsRef.current.has(turnKey)) {
      return; // Already played, skip
    }
    playedAITurnsRef.current.add(turnKey);
    const generation = ++aiPlayGenerationRef.current;
    setIsPlayingAI(true);

    const stillCurrent = () => generation === aiPlayGenerationRef.current;

    // Silence any pre-start intro TTS still playing via useTTS before scene audio.
    stopTTSAudio();

    // Add AI message to completed messages
    const aiMessage: CompletedMessage = {
      id: `msg-${Date.now()}-${turnKey}`,
      speaker: turn.speaker,
      text: turn.text,
      translation: turn.translation,
      timestamp: new Date(),
      audioUrl: turn.audioUrl,
    };
    setCompletedMessages(prev => [...prev, aiMessage]);

    const audioUrl = turn.audioUrl;
    const voiceId = resolveTurnVoiceId(turn.speaker);

    const playLiveTtsThenAdvance = async () => {
      if (!stillCurrent()) return;
      await playTTSAudio(turn.text, voiceId, { waitUntilEnd: true });
      if (!stillCurrent()) return;
      scheduleAdvanceAfterBeat(generation);
    };

    if (audioUrl) {
      if (preGenAudioRef.current) {
        preGenAudioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      preGenAudioRef.current = audio;

      let fallbackStarted = false;
      const fallbackToTts = () => {
        if (!stillCurrent() || fallbackStarted) return;
        fallbackStarted = true;
        console.warn("Pre-generated audio failed, falling back to TTS");
        void playLiveTtsThenAdvance();
      };

      audio.onended = () => {
        if (!stillCurrent()) return;
        scheduleAdvanceAfterBeat(generation);
      };
      audio.onerror = () => {
        fallbackToTts();
      };

      try {
        await audio.play();
      } catch (err: unknown) {
        const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
        if (name !== "AbortError") {
          console.error("Error playing pre-generated audio:", err);
        }
        fallbackToTts();
      }
    } else {
      try {
        await playLiveTtsThenAdvance();
      } catch (error) {
        console.error("TTS failed:", error);
        toast.error("Failed to play AI audio");
        if (stillCurrent()) moveToNextTurn();
      }
    }
  }, [playTTSAudio, moveToNextTurn, currentSceneIndex, stopTTSAudio, resolveTurnVoiceId, scheduleAdvanceAfterBeat]);

  // Auto-play AI turns - only after session start and if not already played
  useEffect(() => {
    if (!sessionStarted || sceneBreak || !isAITurn || !currentTurn) return;
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
    sceneBreak,
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

  // After a scene ends, show scene break (multi-scene only)
  useEffect(() => {
    if (isCompleted) return;
    if (showReview) return;
    if (sceneBreak) return;
    if (!scenes.length || scenes.length <= 1) return;
    const d = scenes[currentSceneIndex]?.dialogue || [];
    if (d.length === 0) return;
    if (currentTurnIndex < d.length) return;
    if (currentSceneIndex < scenes.length - 1) {
      stopAllRoleplaySpeech();
      setSceneBreak({
        completedSceneIndex: currentSceneIndex,
        nextSceneIndex: currentSceneIndex + 1,
      });
    }
  }, [currentSceneIndex, currentTurnIndex, scenes, isCompleted, showReview, sceneBreak, stopAllRoleplaySpeech]);

  useEffect(() => {
    if (!sceneBreak || !weeklyChallengeMeta) return;
    void weeklyChallengeAPI.saveCheckpoint(
      weeklyChallengeMeta.weekStartDate,
      weeklyChallengeMeta.itemIndex,
      {
        drillType: 'roleplay',
        resumeFromIndex: sceneBreak.nextSceneIndex,
        completedCount: sceneBreak.nextSceneIndex,
        partialResults: {},
      },
    );
    setShowCheckpoint(true);
  }, [sceneBreak, weeklyChallengeMeta]);

  const advanceToNextScene = useCallback(() => {
    if (!sceneBreak) return;
    const next = sceneBreak.nextSceneIndex;
    const nextName = scenes[next]?.scene_name || `Scene ${next + 1}`;
    setCurrentSceneIndex(next);
    setCurrentTurnIndex(0);
    setCompletedMessages([]);
    setPronunciationScore(null);
    playedAITurnsRef.current = new Set();
    setSceneBreak(null);
    toast.success(`Next: ${nextName}`);
  }, [sceneBreak, scenes]);

  const saveProgressAndExit = useCallback(async () => {
    if (!sceneBreak || !progressContext || !progressDrillId) return;

    const payload = buildSavePayload({
      currentSceneIndex: sceneBreak.nextSceneIndex,
      currentTurnIndex: 0,
      pausedAtSceneBreak: true,
      completedSceneIndex: sceneBreak.completedSceneIndex,
    });
    if (!payload) return;

    setIsSavingProgress(true);
    try {
      if (!weeklyChallengeMeta) {
        await drillAPI.saveRoleplayProgress(progressDrillId, payload);
        void queryClient.invalidateQueries({ queryKey: queryKeys.drills.learner.all() });
        toast.success("Progress saved — pick up where you left off anytime.");
      }
      // Use a hard navigation (window.location) so the React tree is fully torn
      // down before the next page mounts.  router.push (soft nav) can throw an
      // unhandled rejection when async state updates are still in-flight after
      // query invalidation, which is the root cause of the runtime error here.
      const exitHref =
        progressContext.source === "weekly_challenge"
          ? `/account/practice/weekly-challenge/${encodeURIComponent(progressContext.weekStartDate)}`
          : "/account/drills";
      window.location.href = exitHref;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to save progress: " + message);
      setIsSavingProgress(false);
    }
    // NOTE: no `finally` block — if save succeeds we navigate away (hard reload)
    // so setting state on the unmounting component is unnecessary.  On error the
    // catch block above resets the flag so the button becomes clickable again.
  }, [sceneBreak, progressContext, progressDrillId, buildSavePayload, queryClient]);

  const clearRecordingTimers = () => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (autoStopTimerRef.current) { clearTimeout(autoStopTimerRef.current); autoStopTimerRef.current = null; }
  };

  // Recording functions
  const startRecording = async () => {
    if (!isStudentTurn) return;

    stopAllRoleplaySpeech();

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

  const handleContinue = (opts?: {
    score: number;
    textScore: TextScore | null;
    turn?: DialogueTurn;
  }) => {
    const turn = opts?.turn ?? currentTurn;
    if (!turn) return;
    const score = opts?.score ?? currentProgress.score;
    const textScore = opts?.textScore !== undefined ? opts.textScore : pronunciationScore;
    if (score == null || score < PASS_THRESHOLD) return;

    const studentMessage: CompletedMessage = {
      id: `msg-${Date.now()}`,
      speaker: "student",
      text: turn.text,
      translation: turn.translation,
      score,
      timestamp: new Date(),
      transcript: textScore
        ? transcriptFromTextScore(textScore)
        : undefined,
      audioUrl: turn.audioUrl,
    };
    setCompletedMessages(prev => [...prev, studentMessage]);
    setCurrentTurnIndex(prev => prev + 1);
    setPronunciationScore(null);
    setAnalysisOverlay(null);
  };

  /** Clears scoring UI and restores the mic so the student can redo the line. */
  const handleRetrySpeaking = () => {
    discardPendingRecording();
    setPronunciationScore(null);
    setAnalysisOverlay(null);
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

  const analyzePronunciation = async (audioBlob: Blob) => {
    if (!currentTurn) return;

    const gen = overlayGenRef.current;
    const analyzedTurn = currentTurn;
    const analyzedKey = currentTurnKey;
    const analyzedSceneIndex = currentSceneIndex;
    const analyzedTurnIndex = currentTurnIndex;

    clearAnalysisOverlayTimer();
    setIsAnalyzing(true);
    setPronunciationScore(null);
    setAnalysisOverlay("processing");

    try {
      const speechAceResponse = await speechaceService.scorePronunciation(
        analyzedTurn.text,
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
        const score = textScore.speechace_score.pronunciation;
        const passed = score >= PASS_THRESHOLD;
        const newAttempts = (turnProgress[analyzedKey]?.attempts || 0) + 1;
        const overlayStillCurrent = gen === overlayGenRef.current;

        if (overlayStillCurrent) {
          setPronunciationScore(textScore);
        }

        setTurnProgress((prev) => ({
          ...prev,
          [analyzedKey]: {
            passed,
            score,
            attempts: newAttempts,
          },
        }));

        setSessionAnalytics((prev) => [
          ...prev,
          {
            sceneIndex: analyzedSceneIndex,
            turnIndex: analyzedTurnIndex,
            text: analyzedTurn.text,
            score,
            textScore,
            attempts: newAttempts,
            timestamp: new Date(),
          },
        ]);

        if (overlayStillCurrent) {
          if (passed) {
            if (Math.round(score) >= 100) {
              playPerfectItemCelebration();
            } else {
              playPracticeFeedback("success");
            }
            setAnalysisOverlay("pass");
            analysisOverlayTimerRef.current = setTimeout(() => {
              if (gen !== overlayGenRef.current) return;
              handleContinue({ score, textScore, turn: analyzedTurn });
            }, PASS_OVERLAY_MS);
          } else {
            playPracticeFeedback("failure");
            setAnalysisOverlay("fail");
            analysisOverlayTimerRef.current = setTimeout(() => {
              if (gen !== overlayGenRef.current) return;
              handleRetrySpeaking();
            }, FAIL_OVERLAY_MS);
          }
        }

        try {
          const audioBase64 = await blobToBase64(audioBlob);
          await pronunciationAPI.createDrillAttempt({
            text: analyzedTurn.text,
            audioBase64,
            drillId: drill._id,
            drillType: 'roleplay',
            passingThreshold: PASS_THRESHOLD,
          });
        } catch (error) {
          console.error('Failed to record pronunciation attempt:', error);
        }
      } else {
        throw new Error("Invalid response from SpeechAce");
      }
    } catch (error: any) {
      if (gen === overlayGenRef.current) {
        setAnalysisOverlay(null);
      }
      toast.error(error.message || "Failed to analyze pronunciation");
    } finally {
      setIsAnalyzing(false);
    }
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
    setSceneBreak(null);
    setAnalysisOverlay(null);
    clearAnalysisOverlayTimer();
    overlayGenRef.current += 1;
    setSessionStartTime(Date.now());
    setIsPlayingAI(false);
    stopAllRoleplaySpeech();
    if (drill._id != null) clearPrestartTtsDebounce(String(drill._id));
    setSessionStarted(false);
    setHasRestoredProgress(false);
    void clearCheckpoint();
    localProgress.clear();
    toast.success(`Starting over from the beginning as ${currentStudentRole}.`);
  };

  const retrySpeakingButtonClass =
    "w-full bg-card border-2 border-[#3B883E] text-[#3B883E] hover:bg-emerald-500/15 dark:hover:bg-emerald-500/20 font-semibold text-base py-3.5 rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2";

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
    setAnalysisOverlay(null);
    clearAnalysisOverlayTimer();
    overlayGenRef.current += 1;

    // Load progress for the new role (if any previous progress exists)
    const savedProgress = newMode === "original" ? originalRoleProgress : swappedRoleProgress;
    setTurnProgress(savedProgress);

    // Clear session analytics for fresh round
    setSessionAnalytics([]);

    stopAllRoleplaySpeech();
    if (drill._id != null) clearPrestartTtsDebounce(String(drill._id));
    setSessionStarted(false);
    setHasRestoredProgress(false);
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
    if (!assignmentId && !weeklyChallengeMeta) {
      toast.error("Assignment ID is missing. Cannot submit drill.");
      return;
    }

    setIsSubmitting(true);
    try {
      const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);

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

      if (weeklyChallengeMeta) {
        await completeWeeklyChallengeItem(queryClient, weeklyChallengeMeta.itemId, {
          score: avgScore,
          weekStartDate: weeklyChallengeMeta.weekStartDate,
        });
      } else {
        await completeLearnerDrill(queryClient, drill._id, {
          drillAssignmentId: assignmentId!,
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
      }

      await clearCheckpoint();
      if (weeklyChallengeMeta) void weeklyChallengeAPI.clearCheckpoint(weeklyChallengeMeta.weekStartDate, weeklyChallengeMeta.itemIndex);
      localProgress.clear();

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

  // Cleanup audio and recording timers on unmount
  useEffect(() => {
    return () => {
      clearRecordingTimers();
      clearAnalysisOverlayTimer();
      overlayGenRef.current += 1;
      setRecordingPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      stopAllRoleplaySpeech();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup; all captured refs are stable
  }, []);

  const awaitingSubmit =
    !!pendingSubmitBlob &&
    !isAnalyzing &&
    !pronunciationScore &&
    !currentProgress.passed &&
    analysisOverlay == null;

  const readyToSubmitPreview = awaitingSubmit && Boolean(recordingPreviewUrl);
  const dockMainDisabled =
    analysisOverlay != null ||
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

  if (isLoadingProgress) {
    return (
      <DrillLayout title={drill.title} hideNavigation headerRight={<DrillBookmarkToggle drillId={String(drill._id)} />}>
        <div className="flex flex-1 items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DrillLayout>
    );
  }

  const sceneBreakCompletedName =
    sceneBreak != null
      ? scenes[sceneBreak.completedSceneIndex]?.scene_name ||
        `Scene ${sceneBreak.completedSceneIndex + 1}`
      : "";
  const sceneBreakNextName =
    sceneBreak != null
      ? scenes[sceneBreak.nextSceneIndex]?.scene_name ||
        `Scene ${sceneBreak.nextSceneIndex + 1}`
      : "";

  if (showCheckpoint && weeklyChallengeMeta && sceneBreak) {
    return (
      <CheckpointScreen
        completedCount={sceneBreak.nextSceneIndex}
        totalCount={scenes.length}
        drillTitle={drill.title}
        onContinue={() => {
          setShowCheckpoint(false);
          advanceToNextScene();
        }}
        onExit={() => {
          window.location.href = `/account/practice/weekly-challenge/${weeklyChallengeMeta.weekStartDate}`;
        }}
      />
    );
  }

  if (isCompleted) {
    const linesWithTranscript = completedMessages.filter((m) =>
      Boolean(m.transcript?.trim())
    );
    const returnPath = weeklyChallengeMeta
      ? `/account/practice/weekly-challenge/${encodeURIComponent(weeklyChallengeMeta.weekStartDate)}`
      : "/account/drills";
    return (
      <DrillCompletionScreen
        drillType={weeklyChallengeMeta ? "Roleplay" : "roleplay"}
        returnPath={returnPath}
        returnLabel={weeklyChallengeMeta ? "Back to Challenge" : "Back to My Plan"}
        celebrate={false}
        extraContent={
          linesWithTranscript.length > 0 ? (
            <Card className="border-border text-left p-4 shadow-none">
              <p className="text-sm font-semibold text-foreground mb-3">
                What we heard from your lines
              </p>
              <ul className="space-y-3 text-sm text-foreground">
                {linesWithTranscript.map((m) => (
                  <li
                    key={m.id}
                    className="border-b border-border last:border-0 pb-3 last:pb-0"
                  >
                    <p className="text-xs text-muted-foreground mb-0.5">Script line</p>
                    <p className="mb-2">{m.text}</p>
                    <p className="text-xs text-muted-foreground mb-0.5">Transcript</p>
                    <p className="text-foreground">{m.transcript}</p>
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
      <DrillLayout title="Review Performance" hideNavigation headerRight={<DrillBookmarkToggle drillId={String(drill._id)} />}>
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
    <DrillLayout
      title={drill.title}
      hideNavigation
      headerRight={<DrillBookmarkToggle drillId={String(drill._id)} />}
    >
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

      {currentScene?.scene_name && !sceneBreak && (
        <div className="px-0.5 py-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Current Scene</p>
              <p className="text-sm font-semibold text-foreground">{currentScene.scene_name}</p>
            </div>
            {scenes.length > 1 && (
              <div className="text-xs text-muted-foreground">
                Scene {currentSceneIndex + 1} of {scenes.length}
              </div>
            )}
          </div>
        </div>
      )}

      {sceneBreak && (
        <div className="px-0.5 py-1">
          <p className="text-xs text-muted-foreground mb-1">Scene complete</p>
          <p className="text-sm font-semibold text-foreground">{sceneBreakCompletedName}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Scene {sceneBreak.completedSceneIndex + 1} of {scenes.length} finished
          </p>
        </div>
      )}

      <div className="max-h-64 overflow-y-auto py-2">
        <div className="space-y-3">
          {completedMessages.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
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
                        : "bg-muted text-foreground"
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isUserMessage ? (
                        <RoleplayAvatarChip
                          imageUrl={studentAvatarUrl}
                          initials={studentInitials}
                          fallback="user"
                          size="sm"
                          className="ring-1 ring-white/30"
                        />
                      ) : (
                        <RoleplayAvatarChip
                          imageUrl={resolveTurnAvatarUrl(
                            message.speaker,
                            aiCharacterAvatars,
                          )}
                          fallback="bot"
                          size="sm"
                        />
                      )}
                      <span className="text-xs font-semibold opacity-90">
                        {displayName}
                      </span>
                    </div>
                    <p className="text-sm">{message.text}</p>
                    {message.translation && (
                      <p className="text-xs mt-1 opacity-75">
                        {message.translation}
                      </p>
                    )}
                    <div
                      className={`mt-2 flex items-center ${
                        isUserMessage ? "justify-end" : "justify-start"
                      }`}
                    >
                      <TTSButton
                        text={message.text}
                        size="sm"
                        audioUrl={message.audioUrl}
                        voiceId={resolveTurnVoiceId(message.speaker)}
                        onPlayStart={stopAllRoleplaySpeech}
                        className={
                          isUserMessage
                            ? "!bg-white/20 !text-white hover:!bg-white/30"
                            : undefined
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {!isEntireDrillComplete && !sceneBreak && currentTurn && (
        <div className="py-2">
          {/* AI Turn - Show loading/playing state */}
          {isAITurn && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-4 relative">
                {(() => {
                  const partnerAvatar = resolveTurnAvatarUrl(
                    currentTurn.speaker,
                    aiCharacterAvatars,
                  );
                  if (isTTSGenerating) {
                    return (
                      <div className="w-20 h-20 bg-gradient-to-br from-sky-500/20 to-indigo-500/20 rounded-full flex items-center justify-center">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                      </div>
                    );
                  }
                  if (isPlayingAI || isTTSPlaying) {
                    return partnerAvatar ? (
                      <div className="relative w-20 h-20">
                        <RoleplayAvatarChip
                          imageUrl={partnerAvatar}
                          fallback="bot"
                          size="lg"
                          className="ring-2 ring-blue-400/50"
                        />
                        <Volume2 className="w-5 h-5 text-blue-600 absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5 animate-pulse" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 bg-gradient-to-br from-sky-500/20 to-indigo-500/20 rounded-full flex items-center justify-center">
                        <Volume2 className="w-10 h-10 text-blue-600 animate-pulse" />
                      </div>
                    );
                  }
                  return partnerAvatar ? (
                    <RoleplayAvatarChip
                      imageUrl={partnerAvatar}
                      fallback="bot"
                      size="lg"
                      className="ring-2 ring-sky-200 mx-auto"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gradient-to-br from-sky-500/20 to-indigo-500/20 rounded-full flex items-center justify-center">
                      <Bot className="w-10 h-10 text-blue-600" />
                    </div>
                  );
                })()}
              </div>
              <p className="text-lg font-semibold text-foreground mb-2">
                {getSpeakerName(currentTurn.speaker)} is speaking...
              </p>
              <div className="bg-blue-50 rounded-xl p-4 max-w-md mx-auto">
                <p className="text-foreground">{currentTurn.text}</p>
                {currentTurn.translation && (
                  <p className="text-sm text-muted-foreground mt-2 italic">{currentTurn.translation}</p>
                )}
              </div>
            </div>
          )}

          {/* Student Turn - Recording Interface */}
          {isStudentTurn && (
            <div className="py-6">
              {/* Character Label */}
              <div className="text-center mb-4">
                <div className="inline-flex items-center gap-2 px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                  <RoleplayAvatarChip
                    imageUrl={studentAvatarUrl}
                    initials={studentInitials}
                    fallback="user"
                    size="sm"
                    className="bg-emerald-600/20 text-emerald-800"
                  />
                  Your turn !
                  {roleMode === "swapped" && (
                    <span className="ml-1 px-2 py-0.5 bg-primary-100 text-primary-600 text-xs rounded-full">
                      Switched
                    </span>
                  )}
                </div>
              </div>

              {/* Text to Speak */}
              <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/25 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Say this line:</p>
                    <TTSButton
                      text={currentTurn.text}
                      size="sm"
                      audioUrl={currentTurn.audioUrl}
                      voiceId={resolveTurnVoiceId(currentTurn.speaker)}
                      stopRef={studentTTSStopRef}
                    />
                  </div>
                </div>
                <p className="text-xl font-semibold text-foreground text-center">
                  "{currentTurn.text}"
                </p>
                {currentTurn.translation && (
                  <p className="text-sm text-muted-foreground text-center mt-2 italic">
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

                {!isRecording && analysisOverlay == null && (
                  <p className="text-sm text-muted-foreground text-center px-2">
                    {awaitingSubmit ? (
                      <span className="text-foreground">
                        Listen in the player, then tap the green send button to submit, or trash to
                        re-record.
                      </span>
                    ) : (
                      <span>Use the microphone fixed at the bottom of the screen to record.</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 pt-1">
        {/* Scene break — between multi-scene transitions */}
        {sceneBreak && (
          <div className="-mx-4 bg-sky-500/10 border-y border-sky-500/20 px-4 py-5 text-center md:-mx-6 md:px-6">
            <CheckCircle className="w-12 h-12 text-sky-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground mb-2">
              Scene complete: {sceneBreakCompletedName}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Great work! Up next: <strong>{sceneBreakNextName}</strong>
            </p>
            <div className="space-y-3">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={advanceToNextScene}
              >
                <ChevronRight className="w-5 h-5 mr-2" />
                Continue to Next Scene
              </Button>
              {progressContext && (
                <>
                  <Button
                    variant="outline"
                    size="lg"
                    fullWidth
                    onClick={() => void saveProgressAndExit()}
                    disabled={isSavingProgress}
                    className="border-border text-foreground hover:bg-muted"
                  >
                    {isSavingProgress ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <Clock className="w-5 h-5 mr-2" />
                    )}
                    Continue Later
                  </Button>
                  <p className="text-xs text-muted-foreground px-2">
                    Save your progress and return from My Plan whenever you&apos;re ready.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Conversation complete - Show Review and Role Switch options */}
        {isEntireDrillComplete && (
          <div className="-mx-4 bg-emerald-500/10 border-y border-emerald-500/20 px-4 py-5 text-center md:-mx-6 md:px-6">
              <PartyPopper className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground mb-2">
                Conversation Complete!
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                Great job completing all your lines as <strong>{currentStudentRole}</strong>!
              </p>

              {/* Role mode indicator */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-card rounded-full text-sm mb-4">
                <User className="w-4 h-4 text-green-600" />
                <span className="text-muted-foreground">You played:</span>
                <span className="font-semibold text-foreground">{currentStudentRole}</span>
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
                <p className="text-xs text-muted-foreground mt-2 text-center px-2">
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
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-200/80 bg-card shadow-sm">
              <Image
                src="/icon.png"
                alt="Eklana"
                width={36}
                height={36}
                className="object-contain"
              />
            </div>
            <div className="min-w-0 w-full">
              <div className="rounded-2xl rounded-tl-md bg-muted px-4 py-3 shadow-sm">
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
                      : void playTTSAudio(prestartTtsText, drillVoiceId)
                  }
                  disabled={isTTSGenerating}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    isTTSPlaying
                      ? "bg-red-100 text-red-600 hover:bg-red-200"
                      : "bg-muted text-muted-foreground hover:bg-muted"
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
              onClick={() => { stopAllRoleplaySpeech(); setSessionStarted(true); }}
              className="w-full rounded-full bg-[#388E3C] px-8 py-4 text-center text-base font-bold text-white shadow-md transition-colors hover:bg-[#2f7a33] active:scale-[0.99]"
            >
              Let&apos;s Get Started
            </button>
          </div>
        </div>
      ) : sessionStarted && isStudentTurn && !isEntireDrillComplete && !sceneBreak && currentTurn && analysisOverlay == null ? (
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
                  isRecording
                    ? "bg-red-500 hover:bg-red-600"
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
                {isRecording ? (
                  <Square className="h-7 w-7 text-white" />
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
      {analysisOverlay ? <RoleplayAnalysisOverlay state={analysisOverlay} /> : null}
    </DrillLayout>
  );
}
