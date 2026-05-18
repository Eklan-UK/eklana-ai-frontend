"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  Mic,
  Send,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Volume2,
  VolumeX,
  Languages,
} from "lucide-react";
import { aiService } from "@/services/ai.service";
import { MarkdownText } from "@/components/ui/MarkdownText";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { useAuthStore } from "@/store/auth-store";
import { learnerHasProAccess } from "@/utils/learner-subscription";
import { releaseMediaStream } from "@/lib/ios-audio-utils";
import { appendFreeTalkHistoryEntry } from "@/lib/free-talk-history";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "loading" | "ready" | "responding" | "grading" | "result";

interface Scenario {
  id: string;
  title: string;
  situation: string;
  hint: string;
  usefulPhrases: string[];
  scenarioType: string;
}

interface ScenarioSummary {
  id: string;
  title: string;
  scenarioType: string;
}

interface GradedBehaviour {
  id: number;
  name: string;
  result: "full" | "partial" | "none";
  score: number;
}

interface GradeResult {
  overallScore: number;
  competencyLevel: string;
  behaviours: GradedBehaviour[];
  rawScore: number;
  maxScore: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPETENCY_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  "Advanced Clinical Communicator": {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-400",
    ring: "ring-emerald-500",
  },
  "Safe & Effective Communicator": {
    bg: "bg-green-50 dark:bg-green-950/30",
    text: "text-green-700 dark:text-green-400",
    ring: "ring-green-500",
  },
  "Developing Communicator": {
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    text: "text-yellow-700 dark:text-yellow-500",
    ring: "ring-yellow-500",
  },
  "Need Improvement": {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-700 dark:text-orange-400",
    ring: "ring-orange-500",
  },
  "Unsafe Communication Risk": {
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-400",
    ring: "ring-red-500",
  },
};

function getCompetencyColors(level: string) {
  return (
    COMPETENCY_COLORS[level] ?? {
      bg: "bg-gray-50 dark:bg-gray-900/30",
      text: "text-gray-700 dark:text-gray-300",
      ring: "ring-gray-400",
    }
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BehaviourRow({ b }: { b: GradedBehaviour }) {
  const icons = {
    full: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    partial: <MinusCircle className="w-5 h-5 text-yellow-500 shrink-0" />,
    none: <XCircle className="w-5 h-5 text-red-400 shrink-0" />,
  };
  const labels = { full: "1 pt", partial: "0.5 pt", none: "0 pt" };
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 dark:border-[#2a2e2c] last:border-0">
      {icons[b.result]}
      <span className="flex-1 text-sm text-gray-800 dark:text-[#c8cdc9] leading-snug">
        {b.name}
      </span>
      <span
        className={`text-xs font-semibold shrink-0 ${
          b.result === "full"
            ? "text-emerald-600 dark:text-emerald-400"
            : b.result === "partial"
            ? "text-yellow-600 dark:text-yellow-400"
            : "text-gray-400"
        }`}
      >
        {labels[b.result]}
      </span>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    score >= 90
      ? "#10b981"
      : score >= 80
      ? "#22c55e"
      : score >= 70
      ? "#eab308"
      : score >= 60
      ? "#f97316"
      : "#ef4444";

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          className="text-gray-200 dark:text-[#2a2e2c]"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-gray-900 dark:text-[#f0f2f1]">{score}</span>
        <span className="text-[10px] text-gray-500 dark:text-[#9aa39e]">/ 100</span>
      </div>
    </div>
  );
}

function scenarioTypeLabel(scenarioType: string): string {
  const t = scenarioType.replace(/_/g, " ").trim();
  if (!t) return "ICU practice";
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Main page ────────────────────────────────────────────────────────────────

function FreeTalkSessionInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferredScenarioId = searchParams.get("scenarioId")?.trim() || undefined;

  const { data: me, isLoading: meLoading } = useUserCurrent();
  const { user: authUser } = useAuthStore();
  void authUser;

  const learnerId =
    me?.user != null && (me.user._id != null || me.user.id != null)
      ? String(me.user._id ?? me.user.id)
      : "";

  const abortRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const latestFeedbackRef = useRef("");
  const latestGradeRef = useRef<GradeResult | null>(null);
  const submitAttemptIdRef = useRef(0);
  const historyPersistedForAttemptRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>("loading");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [phrasesExpanded, setPhrasesExpanded] = useState(false);
  const [inputText, setInputText] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzingVoice, setIsAnalyzingVoice] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [scenarioSummaries, setScenarioSummaries] = useState<ScenarioSummary[] | null>(null);
  const [scenarioIndex, setScenarioIndex] = useState(0);

  const pro = !meLoading && learnerHasProAccess(me?.user);

  useEffect(() => {
    if (!meLoading && me?.user != null && !learnerHasProAccess(me.user)) {
      router.replace("/account/settings/subscriptions");
    }
  }, [meLoading, me, router]);

  const stopTts = useCallback(() => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.src = "";
      ttsAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  /** Fetches TTS audio blob without playing — call during loading to pre-warm. */
  const fetchTtsBlob = useCallback(async (text: string): Promise<Blob | null> => {
    try {
      const resp = await fetch('/api/v1/ai/free-talk/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text }),
      });
      if (!resp.ok) return null;
      return await resp.blob();
    } catch {
      return null;
    }
  }, []);

  /** Plays a pre-fetched audio blob immediately. */
  const playBlob = useCallback((blob: Blob) => {
    stopTts();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    ttsAudioRef.current = audio;
    setIsSpeaking(true);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      ttsAudioRef.current = null;
      setIsSpeaking(false);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      ttsAudioRef.current = null;
      setIsSpeaking(false);
    };
    audio.play().catch(() => setIsSpeaking(false));
  }, [stopTts]);

  const speakSituation = useCallback(async (text: string) => {
    const blob = await fetchTtsBlob(text);
    if (blob) playBlob(blob);
  }, [fetchTtsBlob, playBlob]);

  const loadScenarioByIndex = useCallback(
    async (index: number, list: ScenarioSummary[]) => {
      if (!list.length) return;
      const i = ((index % list.length) + list.length) % list.length;
      const scenarioId = list[i].id;

      stopTts();
      setPhase("loading");
      setScenario(null);
      setFeedbackText("");
      setGradeResult(null);
      setInputText("");
      setShowTextInput(false);
      setPhrasesExpanded(false);
      setScenarioIndex(i);

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      try {
        const s = await aiService.fetchFreeTalkScenario({ scenarioId, signal });
        const audioBlob = await fetchTtsBlob(s.situation);
        setScenario(s);
        setPhase("ready");
        if (audioBlob) playBlob(audioBlob);
      } catch (e: unknown) {
        if ((e as { name?: string })?.name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "";
        if (msg === "Subscription required") {
          router.replace("/account/settings/subscriptions");
          return;
        }
        toast.error(msg || "Failed to load scenario. Please try again.");
        setPhase("loading");
      }
    },
    [router, fetchTtsBlob, playBlob, stopTts]
  );

  const loadFreeTalkSession = useCallback(async () => {
    stopTts();
    setScenarioSummaries(null);
    setScenarioIndex(0);
    setPhase("loading");
    setScenario(null);
    setFeedbackText("");
    setGradeResult(null);
    setInputText("");
    setShowTextInput(false);
    setPhrasesExpanded(false);

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    try {
      const list = await aiService.fetchFreeTalkScenarioSummaries(signal);
      setScenarioSummaries(list);
      let start = 0;
      if (preferredScenarioId) {
        const ix = list.findIndex((s) => s.id === preferredScenarioId);
        if (ix >= 0) start = ix;
      }
      await loadScenarioByIndex(start, list);
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : "";
      if (msg === "Subscription required") {
        router.replace("/account/settings/subscriptions");
        return;
      }
      toast.error(msg || "Failed to load scenarios. Please try again.");
      setPhase("loading");
    }
  }, [router, loadScenarioByIndex, stopTts, preferredScenarioId]);

  const scenarioLoaded = useRef(false);
  useEffect(() => {
    if (!pro || meLoading) return;
    if (scenarioLoaded.current) return;
    scenarioLoaded.current = true;
    void loadFreeTalkSession();
    return () => {
      abortRef.current?.abort();
      scenarioLoaded.current = false;
    };
  }, [pro, meLoading, loadFreeTalkSession]);

  const handleGotIt = () => {
    stopTts();
    setPhase("responding");
  };

  const submitResponse = useCallback(
    async (response: string) => {
      if (!scenario || !response.trim()) return;
      const scen = scenario;
      const attemptId = ++submitAttemptIdRef.current;
      latestFeedbackRef.current = "";
      latestGradeRef.current = null;

      setPhase("grading");
      setFeedbackText("");
      setGradeResult(null);

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      let accumulated = "";
      let aborted = false;
      let streamCompleted = false;

      const persistAttemptHistory = () => {
        if (!learnerId) return;
        if (historyPersistedForAttemptRef.current === attemptId) return;
        const fb = latestFeedbackRef.current;
        const gr = latestGradeRef.current;
        if (!fb.trim() && !gr) return;
        appendFreeTalkHistoryEntry(learnerId, {
          scenarioId: scen.id,
          scenarioTitle: scen.title,
          scenarioType: scen.scenarioType,
          feedbackText: fb,
          gradeResult: gr,
        });
        historyPersistedForAttemptRef.current = attemptId;
      };

      try {
        await aiService.streamFreeTalkGrading(
          { userResponse: response.trim(), scenarioId: scen.id, signal },
          (chunk) => {
            if (chunk.type === "text" && typeof chunk.data === "string") {
              accumulated += chunk.data;
              latestFeedbackRef.current = accumulated;
              setFeedbackText(accumulated);
            } else if (chunk.type === "metadata") {
              const d = chunk.data as {
                fullText?: string;
                grade?: GradeResult;
              };
              if (d?.fullText) {
                latestFeedbackRef.current = d.fullText;
                setFeedbackText(d.fullText);
              }
              if (d?.grade) {
                latestGradeRef.current = d.grade;
                setGradeResult(d.grade);
              }
              setPhase("result");
            }
          }
        );
        // If metadata chunk was missing, still move to result with whatever text we have
        setPhase((p) => (p === "grading" ? "result" : p));
        streamCompleted = true;
      } catch (e: unknown) {
        if ((e as { name?: string })?.name === "AbortError") {
          aborted = true;
          return;
        }
        const msg = e instanceof Error ? e.message : "";
        if (msg === "Subscription required") {
          router.replace("/account/settings/subscriptions");
          return;
        }
        toast.error(msg || "Grading failed. Please try again.");
        setPhase("responding");
      }
      if (!aborted && streamCompleted) {
        persistAttemptHistory();
      }
    },
    [scenario, router, learnerId]
  );

  const handleSendText = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || phase !== "responding") return;
    setInputText("");
    await submitResponse(trimmed);
  };

  const startRecording = async () => {
    if (phase !== "responding" || isAnalyzingVoice) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = rec;

      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      rec.onstop = async () => {
        setIsRecording(false);
        releaseMediaStream(mediaStreamRef.current);
        mediaStreamRef.current = null;
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        if (!blob.size) return;

        setIsAnalyzingVoice(true);
        let transcript = "";
        try {
          transcript = (await aiService.transcribeAudio(blob)).trim();
        } catch {
          transcript = "";
        }
        setIsAnalyzingVoice(false);

        if (!transcript) {
          toast.error("Could not transcribe your voice. Please try again or use text input.");
          return;
        }
        await submitResponse(transcript);
      };

      rec.start();
      setIsRecording(true);
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err?.name === "NotAllowedError") {
        toast.error("Microphone access denied. You can use the keyboard instead.");
        setShowTextInput(true);
      } else {
        toast.error("Could not access the microphone.");
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const confirmLeave = () => {
    setShowLeaveModal(false);
    stopTts();
    abortRef.current?.abort();
    router.push("/account/practice/free-talk");
  };

  const scenarioTotal = scenarioSummaries?.length ?? 0;
  const handleNextScenario = () => {
    if (!scenarioSummaries?.length) return;
    stopTts();
    const next = (scenarioIndex + 1) % scenarioSummaries.length;
    void loadScenarioByIndex(next, scenarioSummaries);
  };

  const handleTryAgainSameScenario = () => {
    if (!scenarioSummaries?.length) return;
    stopTts();
    void loadScenarioByIndex(scenarioIndex, scenarioSummaries);
  };

  const handleDonePractice = () => {
    stopTts();
    abortRef.current?.abort();
    router.push("/account/practice/free-talk");
  };

  const stepWithinScenario =
    phase === "ready" ? "Step 1 of 2" : phase === "responding" ? "Step 2 of 2" : null;

  const headerRightLabel =
    scenarioTotal > 0
      ? phase === "ready" || phase === "responding"
        ? stepWithinScenario
          ? `${scenarioIndex + 1} / ${scenarioTotal} · ${stepWithinScenario}`
          : `${scenarioIndex + 1} / ${scenarioTotal}`
        : `${scenarioIndex + 1} / ${scenarioTotal}`
      : null;

  const scenarioBarPercent = (() => {
    if (scenarioTotal <= 0) return phase === "loading" ? 3 : 0;
    const slot =
      phase === "ready"
        ? 0.2
        : phase === "responding"
          ? 0.5
          : phase === "grading"
            ? 0.78
            : phase === "result"
              ? 1
              : phase === "loading"
                ? 0.06
                : 0.06;
    return Math.min(100, ((scenarioIndex + slot) / scenarioTotal) * 100);
  })();

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-white text-[#121217] dark:bg-[#0c0e0d] dark:text-[#f0f2f1]">
      <header className="sticky top-0 z-30 shrink-0 border-b border-[#e7eaed]/80 bg-white dark:border-[#2a2e2c] dark:bg-[#131614]">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-5 py-2 md:max-w-2xl">
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-[#d0d9e2]/40 bg-white/80 transition-colors hover:bg-[#fafafa] dark:border-[#3a3f3c] dark:bg-[#1a1d1c] dark:hover:bg-[#242825]"
            aria-label="Back"
          >
            <ChevronLeft className="h-[18px] w-[18px] text-[#121217] dark:text-[#c8cdc9]" />
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex h-5 items-center justify-between gap-2 text-[14px] leading-5 tracking-[-0.15px]">
              <p className="truncate font-satoshi font-medium text-[#171717] dark:text-[#f0f2f1]">
                {scenario
                  ? scenarioTypeLabel(scenario.scenarioType)
                  : scenarioSummaries?.[scenarioIndex]
                    ? scenarioTypeLabel(scenarioSummaries[scenarioIndex].scenarioType)
                    : "Eklan Free Talk"}
              </p>
              {headerRightLabel ? (
                <p className="shrink-0 max-w-[55%] truncate text-right font-sans text-[12px] text-[#6a7282] dark:text-[#9aa39e] sm:text-[13px]">
                  {headerRightLabel}
                </p>
              ) : phase === "grading" ? (
                <p className="shrink-0 font-sans text-xs text-[#6a7282]">Grading…</p>
              ) : null}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#e7eaed]/50 dark:bg-[#2a2e2c]">
              <div
                className="h-2 rounded-full bg-[#3b883e] transition-[width] duration-500 ease-out"
                style={{ width: `${scenarioBarPercent}%` }}
              />
            </div>
          </div>
          <div className="h-[30px] w-[30px] shrink-0" aria-hidden />
        </div>
      </header>

      <div
        className={`mx-auto w-full max-w-lg flex-1 overflow-y-auto px-5 pt-6 md:max-w-2xl ${
          phase === "ready" || phase === "responding"
            ? phase === "responding" && showTextInput
              ? "pb-40"
              : "pb-32"
            : "pb-8"
        }`}
      >
        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-[#9aa39e]">
            <Loader2 className="h-8 w-8 animate-spin text-[#3b883e]" />
            <p className="text-sm font-satoshi">Preparing your scenario…</p>
          </div>
        )}

        {(phase === "ready" || phase === "responding") && scenario && (
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dcfce7] dark:bg-emerald-950/50">
                  <Image src="/logo2.svg" alt="" width={22} height={22} className="object-contain" />
                </div>
                <div className="w-full rounded-2xl rounded-tl-sm border-[0.5px] border-[rgba(231,234,237,0.55)] bg-[rgba(252,252,252,0.92)] p-4 shadow-sm dark:border-[#2a2e2c] dark:bg-[#1a1d1c]/95">
                  <p className="mb-2 text-sm font-bold leading-5 text-[#3b883e] dark:text-emerald-400">
                    {scenario.title}
                  </p>
                  <p className="text-sm font-satoshi leading-relaxed text-[#171717] dark:text-[#e8ebe9]">
                    {scenario.situation}
                  </p>
                  <div className="mt-4 flex items-center gap-2.5 border-t border-transparent pt-1">
                    <span className="text-[#9ca3af]" title="Translate (coming soon)">
                      <Languages className="h-4 w-4" aria-hidden />
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        isSpeaking ? stopTts() : void speakSituation(scenario.situation)
                      }
                      className="rounded-full p-1 text-[#6b7280] transition-colors hover:bg-black/5 hover:text-[#3b883e] dark:text-[#9aa39e] dark:hover:bg-white/10"
                      aria-label={isSpeaking ? "Stop reading aloud" : "Read situation aloud"}
                    >
                      {isSpeaking ? (
                        <VolumeX className="h-4 w-4 text-[#3b883e]" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex flex-col items-center gap-4">
              <h2 className="text-center font-nunito text-xl font-bold leading-6 text-[#2a602c] dark:text-emerald-400">
                Your Turn !
              </h2>
              <div className="w-full rounded-2xl rounded-tl-3xl border-[0.5px] border-[rgba(231,234,237,0.55)] bg-[rgba(252,252,252,0.92)] p-4 shadow-sm dark:border-[#2a2e2c] dark:bg-[#1a1d1c]/95">
                <p className="text-center text-sm font-bold leading-relaxed text-[#6b7280] dark:text-[#9aa39e]">
                  {scenario.hint}
                </p>
                <div className="mt-4 flex items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => (isSpeaking ? stopTts() : void speakSituation(scenario.hint))}
                    className="rounded-full p-1 text-[#6b7280] transition-colors hover:bg-black/5 hover:text-[#3b883e] dark:text-[#9aa39e]"
                    aria-label="Listen to hint"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>
                {phase === "responding" && !showTextInput && (
                  <button
                    type="button"
                    onClick={() => setShowTextInput(true)}
                    className="mt-3 w-full text-center text-xs font-medium text-[#6b7280] underline decoration-[#6b7280]/40 underline-offset-2 hover:text-[#3b883e] dark:text-[#9aa39e]"
                  >
                    Can&apos;t use the microphone? Type your response
                  </button>
                )}
              </div>

              {scenario.usefulPhrases.length > 0 && (
                <div className="w-full rounded-2xl border border-[#e7eaed]/80 bg-[#fafafa]/80 p-4 dark:border-[#2a2e2c] dark:bg-[#131614]/80">
                  <button
                    type="button"
                    onClick={() => setPhrasesExpanded((s) => !s)}
                    className="flex w-full items-center justify-between text-left"
                    aria-expanded={phrasesExpanded}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#6b7280] dark:text-[#9aa39e]">
                      Useful phrases
                    </span>
                    {phrasesExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                  {phrasesExpanded && (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#374151] dark:text-[#c8cdc9]">
                      {scenario.usefulPhrases.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {phase === "responding" && showTextInput && (
                <div className="w-full rounded-2xl border border-[#e7eaed] bg-[#fafafa]/90 p-4 dark:border-[#2a2e2c] dark:bg-[#131614]/90">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b7280] dark:text-[#9aa39e]">
                    Type your response
                  </p>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.ctrlKey) {
                        e.preventDefault();
                        void handleSendText();
                      }
                    }}
                    placeholder="Type here… (Ctrl+Enter to send)"
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-[#e7eaed] bg-white px-3 py-2.5 text-sm text-[#171717] outline-none ring-[#3b883e]/20 focus:ring-2 dark:border-[#2a2e2c] dark:bg-[#0c0e0d] dark:text-[#f0f2f1]"
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTextInput(false)}
                      className="rounded-xl px-3 py-2 text-sm font-medium text-[#6b7280]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSendText()}
                      disabled={!inputText.trim()}
                      className="flex items-center gap-2 rounded-xl bg-[#3b883e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                      Send
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {phase === "grading" && (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#3b883e]" />
            <p className="text-sm text-[#6b7280] dark:text-[#9aa39e]">Grading your response…</p>
            {feedbackText && (
              <div className="w-full rounded-2xl border border-[#e7eaed] bg-white px-5 py-4 text-sm text-[#374151] dark:border-[#2a2e2c] dark:bg-[#131614] dark:text-[#c8cdc9]">
                <MarkdownText>{feedbackText}</MarkdownText>
              </div>
            )}
          </div>
        )}

        {phase === "result" && scenario && (
          <div className="space-y-4 pb-8">
            <div className="rounded-2xl border border-[#e7eaed] bg-white px-5 py-5 shadow-sm dark:border-[#2a2e2c] dark:bg-[#131614]">
              <div className="flex items-center gap-5">
                {gradeResult && <ScoreRing score={gradeResult.overallScore} />}
                <div className="min-w-0">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#6b7280] dark:text-[#9aa39e]">
                    {scenario.title}
                  </p>
                  {gradeResult && (
                    <>
                      <p className="font-nunito text-lg font-bold leading-tight text-[#171717] dark:text-[#f0f2f1]">
                        {gradeResult.competencyLevel}
                      </p>
                      <span
                        className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          getCompetencyColors(gradeResult.competencyLevel).bg
                        } ${getCompetencyColors(gradeResult.competencyLevel).text}`}
                      >
                        {gradeResult.rawScore} / {gradeResult.maxScore} pts
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {feedbackText && (
              <div className="rounded-2xl border border-[#e7eaed] bg-white px-5 py-4 dark:border-[#2a2e2c] dark:bg-[#131614]">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280] dark:text-[#9aa39e]">
                  Feedback
                </p>
                <div className="text-sm leading-relaxed text-[#374151] dark:text-[#c8cdc9]">
                  <MarkdownText>{feedbackText}</MarkdownText>
                </div>
              </div>
            )}

            {gradeResult && gradeResult.behaviours.length > 0 && (
              <div className="rounded-2xl border border-[#e7eaed] bg-white px-5 py-4 dark:border-[#2a2e2c] dark:bg-[#131614]">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280] dark:text-[#9aa39e]">
                  Clinical Communication Behaviours
                </p>
                <div>
                  {gradeResult.behaviours.map((b) => (
                    <BehaviourRow key={b.id} b={b} />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#6b7280] dark:text-[#9aa39e]">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Full (1 pt)
                  </span>
                  <span className="flex items-center gap-1">
                    <MinusCircle className="h-3.5 w-3.5 text-yellow-500" /> Partial (0.5 pt)
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5 text-red-400" /> None (0 pt)
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleNextScenario}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3b883e] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#2f6f32]"
            >
              <ChevronRight className="h-4 w-4" />
              Next
            </button>
            <button
              type="button"
              onClick={handleTryAgainSameScenario}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#e7eaed] py-3.5 text-sm font-semibold text-[#374151] transition-colors hover:bg-[#fafafa] dark:border-[#2a2e2c] dark:text-[#c8cdc9] dark:hover:bg-[#1a1d1c]"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
            <button
              type="button"
              onClick={handleDonePractice}
              className="w-full rounded-xl border border-[#e7eaed] py-3 text-sm font-semibold text-[#374151] dark:border-[#2a2e2c] dark:text-[#c8cdc9]"
            >
              Done
            </button>
          </div>
        )}
      </div>

      {(phase === "ready" || phase === "responding") && scenario && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center justify-end pb-[max(1rem,env(safe-area-inset-bottom))]">
          {phase === "responding" && isAnalyzingVoice && (
            <p className="pointer-events-auto mb-2 text-center text-xs text-[#606060] dark:text-[#9aa39e]">
              Analyzing your voice…
            </p>
          )}
          <div className="pointer-events-auto flex w-full max-w-lg flex-col items-center px-5 md:max-w-2xl">
            {phase === "ready" ? (
              <button
                type="button"
                onClick={handleGotIt}
                className="w-full max-w-sm rounded-2xl bg-[#3b883e] py-3.5 text-center text-sm font-semibold text-white shadow-lg transition-colors hover:bg-[#2f6f32]"
              >
                Got it — I&apos;m ready to respond
              </button>
            ) : (
              <div className="rounded-full bg-[rgba(76,175,80,0.12)] p-1.5 shadow-lg dark:bg-emerald-500/15">
                <button
                  type="button"
                  onClick={() => {
                    if (isRecording) stopRecording();
                    else void startRecording();
                  }}
                  disabled={isAnalyzingVoice}
                  className={`flex h-20 w-20 items-center justify-center rounded-full text-white transition-transform active:scale-95 disabled:opacity-40 ${
                    isRecording ? "bg-red-600 hover:bg-red-700" : "bg-[#3b883e] hover:bg-[#2f6f32]"
                  }`}
                  aria-label={isRecording ? "Stop recording" : "Start recording"}
                >
                  {isAnalyzingVoice ? (
                    <Loader2 className="h-9 w-9 animate-spin" />
                  ) : isRecording ? (
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                    </span>
                  ) : (
                    <Mic className="h-9 w-9" strokeWidth={2} />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leave modal */}
      {showLeaveModal && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/40"
            aria-label="Close"
            onClick={() => setShowLeaveModal(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 z-[70] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-[#131614] border border-gray-100 dark:border-[#2a2e2c] shadow-xl p-6"
            role="dialog"
            aria-labelledby="leave-title"
          >
            <h2
              id="leave-title"
              className="text-lg font-bold font-nunito text-gray-900 dark:text-[#f0f2f1] mb-2"
            >
              Leave this session?
            </h2>
            <p className="text-sm text-gray-600 dark:text-[#9aa39e] mb-6">
              In-progress work isn&apos;t saved. Completed attempts are kept in History on the Free Talk
              home screen.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={confirmLeave}
                className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold text-sm"
              >
                Leave
              </button>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="w-full py-3 rounded-xl border border-gray-200 dark:border-[#2a2e2c] text-gray-800 dark:text-[#c8cdc9] font-semibold text-sm"
              >
                Keep going
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function FreeTalkSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-white dark:bg-[#0c0e0d]">
          <Loader2 className="h-8 w-8 animate-spin text-[#3b883e]" />
          <p className="mt-4 text-sm text-[#9aa39e]">Loading Free Talk…</p>
        </div>
      }
    >
      <FreeTalkSessionInner />
    </Suspense>
  );
}
