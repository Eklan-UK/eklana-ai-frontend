"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Languages,
  Mic,
  MoreVertical,
  Play,
  Send,
  Square,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useDrill } from "@/hooks/useDrills";
import { useTTS } from "@/hooks/useTTS";
import { useAuthStore } from "@/store/auth-store";
import { LessonReview } from "@/components/ai/LessonReview";

type ChatRole = "ai" | "user";

interface Message {
  role: ChatRole;
  text: string;
}

interface TurnDraft {
  turnNumber: number;
  aiPrompt: string;
  studentResponseText: string;
  latencyMs: number;
  /** True when mental-translation gap (stream end → first speech or record start) is strictly &lt; PRESSURE_SPEED_MS. */
  speedSuccess: boolean;
  scenarioId: string;
  audioDurationMs: number;
  audioBase64: string;
}

interface PressureTestDrillProps {
  drillId: string;
  /** Changes for each new run (URL `run`, bfcache); restarts the scenario from the intro. */
  sessionRunId: string;
}

const TOTAL_TURNS = 3;
const MAX_AUDIO_SIZE = 5 * 1024 * 1024;
/** Namespaced client keys for this drill; cleared on exit / analyze so a new run never reuses cached turn data. */
const PT_DRILL_CACHE_PREFIX = "eklana:pt:";

function clearPressureTestDrillClientCache(drillId: string) {
  if (typeof window === "undefined") return;
  const strip = (store: Storage) => {
    for (let i = store.length - 1; i >= 0; i--) {
      const k = store.key(i);
      if (k && k.startsWith(PT_DRILL_CACHE_PREFIX) && k.includes(drillId)) {
        try {
          store.removeItem(k);
        } catch {
          /* ignore */
        }
      }
    }
  };
  try {
    strip(localStorage);
    strip(sessionStorage);
  } catch {
    /* private mode / quota */
  }
}
/** Mental-translation gap target: under this many ms = fast (client-only rule; 2000 = not fast). */
const PRESSURE_SPEED_MS = 2000;

function PressureTestAiThinkingBubble() {
  return (
    <div className="flex justify-start" role="status" aria-live="polite" aria-label="Eklan is thinking">
      <div className="inline-flex max-w-[85%] items-center gap-1.5 rounded-2xl border border-[#ebebeb] dark:border-[#2a2e2c] bg-[#f4f5f4] dark:bg-[#1a1d1c] px-4 py-3 min-h-[2.5rem] shadow-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-500/90 dark:bg-[#6b7270] animate-pulse" />
        <span className="h-1.5 w-1.5 rounded-full bg-gray-500/90 dark:bg-[#6b7270] animate-pulse [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-gray-500/90 dark:bg-[#6b7270] animate-pulse [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function getInitialPrompt(drill: any): string {
  if (Array.isArray(drill?.roleplay_scenes) && drill.roleplay_scenes.length > 0) {
    const scene = drill.roleplay_scenes[0];
    // Prefer a real line of dialogue over `context` (often a short curriculum label like "🔁 Re-entry & …")
    const aiLine = (scene?.dialogue as any[] | undefined)?.find(
      (d: any) => d.speaker !== "student" && typeof d.text === "string",
    );
    if (aiLine) return String(aiLine.text).trim();
    if (typeof scene?.scene_name === "string" && scene.scene_name.trim()) {
      return `Scene: ${scene.scene_name.trim()}. What would you say in this situation?`;
    }
    if (typeof scene?.context === "string" && scene.context.trim()) return scene.context.trim();
  }
  if (Array.isArray(drill?.target_sentences) && drill.target_sentences.length > 0) {
    const s = drill.target_sentences[0];
    return typeof s === "string" ? s : (s?.text ?? String(s));
  }
  if (typeof drill?.context === "string" && drill.context.trim()) {
    return drill.context;
  }
  return "You are late for a meeting. Explain yourself!";
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to encode audio"));
        return;
      }
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read audio"));
    reader.readAsDataURL(blob);
  });
}

export function PressureTestDrill({ drillId, sessionRunId }: PressureTestDrillProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: drill } = useDrill(drillId);
  const drillRef = useRef(drill);
  drillRef.current = drill;

  const [studentLevel, setStudentLevel] = useState<number>(1);
  const studentLevelRef = useRef(studentLevel);
  studentLevelRef.current = studentLevel;
  const [messages, setMessages] = useState<Message[]>([]);
  /** One id per mount; sent on every /pressure-test/chat call so the server can correlate a single attempt. */
  const [chatSessionId] = useState(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  });
  const [turnNumber, setTurnNumber] = useState(1);
  const [isAiTyping, setIsAiTyping] = useState(false);
  /** True once the first character of the current in-flight model reply is received (SSE text). */
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [recordedDurationMs, setRecordedDurationMs] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [waveBars, setWaveBars] = useState<number[]>(Array.from({ length: 56 }, () => 0.18));
  const [turns, setTurns] = useState<TurnDraft[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewData, setReviewData] = useState<any | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const [isTranscribing, setIsTranscribing] = useState(false);
  /** Local only: &lt; 2s mental gap; null before first completed gap this prompt. */
  const [isSpeedSuccess, setIsSpeedSuccess] = useState<boolean | null>(null);
  const [lastGapMs, setLastGapMs] = useState<number | null>(null);

  /** Text of the last TTS attempt — used if `onError` needs the browser speechSynthesis fallback. */
  const lastTtsAttemptTextRef = useRef<string>("");
  /** `onPlayStart` and backup: only set follow-up flags for stream TTS after a user turn, not intro or replay. */
  const lastTtsCallWasFollowUpRef = useRef(false);
  const followUpTtsHtmlAudioStartedRef = useRef(false);
  const followUpWebSpeechFromOnErrorRef = useRef(false);

  /** Always use latest messages when building the chat API payload (avoids stale closure on submit). */
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /** For follow-up TTS backup: `useTTS` state is stale inside setTimeout without refs. */
  const ttsHookStateRef = useRef({ generating: false, playing: false });

  const followUpTtsBackupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Bump to invalidate in-flight TTS; cleared when stopping playback. */
  const ttsStreamGenerationRef = useRef(0);
  /** If true, the next `onPlayEnd` (HTML) or `onend` (Web Speech) will call `armPromptReady()`. */
  const armPromptOnTtsPlayEndRef = useRef(false);
  /**
   * After `isAiTyping` goes false, play one TTS for the last assistant line (set just before
   * `setIsAiTyping(false)` in intro / `streamAiReply` completion paths).
   */
  const pendingPostStreamTtsRef = useRef<{ full: string; isFollowUp: boolean } | null>(null);
  const ttsOnPlayEndDispatcherRef = useRef<() => void>(() => {});

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** `performance.now()` when the latest AI reply finished streaming; listening window for this user turn. */
  const promptReadyAtRef = useRef<number | null>(null);
  const speechFirstAtRef = useRef<number | null>(null);
  const recordStartAtRef = useRef<number | null>(null);
  const pendingLatencyRef = useRef<number>(0);
  const pendingSpeedSuccessRef = useRef<boolean>(false);

  // Web Speech API for client-side transcription (no quota / no API key needed)
  const recognitionRef = useRef<any>(null);
  const speechTranscriptRef = useRef<string>("");
  // Resolves with the final transcript once recognition.onend fires
  const speechReadyRef = useRef<Promise<string> | null>(null);

  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const analyzeAbortRef = useRef<AbortController | null>(null);
  const isExitingRef = useRef(false);
  /** Drop stale intro stream results if `sessionRunId` changes or Strict Mode remounts during fetch. */
  const introEffectGenRef = useRef(0);
  /** True when intro effect cleanup aborts the fetch (navigation); false for slow-response timeout. */
  const introAbortFromUnmountRef = useRef(false);

  /** Dev Strict Mode runs unmount cleanup (which sets `isExitingRef` via `stopAllActivity`) then remounts; reset before paint. */
  useLayoutEffect(() => {
    isExitingRef.current = false;
  }, []);

  const firstName = useMemo(
    () => String(user?.firstName || user?.name || "there").trim().split(" ")[0],
    [user],
  );

  /**
   * Stable id for the loaded drill (not the query `data` reference) — intro effect depends on this
   * so React Query refetches do not retrigger the intro and abort the SSE.
   */
  const drillDocumentId = useMemo(() => {
    if (!drill) return null;
    const d = drill as { _id?: unknown; id?: unknown };
    const id = d._id ?? d.id;
    if (id != null && id !== "") return String(id);
    return String(drillId);
  }, [drill?._id, (drill as { id?: unknown } | null)?.id, drillId]);

  const progressWidth = `${(turnNumber / TOTAL_TURNS) * 100}%`;

  const scenarioId = useMemo(() => {
    if (!drill) return drillId;
    const scene = (drill as { roleplay_scenes?: Array<{ _id?: unknown; id?: unknown }> })?.roleplay_scenes?.[0];
    if (scene) {
      const id = scene._id ?? scene.id;
      if (id != null && String(id) !== "") return String(id);
    }
    return drillId;
  }, [drill, drillId]);

  /**
   * Mental-translation / prompt window: `armPromptReady()` runs when the model’s full-message
   * TTS **finishes** (HTML5 `onended` or Web Speech `onend`), so the 2s clock starts after
   * playback, not at play start. Manual replay of a line can opt out via `armPromptWhenAudioEnds`.
   */
  const armPromptReady = useCallback(() => {
    promptReadyAtRef.current = performance.now();
    speechFirstAtRef.current = null;
    recordStartAtRef.current = null;
  }, []);

  const scheduleFollowUpWebSpeechBackup = useCallback((fullText: string) => {
    if (followUpTtsBackupTimeoutRef.current) {
      clearTimeout(followUpTtsBackupTimeoutRef.current);
      followUpTtsBackupTimeoutRef.current = null;
    }
    followUpTtsBackupTimeoutRef.current = setTimeout(() => {
      followUpTtsBackupTimeoutRef.current = null;
      if (!lastTtsCallWasFollowUpRef.current) return;
      if (followUpTtsHtmlAudioStartedRef.current) return;
      if (followUpWebSpeechFromOnErrorRef.current) return;
      const { generating, playing } = ttsHookStateRef.current;
      if (generating || playing) return;
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) return;
      const t = fullText.trim();
      if (!t) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(t);
        u.lang = "en-US";
        u.rate = 1.0;
        u.onend = () => {
          if (armPromptOnTtsPlayEndRef.current) {
            armPromptOnTtsPlayEndRef.current = false;
            armPromptReady();
          }
        };
        window.speechSynthesis.speak(u);
      } catch {
        /* ignore */
      }
    }, 2500);
  }, [armPromptReady]);

  const {
    playAudio: playTTS,
    stopAudio: stopTTS,
    isGenerating: isTTSGenerating,
    isPlaying: isTTSPlaying,
  } = useTTS({
    onPlayStart: () => {
      if (lastTtsCallWasFollowUpRef.current) {
        followUpTtsHtmlAudioStartedRef.current = true;
      }
    },
    onPlayEnd: () => {
      ttsOnPlayEndDispatcherRef.current();
      if (armPromptOnTtsPlayEndRef.current) {
        armPromptOnTtsPlayEndRef.current = false;
        armPromptReady();
      }
    },
    onError: () => {
      const t = lastTtsAttemptTextRef.current.trim();
      if (!t || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      followUpWebSpeechFromOnErrorRef.current = true;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(t);
        u.lang = "en-US";
        u.rate = 1;
        u.onend = () => {
          if (armPromptOnTtsPlayEndRef.current) {
            armPromptOnTtsPlayEndRef.current = false;
            armPromptReady();
          }
          ttsOnPlayEndDispatcherRef.current();
        };
        window.speechSynthesis.speak(u);
      } catch {
        /* ignore */
      }
    },
    apiPath: "/api/v1/pressure-test/tts",
  });

  useLayoutEffect(() => {
    ttsHookStateRef.current = { generating: isTTSGenerating, playing: isTTSPlaying };
  }, [isTTSGenerating, isTTSPlaying]);

  const clearStreamingTts = useCallback(() => {
    ttsStreamGenerationRef.current += 1;
    pendingPostStreamTtsRef.current = null;
    armPromptOnTtsPlayEndRef.current = false;
    stopTTS();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    if (followUpTtsBackupTimeoutRef.current) {
      clearTimeout(followUpTtsBackupTimeoutRef.current);
      followUpTtsBackupTimeoutRef.current = null;
    }
  }, [stopTTS]);

  const clearStreamingTtsRef = useRef(clearStreamingTts);
  clearStreamingTtsRef.current = clearStreamingTts;

  useLayoutEffect(() => {
    ttsOnPlayEndDispatcherRef.current = () => {
      /* single full-message clip; no queue to drain */
    };
  }, []);

  /**
   * One-shot TTS: `clearStreamingTts` first, then a full `playTTS`. By default the 2s clock
   * **arms in `onPlayEnd`**; set `armPromptWhenAudioEnds: false` for e.g. manual line replay.
   */
  const speakMessage = useCallback(
    (raw: string, options?: { isFollowUp?: boolean; role?: ChatRole; armPromptWhenAudioEnds?: boolean }) => {
      if (options?.role === "user") return;
      if (isExitingRef.current || showReview) return;
      const t = String(raw ?? "").trim();
      if (!t) return;

      clearStreamingTts();

      const isFollowUp = options?.isFollowUp === true;
      if (isFollowUp) {
        followUpTtsHtmlAudioStartedRef.current = false;
        followUpWebSpeechFromOnErrorRef.current = false;
      }
      lastTtsCallWasFollowUpRef.current = isFollowUp;
      lastTtsAttemptTextRef.current = t;
      armPromptOnTtsPlayEndRef.current = options?.armPromptWhenAudioEnds !== false;
      void playTTS(t);

      if (isFollowUp) {
        scheduleFollowUpWebSpeechBackup(t);
      }
    },
    [clearStreamingTts, playTTS, showReview, scheduleFollowUpWebSpeechBackup],
  );

  const speakMessageRef = useRef(speakMessage);
  speakMessageRef.current = speakMessage;

  /** When `isAiTyping` goes false, speak the full last assistant line after streaming (set via `pendingPostStreamTtsRef`). */
  useEffect(() => {
    if (isAiTyping) return;
    const p = pendingPostStreamTtsRef.current;
    if (!p) return;
    pendingPostStreamTtsRef.current = null;
    const t = String(p.full ?? "").trim();
    if (!t) return;
    speakMessageRef.current(t, { isFollowUp: p.isFollowUp, role: "ai" });
  }, [isAiTyping]);

  // Fetch the student's current pressureTestLevel from their profile
  useEffect(() => {
    fetch("/api/v1/users/current", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const lvl = d?.user?.pressureTestLevel;
        if (typeof lvl === "number" && lvl >= 1) setStudentLevel(lvl);
      })
      .catch(() => setStudentLevel(1));
  }, []);

  const stopVisualizer = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const stopAllActivity = useCallback(() => {
    isExitingRef.current = true;

    if (followUpTtsBackupTimeoutRef.current) {
      clearTimeout(followUpTtsBackupTimeoutRef.current);
      followUpTtsBackupTimeoutRef.current = null;
    }

    // Cancel any in-flight analysis request
    analyzeAbortRef.current?.abort();
    analyzeAbortRef.current = null;

    clearStreamingTts();

    // Clear the recording timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop MediaRecorder and detach handlers so onstop callbacks don't fire
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }
    chunksRef.current = [];

    // Release the microphone
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    // Stop Web Speech recognition
    try {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    } catch (_) {}

    // Cancel the waveform animation frame and close the AudioContext
    stopVisualizer();
  }, [clearStreamingTts, stopVisualizer]);

  /** Always call the latest `stopAllActivity` from unmount cleanup (no dependency churn). */
  const stopAllActivityRef = useRef(stopAllActivity);
  stopAllActivityRef.current = stopAllActivity;

  const startVisualizer = useCallback((stream: MediaStream) => {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    analyserRef.current = analyser;
    audioCtxRef.current = ctx;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const render = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(data);
      const step = Math.max(1, Math.floor(data.length / 56));
      const bars = Array.from({ length: 56 }, (_, i) => {
        const v = data[i * step] || 0;
        return Math.min(1, Math.max(0.12, v / 255));
      });
      setWaveBars(bars);
      rafRef.current = requestAnimationFrame(render);
    };
    render();
  }, []);

  // Turn 1 intro: one run per `sessionRunId` when drill + name are ready (aborts + ignores stale fetches on remount).
  // Use `drillDocumentId` (not `drill`) in deps so React Query refetches that replace the `drill` object
  // do not retrigger this effect and abort the in-flight intro stream.
  // Do not depend on `speakMessage` / `armPromptReady` (their identity changes would abort the stream and, with a "ran once" ref, could block the intro entirely).
  useEffect(() => {
    const drill = drillRef.current;
    if (!drill || !firstName) return;
    const introGen = ++introEffectGenRef.current;
    introAbortFromUnmountRef.current = false;

    setTurnNumber(1);
    setTurns([]);
    setReviewData(null);
    setIsSpeedSuccess(null);
    setLastGapMs(null);
    setShowReview(false);
    clearStreamingTtsRef.current();

    const intro = `Hello ${firstName} 👋 The pressure test is to help you respond clearly and naturally when under pressure as a professional nurse. Let's get started.`;

    // Show the intro immediately; the empty second row stays hidden until the first stream token
    // (dedicated `PressureTestAiThinkingBubble` at list end while `!isAiStreaming`).
    setMessages([
      { role: "ai", text: intro },
      { role: "ai", text: "" },
    ]);
    setIsAiTyping(true);
    setIsAiStreaming(false);

    const fallback = getInitialPrompt(drill);

    const showFallback = () => {
      if (introGen !== introEffectGenRef.current) return;
      setMessages([
        { role: "ai", text: intro },
        { role: "ai", text: fallback },
      ]);
      setIsAiTyping(false);
      setIsAiStreaming(false);
      speakMessageRef.current(`${intro} ${fallback}`, { isFollowUp: false, role: "ai" });
    };

    // Abort if headers/stream never start (safety); slow LLMs can take 15s+ to first byte
    const controller = new AbortController();
    const INTRO_REQUEST_TIMEOUT_MS = 30000;
    const timeoutId = setTimeout(() => controller.abort(), INTRO_REQUEST_TIMEOUT_MS);

    fetch("/api/v1/pressure-test/chat", {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // A hidden "begin" turn — never shown in the UI
        messages: [{ role: "user", content: "begin" }],
        level: studentLevelRef.current,
        turnNumber: 1,
        drillId,
        sessionId: chatSessionId,
        isNewSession: true,
        reset: true,
      }),
    })
      .then(async (res) => {
        if (introGen !== introEffectGenRef.current) return;
        if (!res.ok || !res.body) { showFallback(); return; }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let text = "";
        while (true) {
          if (introGen !== introEffectGenRef.current) return;
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let end = buf.indexOf("\n\n");
          while (end !== -1) {
            const evt = buf.slice(0, end);
            buf = buf.slice(end + 2);
            if (evt.startsWith("data: ")) {
              try {
                const p = JSON.parse(evt.slice(6));
                if (p.type === "text" && typeof p.data === "string") {
                  text += p.data;
                  if (p.data) setIsAiStreaming(true);
                  setMessages((prev) => {
                    const copy = [...prev];
                    copy[copy.length - 1] = { role: "ai", text };
                    return copy;
                  });
                }
                // Trigger fallback immediately on error event — don't wait for stream close
                if (p.type === "error") {
                  showFallback();
                  return;
                }
              } catch (_) {}
            }
            end = buf.indexOf("\n\n");
          }
        }
        if (introGen !== introEffectGenRef.current) return;
        if (!text) showFallback();
        else {
          pendingPostStreamTtsRef.current = {
            full: text.trim() ? `${intro} ${text}` : intro,
            isFollowUp: false,
          };
          setIsAiTyping(false);
          setIsAiStreaming(false);
        }
      })
      .catch((err: unknown) => {
        if (introGen !== introEffectGenRef.current) return;
        const name = err && typeof err === "object" && "name" in err ? (err as { name?: string }).name : "";
        if (name === "AbortError" && introAbortFromUnmountRef.current) return;
        showFallback();
      })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      introAbortFromUnmountRef.current = true;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [drillDocumentId, drillId, firstName, sessionRunId, chatSessionId]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      clearPressureTestDrillClientCache(drillId);
      stopAllActivityRef.current();
    };
  // Unmount only — do not add deps (e.g. `previewUrl`) or cleanup will run mid-session and set `isExitingRef`.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || isAnalyzing || isAiTyping) return;

    // Capture *before* stopping: interrupt = student recorded while our voice was still going.
    const hadHtmlTts =
      ttsHookStateRef.current.generating || ttsHookStateRef.current.playing;
    const hadWebSpeech =
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      (window.speechSynthesis.speaking || window.speechSynthesis.pending);

    clearStreamingTts();

    if (hadHtmlTts || hadWebSpeech) {
      // New window for the 2s clock: the moment of tap, not when Gemini TTS had started.
      armPromptReady();
    }

    try {
      /**
       * Capture the moment the student chose to start answering (synchronous), before
       * `getUserMedia` / device open latency, so the pressure gap (prompt → speech or record) is
       * not unfairly enlarged by mic permission and device open time.
       */
      const recordIntentAt = promptReadyAtRef.current != null ? performance.now() : null;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      if (promptReadyAtRef.current != null) {
        speechFirstAtRef.current = null;
        recordStartAtRef.current = recordIntentAt ?? performance.now();
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
        audioBitsPerSecond: 32000,
      });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > MAX_AUDIO_SIZE) {
          toast.error("Recording exceeds 5MB. Please keep it shorter.");
          setRecordedAudio(null);
          setPreviewUrl("");
          return;
        }
        setRecordedAudio(blob);
        // Duration is already captured in stopRecording via Date.now() - startedAtRef.current
        const url = URL.createObjectURL(blob);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(url);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      startedAtRef.current = Date.now();
      setRecordingMs(0);
      recorder.start();
      setIsRecording(true);
      startVisualizer(stream);
      timerRef.current = setInterval(() => {
        setRecordingMs(Date.now() - startedAtRef.current);
      }, 100);

      // Start Web Speech API in parallel for free client-side transcription
      speechTranscriptRef.current = "";
      speechReadyRef.current = null;
      try {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SR) {
          const recognition = new SR();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "en-US";

          let resolveSpeech!: (text: string) => void;
          speechReadyRef.current = new Promise<string>((res) => { resolveSpeech = res; });

          recognition.onresult = (event: any) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const piece = (event.results[i][0].transcript || "").trim();
              if (
                piece &&
                promptReadyAtRef.current != null &&
                speechFirstAtRef.current == null
              ) {
                speechFirstAtRef.current = performance.now();
              }
            }
            let finalChunk = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              if (event.results[i].isFinal) finalChunk += event.results[i][0].transcript;
            }
            if (finalChunk) speechTranscriptRef.current += " " + finalChunk;
          };
          recognition.onend = () => { resolveSpeech(speechTranscriptRef.current.trim()); };
          recognition.onerror = () => { resolveSpeech(speechTranscriptRef.current.trim()); };
          recognition.start();
          recognitionRef.current = recognition;
        }
      } catch (_) {}
    } catch (error: any) {
      toast.error(error?.message || "Unable to access microphone.");
    }
  }, [
    armPromptReady,
    isAiTyping,
    isAnalyzing,
    isRecording,
    previewUrl,
    recordingMs,
    startVisualizer,
    clearStreamingTts,
  ]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // Capture actual duration here (not in onstop closure which has stale state)
    setRecordedDurationMs(Date.now() - startedAtRef.current);
    const t0 = promptReadyAtRef.current;
    let gapMs = 0;
    if (t0 != null) {
      const tCandidates: number[] = [];
      if (speechFirstAtRef.current != null) tCandidates.push(speechFirstAtRef.current);
      if (recordStartAtRef.current != null) tCandidates.push(recordStartAtRef.current);
      if (tCandidates.length > 0) {
        gapMs = Math.max(0, Math.round(Math.min(...tCandidates) - t0));
      }
    }
    pendingLatencyRef.current = gapMs;
    const under = gapMs < PRESSURE_SPEED_MS;
    pendingSpeedSuccessRef.current = under;
    setLastGapMs(gapMs);
    setIsSpeedSuccess(under);

    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    stopVisualizer();
    setWaveBars(Array.from({ length: 56 }, () => 0.18));
    // Stop Web Speech API and let it finalise any pending results
    try { recognitionRef.current?.stop(); } catch (_) {}
  }, [isRecording, stopVisualizer]);

  const resetRecording = useCallback((options?: { clearSpeedFeedback?: boolean }) => {
    const clearSpeed = options?.clearSpeedFeedback !== false;
    setRecordedAudio(null);
    setRecordedDurationMs(0);
    if (clearSpeed) {
      setIsSpeedSuccess(null);
      setLastGapMs(null);
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
  }, [previewUrl]);

  const formatDuration = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    return `0:${secs.toString().padStart(2, "0")}`;
  };

  const streamAiReply = useCallback(
    async (
      nextMessages: Message[],
      level = studentLevel,
      opts?: {
        userTurnMetadata: {
          latency_ms: number;
          is_pressure_test: true;
          scenario_id: string;
        };
      },
    ) => {
      setIsSpeedSuccess(null);
      setLastGapMs(null);
      // Prepend a user turn so Gemini `history` always starts with `user` and includes prior model turns
      // (rawHistory was only [model, model, …] before, which made firstUserIdx = -1 and history empty).
      const payloadMessages = [
        { role: "user" as const, content: "begin" },
        ...nextMessages.map((m) => ({
          role: m.role === "ai" ? ("model" as const) : ("user" as const),
          content: m.text,
        })),
      ];

      const body: Record<string, unknown> = {
        messages: payloadMessages,
        level,
        turnNumber: Math.min(turnNumber + 1, TOTAL_TURNS),
        drillId,
        sessionId: chatSessionId,
        isNewSession: false,
      };
      if (opts?.userTurnMetadata) {
        body.metadata = opts.userTurnMetadata;
      }

      /** Show "thinking" immediately, before headers / first stream byte (turns 2+). */
      pendingPostStreamTtsRef.current = null;
      clearStreamingTts();
      setIsAiStreaming(false);
      setIsAiTyping(true);
      setMessages((prev) => [...prev, { role: "ai", text: "" }]);

      let response: Response;
      try {
        response = await fetch("/api/v1/pressure-test/chat", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        setIsAiTyping(false);
        setIsAiStreaming(false);
        setMessages((prev) => {
          if (prev.length > 0 && prev[prev.length - 1].role === "ai" && prev[prev.length - 1].text === "") {
            return prev.slice(0, -1);
          }
          return prev;
        });
        throw new Error("Failed to stream pressure test response");
      }
      if (!response.ok || !response.body) {
        setIsAiTyping(false);
        setIsAiStreaming(false);
        setMessages((prev) => {
          if (prev.length > 0 && prev[prev.length - 1].role === "ai" && prev[prev.length - 1].text === "") {
            return prev.slice(0, -1);
          }
          return prev;
        });
        throw new Error("Failed to stream pressure test response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalText = "";

      const updateLastAi = (text: string) => {
        setMessages((prev) => {
          const copy = [...prev];
          const idx = copy.length - 1;
          copy[idx] = { role: "ai", text };
          return copy;
        });
      };

      const applySsePayload = (parsed: { type?: string; data?: unknown }) => {
        if (parsed.type === "error") {
          const d = parsed.data;
          const message =
            d &&
            typeof d === "object" &&
            d !== null &&
            "message" in d &&
            typeof (d as { message: string }).message === "string"
              ? (d as { message: string }).message
              : "Stream failed";
          throw new Error(message);
        }
        if (parsed.type === "text" && typeof parsed.data === "string") {
          if (parsed.data) setIsAiStreaming(true);
          finalText += parsed.data;
          updateLastAi(finalText);
        }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let end = buffer.indexOf("\n\n");
          while (end !== -1) {
            const evt = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            if (evt.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(evt.slice(6)) as { type?: string; data?: unknown };
                applySsePayload(parsed);
              } catch (e) {
                if (e instanceof SyntaxError) {
                  /* skip malformed chunk */
                } else {
                  throw e;
                }
              }
            }
            end = buffer.indexOf("\n\n");
          }
        }

        if (buffer.length > 0) {
          for (const line of buffer.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            try {
              const parsed = JSON.parse(trimmed.slice(6)) as { type?: string; data?: unknown };
              applySsePayload(parsed);
            } catch (e) {
              if (e instanceof SyntaxError) {
                /* ignore partial line */
              } else {
                throw e;
              }
            }
          }
        }

        if (!finalText) {
          // Gemini returned no text (rate-limit / empty stream). Replace the empty bubble with
          // a neutral prompt so the student can still complete their turns.
          const fallbackPrompts = [
            "Good effort! Now respond to this: What would you say next?",
            "Keep going — describe what happens after that.",
            "Your turn again — how would you reply in this situation?",
          ];
          const fallback = fallbackPrompts[(turnNumber - 1) % fallbackPrompts.length];
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "ai", text: fallback };
            return copy;
          });
          setIsAiTyping(false);
          setIsAiStreaming(false);
          speakMessage(fallback, { isFollowUp: true, role: "ai" });
          return fallback;
        }
        pendingPostStreamTtsRef.current = { full: finalText, isFollowUp: true };
        setIsAiTyping(false);
        setIsAiStreaming(false);
        return finalText;
      } catch (e) {
        pendingPostStreamTtsRef.current = null;
        setIsAiTyping(false);
        setIsAiStreaming(false);
        setMessages((prev) =>
          prev.length > 0 && prev[prev.length - 1].role === "ai" ? prev.slice(0, -1) : prev,
        );
        clearStreamingTts();
        throw e;
      }
    },
    [
      clearStreamingTts,
      chatSessionId,
      drillId,
      speakMessage,
      studentLevel,
      turnNumber,
    ],
  );

  const submitTurn = useCallback(async () => {
    if (!recordedAudio || isAiTyping || isAnalyzing || isTranscribing) return;

    let turnSnapshot: TurnDraft[] = [];
    let didAppendUserToThread = false;
    try {
      setIsTranscribing(true);

      // Stop recognition and wait for its onend to fire (max 1.5 s) so we get the
      // complete final transcript before reading speechTranscriptRef.
      try { recognitionRef.current?.stop(); } catch (_) {}
      let userText = "";
      if (speechReadyRef.current) {
        userText = await Promise.race([
          speechReadyRef.current,
          new Promise<string>((res) => setTimeout(() => res(speechTranscriptRef.current.trim()), 1500)),
        ]);
      }
      userText = userText.trim();

      // Web Speech API not available or captured nothing — try server-side transcription
      if (!userText) {
        try {
          const { aiService } = await import("@/services/ai.service");
          const transcription = await aiService.transcribeAudio(recordedAudio);
          userText = transcription?.trim() || "";
        } catch (_) {
          // Transcription unavailable — fall through to label below
        }
      }

      // Final fallback: audio was captured even without a transcript
      if (!userText) userText = "(voice response)";

      setIsTranscribing(false);
      const latestAiPrompt =
        [...messagesRef.current].reverse().find((m) => m.role === "ai")?.text || "Prompt unavailable";
      const audioBase64 = await blobToBase64(recordedAudio);
      const turnDraft: TurnDraft = {
        turnNumber,
        aiPrompt: latestAiPrompt,
        studentResponseText: userText,
        latencyMs: pendingLatencyRef.current,
        speedSuccess: pendingSpeedSuccessRef.current,
        scenarioId,
        audioDurationMs: recordedDurationMs,
        audioBase64,
      };
      const nextTurns = [...turns, turnDraft];
      turnSnapshot = turns;
      setTurns(nextTurns);
      resetRecording({ clearSpeedFeedback: false });
      setMessages((prev) => [...prev, { role: "user", text: userText }]);
      didAppendUserToThread = true;

      if (turnNumber >= TOTAL_TURNS) {
        clearPressureTestDrillClientCache(drillId);
        setIsAnalyzing(true);
        setLastGapMs(null);
        setIsSpeedSuccess(null);
        const analyzeAc = new AbortController();
        analyzeAbortRef.current = analyzeAc;
        let resultRes: Response;
        try {
          resultRes = await fetch("/api/v1/pressure-test/analyze", {
            method: "POST",
            credentials: "include",
            signal: analyzeAc.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              level: studentLevel,
              drillId,
              turns: nextTurns,
            }),
          });
        } finally {
          if (analyzeAbortRef.current === analyzeAc) analyzeAbortRef.current = null;
        }
        // If the user exited while the request was in flight, don't touch state
        if (isExitingRef.current) return;
        const result = await resultRes!.json();
        if (!resultRes!.ok) throw new Error(result?.message || "Analysis failed");
        setReviewData(result.data);
        setShowReview(true);
        setIsAnalyzing(false);
        return;
      }

      const historyWithUser = [...messagesRef.current, { role: "user" as const, text: userText }];
      await streamAiReply(historyWithUser, studentLevel, {
        userTurnMetadata: {
          latency_ms: turnDraft.latencyMs,
          is_pressure_test: true,
          scenario_id: turnDraft.scenarioId,
        },
      });
      if (isExitingRef.current) return;
      setTurnNumber((prev) => prev + 1);
    } catch (error: any) {
      toast.error(error?.message || "Failed to process this turn.");
      if (didAppendUserToThread) {
        setTurns(turnSnapshot);
        setMessages((prev) => {
          let p = prev;
          if (p.length > 0 && p[p.length - 1].role === "ai") p = p.slice(0, -1);
          if (p.length > 0 && p[p.length - 1].role === "user") p = p.slice(0, -1);
          return p;
        });
        resetRecording({ clearSpeedFeedback: true });
      }
      setIsAiTyping(false);
      setIsAiStreaming(false);
      setIsAnalyzing(false);
      setIsTranscribing(false);
    }
  }, [
    drillId,
    isAiTyping,
    isAnalyzing,
    isTranscribing,
    recordedAudio,
    recordedDurationMs,
    resetRecording,
    scenarioId,
    streamAiReply,
    studentLevel,
    turnNumber,
    turns,
  ]);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-gray-50 dark:bg-[#0c0e0d]">
      <header className="flex-shrink-0 bg-white dark:bg-[#131614] border-b border-gray-100 dark:border-[#2a2e2c] z-10">
        <div className="max-w-2xl mx-auto w-full px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => { stopAllActivity(); router.back(); }}
                className="w-8 h-8 rounded-full bg-[#eff0ef] dark:bg-[#1a1d1c] flex items-center justify-center"
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4 text-[#2f2f2f] dark:text-[#c8cdc9]" />
              </button>
              <h1 className="text-md font-semibold text-gray-900 dark:text-[#f0f2f1] leading-tight">Pressure Test</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-md font-medium text-gray-500 dark:text-[#9aa39e] tabular-nums">
                {turnNumber} of {TOTAL_TURNS}
              </span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#1a1d1c] transition-colors"
                  aria-label="More options"
                >
                  <MoreVertical className="w-5 h-5 text-gray-500 dark:text-[#9aa39e]" />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-10 z-40 w-40 bg-white dark:bg-[#1a1d1c] rounded-xl shadow-lg border border-gray-100 dark:border-[#2a2e2c] py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenu(false);
                          stopAllActivity();
                          router.back();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        <span>End Session</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="ml-10 mt-2.5 h-1 rounded-full bg-[#dedede] dark:bg-[#2a2e2c] overflow-hidden">
            <div className="h-full bg-[#4dab56] transition-all" style={{ width: progressWidth }} />
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-4 py-4 space-y-4">
          {(() => {
            let aiIdx = 0;
            return messages.map((msg, idx) => {
              if (msg.role === "ai") {
                const isLast = idx === messages.length - 1;
                if (isLast && !msg.text && isAiTyping && !isAiStreaming) {
                  return <Fragment key={`ai-thinking-skip-${idx}`} />;
                }
                const currentAiIdx = aiIdx++;
                return (
                  <section key={`ai-${idx}`} className="bg-[#f4f5f4] dark:bg-[#1a1d1c] border border-[#ebebeb] dark:border-[#2a2e2c] rounded-2xl p-4">
                    <div className="w-10 h-10 rounded-full bg-[#d9f1da] dark:bg-emerald-900/40 flex items-center justify-center mb-3">
                      <Image src="/logo2.svg" alt="Eklan" width={20} height={20} />
                    </div>
                    <p className="text-sm text-gray-700 dark:text-[#c8cdc9] leading-relaxed">
                      {currentAiIdx === 0 ? (
                        // Intro bubble — styled greeting
                        <>
                          <span className="font-semibold text-emerald-600">Hello {firstName} 👋 </span>
                          {msg.text.replace(/^Hello\s+\S+\s*👋\s*/i, "")}
                        </>
                      ) : msg.text ? (
                        // Scenario bubble (streams in from first token)
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">{msg.text}</span>
                      ) : null}
                    </p>
                    <div className="flex items-center gap-3 mt-3 text-gray-700 dark:text-[#9aa39e]">
                      <Languages className="w-4 h-4" />
                      <button
                        type="button"
                        onClick={() => {
                          if (isTTSGenerating || isTTSPlaying) {
                            stopTTS();
                          } else {
                            speakMessage(msg.text, {
                              isFollowUp: false,
                              role: "ai",
                              armPromptWhenAudioEnds: false,
                            });
                          }
                        }}
                        aria-label={(isTTSGenerating || isTTSPlaying) ? "Stop audio" : "Play AI message"}
                        className="focus:outline-none"
                      >
                        <Volume2 className={`w-4 h-4 transition-colors ${(isTTSGenerating || isTTSPlaying) ? "text-emerald-600 animate-pulse" : "text-gray-500 hover:text-emerald-600"}`} />
                      </button>
                    </div>
                  </section>
                );
              }
              // User message bubble
              return (
                <div key={`user-${idx}`} className="flex justify-end">
                  <div className="max-w-[80%] bg-emerald-600 text-white rounded-2xl rounded-br-sm px-4 py-3 shadow-sm">
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              );
            });
          })()}

          {isAiTyping && !isAiStreaming && <PressureTestAiThinkingBubble />}

          {isAnalyzing && (
            <div className="fixed inset-0 z-40 bg-gray-50/95 dark:bg-[#0c0e0d]/95 flex flex-col items-center justify-center px-8">
              <p className="text-6xl mb-4">👏</p>
              <h2 className="text-[50px] font-bold text-slate-800 dark:text-[#f0f2f1] mb-1 leading-none">Nice work!</h2>
              <p className="text-[35px] text-slate-500 dark:text-[#9aa39e] mb-8 text-center leading-tight">You just completed a Pressure Test</p>
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-4 animate-[pulse_1.8s_ease-in-out_infinite]">
                <Image src="/logo2.svg" alt="Eklan" width={34} height={34} />
              </div>
              <p className="text-[32px] text-slate-600 dark:text-[#9aa39e] leading-tight">Analyzing your responses...</p>
            </div>
          )}
        </div>
      </main>

      <footer className="flex-shrink-0 bg-white dark:bg-[#131614] border-t border-gray-100 dark:border-[#2a2e2c] z-10">
        <div className="max-w-2xl mx-auto w-full px-4 pt-3 pb-2">

          {/* ── Recording state: label + live waveform ─── */}
          {isRecording && (
            <>
              <p className="text-center text-sm text-gray-700 dark:text-[#c8cdc9] mb-2">
                🎙 Your turn &nbsp;<span className="text-gray-400 dark:text-[#6b7270]">Tap to Speak</span>
              </p>
              <div className="bg-[#f6f7f6] dark:bg-[#1a1d1c] border border-[#ebedeb] dark:border-[#2a2e2c] rounded-full px-3 py-2 mb-4 flex items-center gap-2">
                <div className="flex-1 h-7 flex items-center gap-[1px] overflow-hidden">
                  {waveBars.map((v, i) => (
                    <span
                      key={i}
                      className="w-[2px] rounded-full bg-emerald-500/80"
                      style={{ height: `${Math.round(4 + v * 18)}px` }}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-500 dark:text-[#9aa39e] tabular-nums pr-1">
                  {formatDuration(recordingMs)}
                </span>
              </div>
            </>
          )}

          {/* ── Recorded / preview state ─── */}
          {recordedAudio && !isRecording && (
            <>
              <p className="text-center text-xs text-gray-400 dark:text-[#6b7270] mb-2">
                preview your recording using the play button
              </p>
              {lastGapMs != null && isSpeedSuccess != null && (
                <p className="text-center text-sm text-slate-600 dark:text-[#9aa39e] mb-2" aria-live="polite">
                  <span className="mr-1" aria-hidden>
                    {isSpeedSuccess ? "⚡" : "🐢"}
                  </span>
                  {lastGapMs}ms to first response
                </p>
              )}
              <div className="bg-[#f6f7f6] dark:bg-[#1a1d1c] border border-[#ebedeb] dark:border-[#2a2e2c] rounded-full px-3 py-2 mb-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!previewUrl) return;
                    const audio = new Audio(previewUrl);
                    void audio.play();
                  }}
                  className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0"
                >
                  <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                </button>
                <div className="flex-1 h-7 flex items-center gap-[1px] overflow-hidden">
                  {waveBars.map((v, i) => (
                    <span
                      key={i}
                      className="w-[2px] rounded-full bg-emerald-400/60"
                      style={{ height: `${Math.round(4 + v * 14)}px` }}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-500 dark:text-[#9aa39e] tabular-nums">{formatDuration(recordedDurationMs)}</span>
                <button
                  type="button"
                  onClick={() => resetRecording()}
                  className="w-7 h-7 rounded-full bg-slate-100 dark:bg-[#2a2e2c] flex items-center justify-center flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-500 dark:text-[#9aa39e]" />
                </button>
              </div>
            </>
          )}

          {/* ── Idle hint ─── */}
          {!isRecording && !recordedAudio && (
            <>
              {lastGapMs != null && isSpeedSuccess != null && (
                <p className="text-center text-sm text-slate-600 dark:text-[#9aa39e] mb-1" aria-live="polite">
                  <span className="mr-1" aria-hidden>
                    {isSpeedSuccess ? "⚡" : "🐢"}
                  </span>
                  {lastGapMs}ms to first response
                </p>
              )}
              <p className="text-center text-xs text-gray-400 dark:text-[#6b7270] mb-3">
                {isAiTyping ? "Eklan is thinking…" : isTranscribing ? "Processing…" : "Tap to speak"}
              </p>
            </>
          )}

          {/* ── Main action button ─── */}
          <div className="flex justify-center mb-1">
            {isRecording ? (
              <button
                type="button"
                onClick={stopRecording}
                className="w-[72px] h-[72px] rounded-full bg-emerald-600 shadow-lg flex items-center justify-center"
                aria-label="Stop recording"
              >
                <Square className="w-6 h-6 text-white fill-white" />
              </button>
            ) : recordedAudio ? (
              <button
                type="button"
                onClick={submitTurn}
                disabled={isAiTyping || isAnalyzing || isTranscribing}
                className="w-[72px] h-[72px] rounded-full bg-emerald-600 shadow-lg flex items-center justify-center disabled:opacity-50"
                aria-label="Submit turn"
              >
                {isTranscribing ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-6 h-6 text-white fill-white" />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={isAiTyping || isAnalyzing}
                className="w-[72px] h-[72px] rounded-full bg-emerald-600 shadow-lg flex items-center justify-center disabled:opacity-50"
                aria-label="Start recording"
              >
                <Mic className="w-7 h-7 text-white" />
              </button>
            )}
          </div>
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </footer>

      <LessonReview
        open={showReview}
        data={reviewData}
        onClose={() => setShowReview(false)}
        onPracticeWeakAreas={() => {
          setShowReview(false);
          // Go to the History tab so the student sees the feedback and next steps immediately.
          router.push("/account/practice/ai/pressure-test?tab=history");
        }}
        onDoneForToday={() => {
          setShowReview(false);
          router.push("/account/practice/ai/pressure-test");
        }}
      />
    </div>
  );
}
