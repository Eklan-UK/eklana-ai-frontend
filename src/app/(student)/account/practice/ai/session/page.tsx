"use client";

import { Suspense, useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Mic,
  Send,
  Loader2,
  Volume2,
  ChevronLeft,
  MoreVertical,
  X,
  RotateCcw,
  Keyboard,
  Home,
  Target,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTTS } from "@/hooks/useTTS";
import { aiService } from "@/services/ai.service";
import { toast } from "sonner";
import { MarkdownText } from "@/components/ui/MarkdownText";
import { useAuthStore } from "@/store/auth-store";
import { getUserInitials } from "@/utils/user";
import Image from "next/image";
import {
  SessionReviewModal,
  type SessionReviewPhase,
} from "@/components/ai/SessionReviewModal";
import type { SessionSummaryPayload } from "@/types/ai-session-summary";
import { releaseMediaStream, unlockAudioContext } from "@/lib/ios-audio-utils";
import {
  parseVocabListParam,
  findVocabularyUsedInText,
  buildFreeTalkSystemInstruction,
  buildFreeTalkVoiceContextPrompt,
} from "@/domain/ai/free-talk";

/* ─── Gemini native audio playback ─────────────────────────────────────────── */

function playBase64Audio(
  base64Data: string,
  mimeType: string = "audio/wav",
  onEnd?: () => void,
  onError?: (err: Error) => void
): HTMLAudioElement | null {
  let settled = false;
  const fail = (err: Error) => {
    if (settled) return;
    settled = true;
    onError?.(err);
  };
  try {
    if (!base64Data || base64Data.length < 100) {
      fail(new Error("Empty audio data"));
      return null;
    }
    const audio = new Audio(`data:${mimeType};base64,${base64Data}`);
    audio.onended = () => { settled = true; onEnd?.(); };
    audio.onerror = () => fail(new Error("Browser could not decode audio"));
    audio.play().catch((err) => fail(err));
    return audio;
  } catch (err: any) {
    fail(err);
    return null;
  }
}

import { AudioStreamPlayer } from "@/lib/audio-stream-player";
import { Mp3QueuePlayer } from "@/lib/mp3-queue-player";
import { tryTakeSpeakableChunk } from "@/lib/tts-chunk-utils";
import { generateTTS } from "@/services/tts.service";

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface ChatMessage {
  type: "ai" | "user";
  text: string;
  isStreaming?: boolean;
}

const DRILL_TYPE_LABELS: Record<string, string> = {
  roleplay: "Roleplay",
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  matching: "Matching",
  definition: "Definition",
  sentence_writing: "Sentence Building",
  fill_blank: "Fill-in-the-Blank",
  summary: "Reading Discussion",
  listening: "Listening",
  sentence: "Sentence",
};

/* ─── Session cache helpers ────────────────────────────────────────────────── */

function getSessionKey(
  drillId: string | null,
  topic: string | null,
  freeTalkTag: string
): string {
  const ft = freeTalkTag ? `-ft-${freeTalkTag}` : "";
  if (drillId) return `ai-session-drill-${drillId}${ft}`;
  if (topic) return `ai-session-topic-${topic}${ft}`;
  return `ai-session-free${ft}`;
}

interface CachedSession {
  messages: Array<{ type: "ai" | "user"; text: string }>;
  conversationHistory: Array<{ role: "user" | "model"; content: string }>;
  drillInfo?: { drillType: string; drillTitle: string } | null;
  masteredVocab?: Record<string, boolean>;
  vocabularySnapshot?: string[];
  timestamp: number;
}

function getCachedSession(key: string): CachedSession | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedSession;
    // Expire after 30 minutes
    if (Date.now() - cached.timestamp > 30 * 60 * 1000) {
      sessionStorage.removeItem(key);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function saveCachedSession(key: string, session: CachedSession) {
  try {
    sessionStorage.setItem(key, JSON.stringify(session));
  } catch {
    // Ignore storage errors
  }
}

function clearCachedSession(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

/** Set when user leaves via "Exit to Home" so remounts in the same tab skip the resume modal. */
function setResumeDismissed(sessionKey: string) {
  try {
    sessionStorage.setItem(`ai-session-exit-${sessionKey}`, "1");
  } catch {
    // Ignore
  }
}

/**
 * Decide whether to show resume prompt. Clears trivial or dismissed cache from storage.
 */
function prepareResumePrompt(sessionKey: string): {
  cached: CachedSession | null;
  showResume: boolean;
} {
  const raw = getCachedSession(sessionKey);
  if (!raw) return { cached: null, showResume: false };
  try {
    if (
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(`ai-session-exit-${sessionKey}`) === "1"
    ) {
      clearCachedSession(sessionKey);
      return { cached: null, showResume: false };
    }
  } catch {
    /* ignore */
  }
  const userTurns = raw.messages.filter((m) => m.type === "user").length;
  if (userTurns === 0 && raw.messages.length <= 1) {
    clearCachedSession(sessionKey);
    return { cached: null, showResume: false };
  }
  return { cached: raw, showResume: true };
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

function AISessionPage() {
  const searchParams = useSearchParams();
  const drillId = searchParams.get("drillId");
  const topic = searchParams.get("topic");
  const scenarioIdParam = searchParams.get("scenarioId");
  const vocabParam = searchParams.get("vocab");
  const scenarioTextParam = searchParams.get("scenarioText");
  const reversedParam = searchParams.get("reversed");
  const isReversed = reversedParam === "1";
  const vocabularyList = useMemo(
    () => parseVocabListParam(vocabParam),
    [vocabParam]
  );
  const scenarioTextDecoded = useMemo(() => {
    if (!scenarioTextParam) return null;
    try {
      return decodeURIComponent(scenarioTextParam);
    } catch {
      return null;
    }
  }, [scenarioTextParam]);
  const freeTalkTag = [scenarioIdParam || "", vocabParam || "", scenarioTextParam || "", isReversed ? "r" : ""].join("::");
  const isDrillPractice = !!drillId;
  const router = useRouter();
  const { user } = useAuthStore();
  const initials = getUserInitials(user);

  const sessionKey = getSessionKey(drillId, topic, freeTalkTag);
  const { cached: preparedCache, showResume: initialShowResume } =
    prepareResumePrompt(sessionKey);
  const cachedSession = useRef(preparedCache);

  const isExiting = useRef(false);
  /** Prevents double navigation if the exit CTA is clicked twice quickly. */
  const finalizeExitOnceRef = useRef(false);
  /** Aborts in-flight session summary when user chooses "Stay in session". */
  const exitSummaryAbortRef = useRef<AbortController | null>(null);
  /** Aborts in-flight AI SSE streams (chat, drill greeting, voice). */
  const streamAbortRef = useRef<AbortController | null>(null);

  // --- Resume prompt state ---
  const [showResumePrompt, setShowResumePrompt] = useState(initialShowResume);

  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [drillInitFailed, setDrillInitFailed] = useState(false);
  const [drillInfo, setDrillInfo] = useState<{ drillType: string; drillTitle: string } | null>(
    preparedCache?.drillInfo ?? null
  );

  const topicGreeting = topic
    ? `Hey! Let's talk about **${topic.replace(/-/g, " ")}**. What's on your mind?`
    : "Hey! I'm here to help you practice English. What would you like to talk about?";

  const freshMessages: ChatMessage[] = isDrillPractice
    ? []
    : [{ type: "ai", text: topicGreeting }];

  const [messages, setMessages] = useState<ChatMessage[]>(
    preparedCache
      ? preparedCache.messages.map((m) => ({ ...m }))
      : freshMessages
  );
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: "user" | "model"; content: string }>
  >(preparedCache?.conversationHistory ?? []);
  const [inputText, setInputText] = useState("");
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [playingMessageIndex, setPlayingMessageIndex] = useState<number | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [streamingAudioActive, setStreamingAudioActive] = useState(false);
  // Text input toggle (default: mic mode, like mobile)
  const [showTextInput, setShowTextInput] = useState(false);
  // Real-time mic amplitude for button animation (0–1)
  const [micAmplitude, setMicAmplitude] = useState(0);
  const [showGoalWords, setShowGoalWords] = useState(false);

  const shouldSendFreeTalkDrillContext = useMemo(
    () =>
      isDrillPractice &&
      (vocabularyList.length > 0 ||
        (scenarioIdParam != null && String(scenarioIdParam).trim() !== "")),
    [isDrillPractice, vocabularyList, scenarioIdParam]
  );

  const freeTalkContextForApi = useMemo(():
    | { scenarioId: string; vocabularyList: string[]; reversed?: boolean }
    | undefined => {
    if (!shouldSendFreeTalkDrillContext) return undefined;
    return {
      scenarioId:
        scenarioIdParam != null && String(scenarioIdParam).trim() !== ""
          ? String(scenarioIdParam)
          : "",
      vocabularyList,
      ...(isReversed ? { reversed: true } : {}),
    };
  }, [shouldSendFreeTalkDrillContext, scenarioIdParam, vocabularyList, isReversed]);

  const freeTalkSystemInstruction = useMemo(
    () =>
      isDrillPractice
        ? null
        : buildFreeTalkSystemInstruction({
            topic,
            scenarioDescription: scenarioTextDecoded,
            vocabularyList,
            reversed: isReversed,
          }),
    [isDrillPractice, topic, scenarioTextDecoded, vocabularyList, isReversed]
  );

  const [masteredVocab, setMasteredVocab] = useState<Record<string, boolean>>(() => {
    const snap = preparedCache?.vocabularySnapshot?.join("|") ?? "";
    if (preparedCache?.masteredVocab && snap === vocabularyList.join("|")) {
      return { ...preparedCache.masteredVocab };
    }
    return {};
  });

  const recordVocabMastery = useCallback(
    (userText: string) => {
      if (vocabularyList.length === 0) return;
      const used = findVocabularyUsedInText(userText, vocabularyList);
      if (used.length === 0) return;
      setMasteredVocab((prev) => {
        const next = { ...prev };
        for (const w of used) next[w] = true;
        return next;
      });
    },
    [vocabularyList]
  );

  /** Post-session AI summary (modal) before leaving */
  const [showExitReview, setShowExitReview] = useState(false);
  const [reviewPhase, setReviewPhase] = useState<SessionReviewPhase>("loading");
  const [reviewSummary, setReviewSummary] = useState<SessionSummaryPayload | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [exitNavigatePath, setExitNavigatePath] = useState("/home");

  // Audio stream reference
  const currentAudioStreamPlayerRef = useRef<AudioStreamPlayer | null>(null);
  const currentMp3QueueRef = useRef<Mp3QueuePlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Voice recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // VAD
  const analyserRef       = useRef<AnalyserNode | null>(null);
  const audioCtxRef       = useRef<AudioContext | null>(null);
  const vadIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastVoiceTsRef    = useRef<number>(0);
  const recStartTsRef     = useRef<number>(0);

  const SILENCE_THRESHOLD = 0.018; // RMS amplitude 0-1
  const SILENCE_MS        = 1800;  // 1.8s — accommodates natural pauses mid-thought
  const MIN_REC_MS        = 2000;  // 2s minimum before silence detection activates

  const startVAD = (stream: MediaStream) => {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ctx      = new AC();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    audioCtxRef.current  = ctx;
    analyserRef.current  = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const now  = Date.now();
    lastVoiceTsRef.current = now;
    recStartTsRef.current  = now;

    vadIntervalRef.current = setInterval(() => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const s = (data[i] - 128) / 128;
        sum += s * s;
      }
      const rms = Math.sqrt(sum / data.length);
      setMicAmplitude(rms);
      if (rms > SILENCE_THRESHOLD) lastVoiceTsRef.current = Date.now();

      const elapsed = Date.now() - recStartTsRef.current;
      if (elapsed > MIN_REC_MS && Date.now() - lastVoiceTsRef.current > SILENCE_MS) {
        stopVAD();
        if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      }
    }, 100);
  };

  const stopVAD = () => {
    if (vadIntervalRef.current) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null; }
    setMicAmplitude(0);
    try { audioCtxRef.current?.close(); } catch { /* ignore */ }
    audioCtxRef.current = null;
    analyserRef.current = null;
  };

  // ElevenLabs TTS (fallback for non-drill mode)
  const {
    playAudio: playTTSAudio,
    isGenerating: isGeneratingTTS,
    isPlaying: isPlayingTTS,
    stopAudio: stopTTSAudio,
  } = useTTS({
    autoPlay: false,
    onPlayStart: () => {},
    onPlayEnd: () => { setPlayingMessageIndex(null); setIsPlayingAudio(false); },
    onError: () => { setPlayingMessageIndex(null); setIsPlayingAudio(false); },
  });

  const isPlaying = isPlayingAudio || isPlayingTTS || streamingAudioActive;

  /* ─── Audio playback ───────────────────────────────────────────────────── */

  const stopAllAudio = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    if (currentAudioStreamPlayerRef.current) {
      currentAudioStreamPlayerRef.current.stop();
      currentAudioStreamPlayerRef.current = null;
    }
    if (currentMp3QueueRef.current) {
      currentMp3QueueRef.current.stop();
      currentMp3QueueRef.current = null;
    }
    stopTTSAudio();
    setPlayingMessageIndex(null);
    setIsPlayingAudio(false);
    setStreamingAudioActive(false);
  }, [stopTTSAudio]);

  const beginNewStream = useCallback(() => {
    streamAbortRef.current?.abort();
    const ac = new AbortController();
    streamAbortRef.current = ac;
    return ac.signal;
  }, []);

  /* ─── Lifecycle ────────────────────────────────────────────────────────── */

  const drillInitRef = useRef(false);

  // Always-current ref for conversationHistory to avoid stale closures in
  // async voice handlers that are created before a state update commits.
  const conversationHistoryRef = useRef(conversationHistory);
  useEffect(() => {
    conversationHistoryRef.current = conversationHistory;
  }, [conversationHistory]);

  const handleRetryDrillInit = useCallback(() => {
    setDrillInitFailed(false);
    drillInitRef.current = false;
    initializeDrillPractice();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize drill session (only if no cached session being resumed)
  useEffect(() => {
    if (isDrillPractice && drillId && !drillInitRef.current && !showResumePrompt) {
      drillInitRef.current = true;
      initializeDrillPractice();
    }
    return () => {
      // Reset guard so StrictMode remount or dependency change can re-initialize
      drillInitRef.current = false;
    };
  }, [drillId, showResumePrompt, freeTalkTag]);

  useEffect(() => {
    if (!isDrillPractice && !showResumePrompt && messages[0]?.type === "ai" && autoPlayAudio) {
      setTimeout(() => {
        playTTSAudio(messages[0].text);
        setPlayingMessageIndex(0);
      }, 300);
    }
  }, [showResumePrompt]);

  useEffect(() => {
    return () => {
      stopAllAudio();
      stopVAD();
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [stopAllAudio]);

  // iOS keyboard pushes content behind the viewport — track visualViewport to compensate
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      if (containerRef.current) {
        containerRef.current.style.height = `${vv.height}px`;
      }
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  // Save session to cache whenever messages change, BUT DO NOT save incomplete streaming text
  useEffect(() => {
    if (messages.length > 0 && !showResumePrompt && !messages[messages.length - 1].isStreaming) {
      saveCachedSession(sessionKey, {
        messages: messages.map((m) => ({ type: m.type, text: m.text })),
        conversationHistory,
        drillInfo,
        masteredVocab,
        vocabularySnapshot: vocabularyList,
        timestamp: Date.now(),
      });
    }
  }, [
    messages,
    conversationHistory,
    drillInfo,
    sessionKey,
    showResumePrompt,
    masteredVocab,
    vocabularyList,
  ]);

  /* ─── Resume / New session handlers ────────────────────────────────────── */

  const handleResumeSession = () => {
    setShowResumePrompt(false);
    // Messages already loaded from cache
  };

  const handleNewSession = () => {
    clearCachedSession(sessionKey);
    cachedSession.current = null;
    setShowResumePrompt(false);
    setMessages(freshMessages);
    setConversationHistory([]);
    setDrillInfo(null);
    setMasteredVocab({});
    drillInitRef.current = false;
    if (isDrillPractice) {
      initializeDrillPractice();
    }
  };

  const finalizeExitToPath = useCallback(
    (path: string) => {
      if (finalizeExitOnceRef.current) return;
      finalizeExitOnceRef.current = true;
      isExiting.current = true;
      stopAllAudio();
      exitSummaryAbortRef.current?.abort();
      exitSummaryAbortRef.current = null;
      setResumeDismissed(sessionKey);
      clearCachedSession(sessionKey);
      cachedSession.current = null;
      setShowResumePrompt(false);
      setShowExitReview(false);
      setReviewPhase("loading");
      setReviewSummary(null);
      setReviewError(null);
      router.replace(path);
    },
    [sessionKey, router, stopAllAudio],
  );

  const handleFinalizeExit = useCallback(() => {
    finalizeExitToPath(exitNavigatePath);
  }, [finalizeExitToPath, exitNavigatePath]);

  const handleStayInSession = useCallback(() => {
    exitSummaryAbortRef.current?.abort();
    exitSummaryAbortRef.current = null;
    isExiting.current = false;
    setShowExitReview(false);
    setReviewPhase("loading");
    setReviewSummary(null);
    setReviewError(null);
  }, []);

  /**
   * Request linguistic summary, show modal, then user confirms navigation.
   * Skips AI when the student never spoke (no user turns) — see reviewPhase "skipped".
   */
  const beginExitFlow = useCallback(
    async (targetPath: string) => {
      exitSummaryAbortRef.current?.abort();
      const ac = new AbortController();
      exitSummaryAbortRef.current = ac;

      isExiting.current = true;
      stopAllAudio();
      setShowMenu(false);
      setExitNavigatePath(targetPath);
      setShowResumePrompt(false);
      setReviewError(null);
      setReviewSummary(null);

      const snapshot = [...conversationHistory];
      const userTurns = snapshot.filter((m) => m.role === "user").length;

      setShowExitReview(true);

      if (userTurns === 0) {
        setReviewPhase("skipped");
        exitSummaryAbortRef.current = null;
        return;
      }

      setReviewPhase("loading");
      try {
        const mode = isDrillPractice ? "drill" : topic ? "topic" : "free";
        const focusLabel = isDrillPractice && drillInfo
          ? `${DRILL_TYPE_LABELS[drillInfo.drillType] || "Practice"} · ${drillInfo.drillTitle}`
          : topic
            ? topic === "pressure-test"
              ? "Ekln Pressure Test — respond quickly under light time pressure"
              : `Topic practice: ${topic.replace(/-/g, " ")}`
            : undefined;

        const res = await fetch("/api/v1/ai/session/summary", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            messages: snapshot,
            mode,
            ...(topic ? { topic } : {}),
            ...(drillId ? { drillId } : {}),
            ...(focusLabel ? { focusLabel } : {}),
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (ac.signal.aborted) return;
        if (!res.ok) {
          throw new Error(
            typeof json?.message === "string" ? json.message : "Summary failed",
          );
        }
        const summary = json?.data?.summary as SessionSummaryPayload | undefined;
        setReviewSummary(summary ?? null);
        setReviewPhase("done");
        setResumeDismissed(sessionKey);
        clearCachedSession(sessionKey);
        cachedSession.current = null;
      } catch (e: unknown) {
        if (ac.signal.aborted) return;
        setReviewPhase("error");
        setReviewError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (exitSummaryAbortRef.current === ac) {
          exitSummaryAbortRef.current = null;
        }
      }
    },
    [conversationHistory, sessionKey, drillId, topic, isDrillPractice, drillInfo, stopAllAudio],
  );

  /** Resume prompt: one tap → home (replace), no review modal. */
  const handleFinalExit = useCallback(() => {
    finalizeExitToPath("/home");
  }, [finalizeExitToPath]);

  /* ─── Drill init ───────────────────────────────────────────────────────── */

  const initializeDrillPractice = async () => {
    setIsInitializing(true);
    setMessages([{ type: "ai", text: "", isStreaming: true }]);
    setPlayingMessageIndex(0);

    let finalGreeting = "";
    const audioPlayer = new AudioStreamPlayer(() => {
       setStreamingAudioActive(false);
       setPlayingMessageIndex(null);
    });
    
    currentAudioStreamPlayerRef.current = audioPlayer;
    setStreamingAudioActive(true);

    try {
      const signal = beginNewStream();
      await aiService.streamDrillPracticeGreeting(
        drillId!,
        (chunk) => {
        setIsInitializing(false);

        if (chunk.type === "metadata") {
          setDrillInfo({ drillType: chunk.data.drillType, drillTitle: chunk.data.drillTitle });
        } else if (chunk.type === "text") {
          finalGreeting += chunk.data;
          setMessages([
            {
              type: "ai",
              text: finalGreeting,
              isStreaming: true
            }
          ]);
        } else if (chunk.type === "audio" && autoPlayAudio) {
          audioPlayer.enqueueBase64Pcm(chunk.data);
        }
      },
        signal,
        shouldSendFreeTalkDrillContext ? freeTalkContextForApi : undefined
      );
      
      setMessages([
        {
          type: "ai",
          text: finalGreeting,
          isStreaming: false
        }
      ]);
      setConversationHistory([{ role: "model", content: finalGreeting }]);
    } catch (e: unknown) {
      const isAbort = (e as { name?: string })?.name === "AbortError";
      if (isAbort) {
        if (!isExiting.current) {
          // StrictMode / unexpected abort — reset state so the effect can re-initialize
          drillInitRef.current = false;
          setMessages([]);
        }
        return;
      }
      console.error("[DrillInit] Failed to load drill greeting:", e);
      const fallback = "Alright! Let's get started with your practice. I've got exercises ready for you!";
      setMessages([{ type: "ai", text: fallback, isStreaming: false }]);
      setConversationHistory([{ role: "model", content: fallback }]);
      setDrillInitFailed(true);
    } finally {
      setIsInitializing(false);
      setStreamingAudioActive(false);
      setPlayingMessageIndex(null);
    }
  };

  /* ─── Send message ─────────────────────────────────────────────────────── */

  const handleSendText = async (text: string) => {
    unlockAudioContext(currentAudioStreamPlayerRef.current?.getAudioContext() ?? null);
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    recordVocabMastery(trimmed);

    const userMessage: ChatMessage = { type: "user", text: trimmed };
    const aiMessagePlaceholder: ChatMessage = { type: "ai", text: "", isStreaming: true };
    const aiMessageIndex = messages.length + 1; // 0-indexed: current length (includes user message)
    
    setMessages((prev) => [...prev, userMessage, aiMessagePlaceholder]);
    setInputText("");
    setIsThinking(true);
    stopAllAudio(); // interrupt anything currently playing
    const streamSignal = beginNewStream();

    try {
      if (isDrillPractice && drillId) {
        const newHistory = [...conversationHistory, { role: "user" as const, content: trimmed }];
        let finalResponse = "";

        const audioPlayer = new AudioStreamPlayer(() => {
          setStreamingAudioActive(false);
          setPlayingMessageIndex(null);
        });
        
        currentAudioStreamPlayerRef.current = audioPlayer;
        setStreamingAudioActive(true);
        setPlayingMessageIndex(aiMessageIndex);

        await aiService.streamDrillPracticeMessage({
          drillId,
          userMessage: trimmed,
          conversationHistory: newHistory,
          signal: streamSignal,
          ...(shouldSendFreeTalkDrillContext && freeTalkContextForApi
            ? { freeTalkContext: freeTalkContextForApi }
            : {}),
        }, (chunk) => {
          setIsThinking(false);

          if (chunk.type === "text") {
             finalResponse += chunk.data;
             setMessages(prev => prev.map((m, i) => i === aiMessageIndex ? { ...m, text: finalResponse } : m));
          } else if (chunk.type === "audio" && autoPlayAudio) {
             audioPlayer.enqueueBase64Pcm(chunk.data);
          }
        });

        // Mark stream complete
        setMessages(prev => prev.map((m, i) => i === aiMessageIndex ? { ...m, isStreaming: false, text: finalResponse } : m));
        setConversationHistory([...newHistory, { role: "model", content: finalResponse }]);
      } else {
        // Free Talk typed: SSE chat + chunked ElevenLabs (low-latency model on server)
        const conversationMessages = messages.map((msg) => ({
          role: msg.type === "user" ? ("user" as const) : ("model" as const),
          content: msg.text,
        }));
        conversationMessages.push({ role: "user" as const, content: trimmed });
        const newHistory = [
          ...conversationHistory,
          { role: "user" as const, content: trimmed },
        ];

        let finalResponse = "";
        let pendingTts = "";

        const mp3 =
          autoPlayAudio
            ? new Mp3QueuePlayer(() => {
                setStreamingAudioActive(false);
                setPlayingMessageIndex(null);
                currentMp3QueueRef.current = null;
              })
            : null;
        if (mp3) {
          currentMp3QueueRef.current = mp3;
          setStreamingAudioActive(true);
          setPlayingMessageIndex(aiMessageIndex);
        }

        /**
         * Concurrent TTS: all generateTTS fetches start immediately in parallel
         * so phrase N+1's network request doesn't wait for phrase N to finish.
         * The flush chain guarantees Mp3QueuePlayer receives blobs in order.
         */
        const pendingTtsPromises: Promise<Blob>[] = [];
        let ttsFlushChain: Promise<void> = Promise.resolve();
        const enqueueTts = (text: string) => {
          if (!mp3 || !text.trim()) return;
          const phrase = text.trim();
          // Fire fetch immediately (parallel with any in-flight phrases).
          const blobPromise = generateTTS({ text: phrase });
          pendingTtsPromises.push(blobPromise);
          // Flush in strict arrival order so playback sequence is preserved.
          ttsFlushChain = ttsFlushChain.then(async () => {
            const promise = pendingTtsPromises.shift();
            if (!promise) return;
            try {
              const blob = await promise;
              mp3.enqueue(blob);
            } catch (e: any) {
              toast.error("Failed to generate speech for a phrase");
            }
          }).catch(() => {});
        };

        await aiService.streamConversationMessage(
          {
            messages: conversationMessages,
            temperature: 0.7,
            maxTokens: 350,
            signal: streamSignal,
            ...(freeTalkSystemInstruction
              ? { systemInstruction: freeTalkSystemInstruction }
              : {}),
          },
          (chunk) => {
            if (chunk.type === "text" && typeof chunk.data === "string") {
              const piece = chunk.data;
              finalResponse += piece;
              setIsThinking(false);
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === aiMessageIndex ? { ...m, text: finalResponse } : m
                )
              );
              pendingTts += piece;
              while (autoPlayAudio && mp3) {
                const taken = tryTakeSpeakableChunk(pendingTts);
                if (!taken) break;
                pendingTts = taken.rest;
                enqueueTts(taken.spoken);
              }
            } else if (chunk.type === "done") {
              let p = pendingTts;
              while (autoPlayAudio && mp3) {
                const t = tryTakeSpeakableChunk(p);
                if (!t) break;
                p = t.rest;
                enqueueTts(t.spoken);
              }
              const tail = p.trim();
              if (tail && autoPlayAudio && mp3) enqueueTts(tail);
            }
          }
        );

        setMessages((prev) =>
          prev.map((m, i) =>
            i === aiMessageIndex
              ? { type: "ai", text: finalResponse, isStreaming: false }
              : m
          )
        );
        setConversationHistory([
          ...newHistory,
          { role: "model", content: finalResponse },
        ]);
      }

    } catch (error: unknown) {
      if ((error as { name?: string })?.name === "AbortError") {
        return;
      }
      const message =
        error instanceof Error ? error.message : "Failed to get AI response";
      toast.error(message || "Failed to get AI response");
      setIsThinking(false);
      setStreamingAudioActive(false);
      setPlayingMessageIndex(null);
      currentMp3QueueRef.current?.stop();
      currentMp3QueueRef.current = null;
      // Remove placeholder & user message
      setMessages((prev) => prev.slice(0, -2));
      setInputText(trimmed);
    }
  };

  const handleSend = () => handleSendText(inputText);

  /* ─── Voice recording ──────────────────────────────────────────────────── */

  const startVoiceRecording = useCallback(async () => {
    try {
      unlockAudioContext(currentAudioStreamPlayerRef.current?.getAudioContext() ?? null);
      stopAllAudio();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      startVAD(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        if (audioBlob.size < 1000) {
          toast.error("Recording too short. Please try again.");
          setIsRecording(false);
          return;
        }
        setIsTranscribing(true);
        setIsRecording(false);

        // Add placeholder user + streaming AI message immediately.
        const userMessageIndex = messages.length;
        const aiMessageIndex = messages.length + 1; // 0-indexed: current length (includes user message)
        const userMessage: ChatMessage = { type: "user", text: "🎤 [Voice message]" };
        const aiMessagePlaceholder: ChatMessage = { type: "ai", text: "", isStreaming: true };

        setMessages((prev) => [...prev, userMessage, aiMessagePlaceholder]);
        stopAllAudio(); // interrupt anything currently playing
        const streamSignal = beginNewStream();

        const historyBeforeTurn = messages.map((m) => ({
          role: m.type === "user" ? ("user" as const) : ("model" as const),
          content: m.text,
        }));

        const drillHistoryBeforeTurn = conversationHistoryRef.current;

        let finalResponse = "";
        let fullTextMeta = "";
        let inputTextMeta = "";

        let didReceiveFirstChunk = false;
        setIsThinking(true);
        setStreamingAudioActive(true);
        setPlayingMessageIndex(aiMessageIndex);

        const audioPlayer = new AudioStreamPlayer(() => {
          setStreamingAudioActive(false);
          setPlayingMessageIndex(null);
        });
        currentAudioStreamPlayerRef.current = audioPlayer;

        try {
          if (isDrillPractice && drillId) {
            await aiService.streamDrillPracticeVoiceMessage(
              {
                drillId,
                audioBlob,
                conversationHistory: drillHistoryBeforeTurn,
                signal: streamSignal,
                ...(shouldSendFreeTalkDrillContext && freeTalkContextForApi
                  ? { freeTalkContext: freeTalkContextForApi }
                  : {}),
              },
              (chunk) => {
                if (!didReceiveFirstChunk) {
                  didReceiveFirstChunk = true;
                  setIsThinking(false);
                  setIsTranscribing(false);
                }

                if (chunk.type === "text") {
                  finalResponse += chunk.data;
                  setMessages((prev) =>
                    prev.map((m, i) =>
                      i === aiMessageIndex ? { ...m, text: finalResponse } : m
                    )
                  );
                } else if (chunk.type === "audio" && autoPlayAudio) {
                  audioPlayer.enqueueBase64Pcm(chunk.data);
                } else if (chunk.type === "metadata") {
                  inputTextMeta =
                    typeof chunk.data?.inputText === "string"
                      ? chunk.data.inputText
                      : "";
                  fullTextMeta =
                    typeof chunk.data?.fullText === "string" ? chunk.data.fullText : "";

                  setMessages((prev) =>
                    prev.map((m, i) => {
                      if (i === userMessageIndex) {
                        return {
                          ...m,
                          text: inputTextMeta
                            ? `🎤 [Voice] ${inputTextMeta}`
                            : "🎤 [Voice message]",
                        };
                      }
                      if (i === aiMessageIndex && fullTextMeta) {
                        return { ...m, text: fullTextMeta };
                      }
                      return m;
                    })
                  );
                }
              }
            );

            // Signal that all audio chunks have been sent; if none were queued
            // this fires onEndedCallback immediately so "Speaking…" clears.
            audioPlayer.signalStreamEnd();

            setMessages((prev) =>
              prev.map((m, i) =>
                i === aiMessageIndex
                  ? {
                      ...m,
                      isStreaming: false,
                      text: fullTextMeta || finalResponse,
                    }
                  : m
              )
            );

            setConversationHistory([
              ...drillHistoryBeforeTurn,
              { role: "user", content: inputTextMeta || "[Voice message]" },
              { role: "model", content: fullTextMeta || finalResponse },
            ]);
            if (inputTextMeta) recordVocabMastery(inputTextMeta);
          } else {
            // Free talk voice: use Live API + built-in transcription.
            const contextPrompt = buildFreeTalkVoiceContextPrompt({
              topic,
              scenarioDescription: scenarioTextDecoded,
              vocabularyList,
              reversed: isReversed,
            });

            await aiService.streamVoiceConversationMessage(
              {
                audioBlob,
                conversationHistory: historyBeforeTurn,
                context: contextPrompt,
                signal: streamSignal,
              },
              (chunk) => {
                if (!didReceiveFirstChunk) {
                  didReceiveFirstChunk = true;
                  setIsThinking(false);
                  setIsTranscribing(false);
                }

                if (chunk.type === "text") {
                  finalResponse += chunk.data;
                  setMessages((prev) =>
                    prev.map((m, i) =>
                      i === aiMessageIndex ? { ...m, text: finalResponse } : m
                    )
                  );
                } else if (chunk.type === "audio" && autoPlayAudio) {
                  audioPlayer.enqueueBase64Pcm(chunk.data);
                } else if (chunk.type === "metadata") {
                  inputTextMeta =
                    typeof chunk.data?.inputText === "string"
                      ? chunk.data.inputText
                      : "";
                  fullTextMeta =
                    typeof chunk.data?.fullText === "string" ? chunk.data.fullText : "";

                  // Surface Gemini-side errors (e.g. timeout_no_response) so the user
                  // knows something went wrong instead of seeing a frozen placeholder.
                  if (chunk.data?.error) {
                    const errStr = String(chunk.data.error);
                    const isTimeout = errStr.includes("timeout");
                    toast.error(
                      isTimeout
                        ? "Your message was too long. Please try speaking in shorter sentences."
                        : "Voice processing failed. Please try again."
                    );
                  }

                  // Free Talk: keep user bubble as a plain voice note — no transcription shown.
                  // AI message is updated if the server returns a pre-formed full reply.
                  if (fullTextMeta) {
                    setMessages((prev) =>
                      prev.map((m, i) =>
                        i === aiMessageIndex ? { ...m, text: fullTextMeta } : m
                      )
                    );
                  }
                }
              }
            );

            // Signal that all audio chunks have been sent; if none were queued
            // this fires onEndedCallback immediately so "Speaking…" clears.
            audioPlayer.signalStreamEnd();

            setMessages((prev) =>
              prev.map((m, i) =>
                i === aiMessageIndex
                  ? {
                      ...m,
                      isStreaming: false,
                      text: fullTextMeta || finalResponse,
                    }
                  : m
              )
            );

            setConversationHistory([
              ...historyBeforeTurn,
              { role: "user", content: inputTextMeta || "[Voice message]" },
              { role: "model", content: fullTextMeta || finalResponse },
            ]);
            if (inputTextMeta) recordVocabMastery(inputTextMeta);
          }
        } catch (err: unknown) {
          if ((err as { name?: string })?.name === "AbortError") {
            return;
          }
          const message =
            err instanceof Error ? err.message : "Failed to process voice.";
          toast.error(
            message || "Failed to process voice. Try using the keyboard instead.",
          );
          setIsThinking(false);
          setIsTranscribing(false);
          setStreamingAudioActive(false);
          setPlayingMessageIndex(null);
          // Remove placeholder user + AI message
          setMessages((prev) => prev.slice(0, -2));
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error: any) {
      if (error.name === "NotAllowedError") {
        toast.error("Microphone access denied. Please allow microphone permissions.");
      } else {
        toast.error("Failed to access microphone: " + error.message);
      }
    }
  }, [stopAllAudio, handleSendText, beginNewStream]);

  const stopVoiceRecording = useCallback(() => {
    stopVAD();
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    releaseMediaStream(mediaStreamRef.current);
    mediaStreamRef.current = null;
  }, []);

  const toggleVoiceRecording = useCallback(() => {
    if (isRecording) stopVoiceRecording();
    else startVoiceRecording();
  }, [isRecording, startVoiceRecording, stopVoiceRecording]);

  /* ─── Helpers ──────────────────────────────────────────────────────────── */

  const subtitle = isDrillPractice && drillInfo
    ? `${DRILL_TYPE_LABELS[drillInfo.drillType] || "Practice"} · ${drillInfo.drillTitle}`
    : "English conversation practice";

  /* ─── Resume Prompt ────────────────────────────────────────────────────── */

  if (showResumePrompt && !isExiting.current) {
    const cachedMsgCount = cachedSession.current?.messages.length ?? 0;

    return (
      <div className="flex flex-col h-[100vh] bg-gray-50 dark:bg-[#0c0e0d] items-center justify-center px-6">
        <div className="bg-white dark:bg-[#131614] rounded-3xl shadow-lg p-6 max-w-sm w-full text-center">
          {/* Icon */}
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Image src="/logo2.svg" alt="Eklan" width={32} height={32} />
          </div>

          <h2 className="text-lg font-bold font-nunito text-gray-900 dark:text-[#f0f2f1] mb-1">
            Continue previous session?
          </h2>
          <p className="text-sm font-satoshi text-gray-500 dark:text-[#9aa39e] mb-6">
            You have {cachedMsgCount} message{cachedMsgCount !== 1 ? "s" : ""} from an earlier conversation.
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleResumeSession}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-2xl transition-colors"
            >
              Continue session
            </button>
            <button
              type="button"
              onClick={handleNewSession}
              className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-[#1a1d1c] dark:hover:bg-[#232724] text-gray-700 dark:text-[#c8cdc9] font-semibold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Start fresh
            </button>
            <button
              type="button"
              onClick={handleFinalExit}
              className="w-full border border-gray-200 dark:border-[#2a2e2c] hover:bg-gray-50 dark:hover:bg-[#1a1d1c] text-gray-800 dark:text-[#c8cdc9] font-semibold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Exit to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Render ───────────────────────────────────────────────────────────── */

  return (
    <div ref={containerRef} className="relative flex flex-col h-[100dvh] bg-gray-50 dark:bg-[#0c0e0d]">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white dark:bg-[#131614] border-b border-gray-100 dark:border-[#2a2e2c]">
        <div className="flex items-center px-4 py-3 max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => {
              void beginExitFlow("/account/practice/ai");
            }}
            className="p-2.5 -ml-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#1a1d1c] transition-colors"
            aria-label="Leave session"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-[#9aa39e]" />
          </button>

          <div className="flex items-center flex-1 ml-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <Image src="/logo2.svg" alt="Eklan" width={24} height={24} />
            </div>
            <div className="ml-3 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <h1 className="text-sm font-semibold text-gray-900 dark:text-[#f0f2f1] truncate">
                  {isDrillPractice ? "Eklan" : "AI Partner"}
                </h1>
                {isReversed && (
                  <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                    You&apos;re the teacher
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-[#9aa39e] truncate">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            {vocabularyList.length > 0 && (
              <button
                type="button"
                onClick={() => setShowGoalWords((s) => !s)}
                className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#1a1d1c] transition-colors"
                aria-label="Goal words"
                title="Goal words"
              >
                <Target className="w-5 h-5 text-emerald-600" />
              </button>
            )}
            <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#1a1d1c] transition-colors"
            >
              <MoreVertical className="w-5 h-5 text-gray-500 dark:text-[#9aa39e]" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-10 z-40 w-48 bg-white dark:bg-[#1a1d1c] rounded-xl shadow-lg border border-gray-100 dark:border-[#2a2e2c] py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    onClick={() => { setAutoPlayAudio(!autoPlayAudio); setShowMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-[#c8cdc9] hover:bg-gray-50 dark:hover:bg-[#232724] transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Auto-play {autoPlayAudio ? "on" : "off"}</span>
                    <div className={`ml-auto w-8 h-5 rounded-full flex items-center transition-colors ${autoPlayAudio ? "bg-emerald-500 justify-end" : "bg-gray-300 dark:bg-[#3a3e3c] justify-start"}`}>
                      <div className="w-4 h-4 bg-white rounded-full shadow mx-0.5" />
                    </div>
                  </button>
                  <div className="h-px bg-gray-100 dark:bg-[#2a2e2c] mx-2" />
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      void beginExitFlow("/account/practice/ai");
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span>End session</span>
                  </button>
                </div>
              </>
            )}
            </div>
          </div>
        </div>
      </header>

      {showGoalWords && vocabularyList.length > 0 && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setShowGoalWords(false)}
            aria-label="Close goal words"
          />
          <aside
            className="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-white dark:bg-[#131614] shadow-xl border-l border-gray-100 dark:border-[#2a2e2c] flex flex-col"
            role="dialog"
            aria-label="Goal words"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#2a2e2c]">
              <h2 className="text-sm font-bold text-gray-900 dark:text-[#f0f2f1]">Goal words</h2>
              <button
                type="button"
                onClick={() => setShowGoalWords(false)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#1a1d1c]"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-[#9aa39e]" />
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto p-4 space-y-2">
              {vocabularyList.map((w) => (
                <li
                  key={w}
                  className={
                    masteredVocab[w]
                      ? "text-sm line-through text-emerald-600/90"
                      : "text-sm font-medium text-gray-800 dark:text-[#c8cdc9]"
                  }
                >
                  {w}
                </li>
              ))}
            </ul>
            <p className="p-3 text-xs text-gray-500 dark:text-[#9aa39e] border-t border-gray-100 dark:border-[#2a2e2c]">
              Say a target word in chat to mark it as mastered.
            </p>
          </aside>
        </>
      )}

      {/* ── Initialization overlay (matches mobile) ────────────────────── */}
      {isInitializing && (
        <div className="absolute inset-0 z-30 bg-white dark:bg-[#0c0e0d] flex flex-col items-center justify-center px-8">
          {/* Logo bubble */}
          <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mb-6 shadow-lg">
            <Image src="/logo2.svg" alt="Eklan" width={52} height={52} />
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-[#f0f2f1] mb-2 font-nunito">Getting ready…</h2>
          <p className="text-sm text-gray-400 dark:text-[#6b7270] text-center max-w-xs mb-10">
            Eklan is personalising your session. This only takes a moment.
          </p>

          {/* Bouncing dots — mirrors mobile Loader */}
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          {/* Date pill */}
          <div className="flex justify-center">
            <span className="text-[11px] text-gray-400 dark:text-[#6b7270] bg-white/80 dark:bg-[#131614]/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
              Today
            </span>
          </div>

           {messages.map((message, index) => {
            const isAI = message.type === "ai";
            const isCurrentlyPlaying = playingMessageIndex === index && isPlaying;

            return isAI ? (
              <div key={index} className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <Image src="/logo2.svg" alt="Eklan" width={28} height={28} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-gray-100 dark:bg-[#1a1d1c] rounded-2xl rounded-tl-sm px-4 py-3 max-w-[92%] sm:max-w-[85%]">
                    {message.isStreaming && !message.text.trim() ? (
                      <div className="flex gap-1 py-0.5">
                        <div className="w-2 h-2 bg-gray-400 dark:bg-[#5a5e5c] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 bg-gray-400 dark:bg-[#5a5e5c] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 bg-gray-400 dark:bg-[#5a5e5c] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    ) : (
                      <>
                        <MarkdownText className="text-sm text-gray-900 dark:text-[#e8ebe9] leading-relaxed">
                          {message.text}
                        </MarkdownText>
                        {message.isStreaming && (
                          <span className="inline-block w-1.5 h-4 ml-1 bg-emerald-500 animate-pulse align-middle" />
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 ml-1">
                    {isCurrentlyPlaying && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Volume2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-600 text-xs font-medium">Speaking...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div key={index} className="flex items-start justify-end gap-3 mb-4">
                <div className="max-w-[92%] sm:max-w-[85%]">
                  <div className="bg-emerald-600 rounded-2xl rounded-tr-sm px-4 py-3">
                    <p className="text-sm text-white leading-relaxed">{message.text}</p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {user?.avatar ? (
                    <Image src={user.avatar} alt="You" width={40} height={40} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-sm font-bold">{initials}</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Drill init failed — retry CTA */}
          {drillInitFailed && (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-xs text-gray-400 text-center">
                Could not connect to the session. Check your internet and try again.
              </p>
              <button
                type="button"
                onClick={handleRetryDrillInit}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                Retry
              </button>
            </div>
          )}


          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* ── Bottom controls — mirrors mobile layout ─────────────────────── */}
      <footer className="sticky bottom-0 bg-white dark:bg-[#131614] border-t border-gray-100 dark:border-[#2a2e2c]">

        {/* voice-stop feedback: processing only (until first chunk) */}


        {showTextInput ? (
          /* ── Text input mode ── */
          <div className="max-w-2xl mx-auto px-3 py-2.5 flex items-end gap-2">
            {/* Back to mic */}
            <button
              onClick={() => setShowTextInput(false)}
              className="w-12 h-12 rounded-full bg-slate-50 dark:bg-[#1a1d1c] border border-slate-200 dark:border-[#2a2e2c] flex items-center justify-center flex-shrink-0 hover:bg-slate-100 dark:hover:bg-[#232724] transition-colors"
            >
              <Mic className="w-5 h-5 text-slate-500 dark:text-[#9aa39e]" />
            </button>

            <textarea
              ref={inputRef}
              rows={1}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Type a message…"
              disabled={isInitializing || isThinking}
              autoFocus
              className="flex-1 bg-gray-100 dark:bg-[#1a1d1c] rounded-2xl px-4 py-2.5 text-base text-gray-900 dark:text-[#f0f2f1] placeholder-gray-400 dark:placeholder-[#6b7270] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:bg-white dark:focus:bg-[#232724] transition-all disabled:opacity-50 resize-none leading-relaxed"
              style={{ maxHeight: 120 }}
            />

            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isThinking || isInitializing}
              className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
            >
              <Send className="w-5 h-5 text-white ml-0.5" />
            </button>
          </div>
        ) : (
          /* ── Mic mode (default) ── */
          <div className="max-w-2xl mx-auto pt-3 pb-2">
            <div className="flex items-end justify-center gap-0">

              {/* Keyboard toggle (left) */}
              <button
                onClick={() => setShowTextInput(true)}
                disabled={isThinking || isInitializing}
                className="w-12 h-12 rounded-full bg-slate-50 dark:bg-[#1a1d1c] border border-slate-200 dark:border-[#2a2e2c] flex items-center justify-center mr-10 hover:bg-slate-100 dark:hover:bg-[#232724] transition-colors disabled:opacity-40"
              >
                <Keyboard className="w-5 h-5 text-slate-500 dark:text-[#9aa39e]" />
              </button>

              {/* Large mic button with pulse rings */}
              <div className="relative w-20 h-20 flex items-center justify-center">
                {/* Expanding pulse ring */}
                {isRecording && (
                  <div
                    className="absolute inset-0 rounded-full bg-red-400 animate-ping"
                    style={{ opacity: 0.35 }}
                  />
                )}
                {/* Amplitude scale ring */}
                {isRecording && micAmplitude > 0.01 && (
                  <div
                    className="absolute inset-0 rounded-full bg-red-300 transition-transform duration-75"
                    style={{
                      transform: `scale(${1 + micAmplitude * 1.8})`,
                      opacity: Math.min(0.5, micAmplitude * 3),
                    }}
                  />
                )}
                <button
                  onClick={toggleVoiceRecording}
                  disabled={isThinking || isInitializing || isTranscribing}
                  style={{
                    transform: isRecording ? `scale(${1 + micAmplitude * 0.25})` : "scale(1)",
                    transition: "transform 80ms ease-out",
                  }}
                  className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    isRecording
                      ? "bg-red-500 hover:bg-red-600"
                      : isThinking || isInitializing
                      ? "bg-gray-300"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  <Mic className="w-8 h-8 text-white" />
                </button>
              </div>

              {/* Symmetry spacer */}
              <div className="w-12 h-12 ml-10" />
            </div>

            {/* Hint text */}
            <p className="text-center text-xs text-gray-400 dark:text-[#6b7270] mt-2 mb-1">
              {isRecording ? "Tap to stop · silence auto-stops" : "Tap to speak"}
            </p>
          </div>
        )}

        <div className="h-[env(safe-area-inset-bottom)]" />
      </footer>

      <SessionReviewModal
        open={showExitReview}
        phase={reviewPhase}
        summary={reviewSummary}
        errorMessage={reviewError ?? undefined}
        primaryCtaLabel={
          exitNavigatePath === "/home" ? "Back to Home" : "Back to Free Talk"
        }
        onBackToHome={handleFinalizeExit}
        onStayInSession={handleStayInSession}
      />
    </div>
  );
}

export default function AISessionPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex flex-col h-[100dvh] items-center justify-center bg-gray-50 dark:bg-[#0c0e0d]">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center animate-pulse" />
      </div>
    }>
      <AISessionPage />
    </Suspense>
  );
}
