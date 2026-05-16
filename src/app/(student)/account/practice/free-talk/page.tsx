"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Keyboard,
  Loader2,
  Mic,
  Send,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { aiService } from "@/services/ai.service";
import { MarkdownText } from "@/components/ui/MarkdownText";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { useAuthStore } from "@/store/auth-store";
import { learnerHasProAccess } from "@/utils/learner-subscription";
import { releaseMediaStream } from "@/lib/ios-audio-utils";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "loading" | "ready" | "responding" | "grading" | "result";

interface Scenario {
  title: string;
  situation: string;
  hint: string;
  usefulPhrases: string[];
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FreeTalkPage() {
  const router = useRouter();
  const { data: me, isLoading: meLoading } = useUserCurrent();
  const { user: authUser } = useAuthStore();
  void authUser;

  const abortRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

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

  const loadScenario = useCallback(async () => {
    stopTts();
    setPhase("loading");
    setScenario(null);
    setFeedbackText("");
    setGradeResult(null);
    setInputText("");
    setShowTextInput(false);
    setPhrasesExpanded(false);
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      // Fetch scenario, then pre-fetch TTS during loading so audio plays the instant the card appears
      const s = await aiService.fetchFreeTalkScenario(abortRef.current.signal);
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
  }, [router, fetchTtsBlob, playBlob, stopTts]);

  const scenarioLoaded = useRef(false);
  useEffect(() => {
    if (!pro || meLoading) return;
    if (scenarioLoaded.current) return;
    scenarioLoaded.current = true;
    void loadScenario();
    return () => {
      abortRef.current?.abort();
      scenarioLoaded.current = false;
    };
  }, [pro, meLoading, loadScenario]);

  const handleGotIt = () => {
    stopTts();
    setPhase("responding");
  };

  const submitResponse = useCallback(
    async (response: string) => {
      if (!scenario || !response.trim()) return;
      setPhase("grading");
      setFeedbackText("");
      setGradeResult(null);

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      let accumulated = "";

      try {
        await aiService.streamFreeTalkGrading(
          { userResponse: response.trim(), scenarioTitle: scenario.title, signal },
          (chunk) => {
            if (chunk.type === "text" && typeof chunk.data === "string") {
              accumulated += chunk.data;
              setFeedbackText(accumulated);
            } else if (chunk.type === "metadata") {
              const d = chunk.data as {
                fullText?: string;
                grade?: GradeResult;
              };
              if (d?.fullText) setFeedbackText(d.fullText);
              if (d?.grade) setGradeResult(d.grade);
              setPhase("result");
            }
          }
        );
        // If metadata chunk was missing, still move to result with whatever text we have
        setPhase((p) => (p === "grading" ? "result" : p));
      } catch (e: unknown) {
        if ((e as { name?: string })?.name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "";
        if (msg === "Subscription required") {
          router.replace("/account/settings/subscriptions");
          return;
        }
        toast.error(msg || "Grading failed. Please try again.");
        setPhase("responding");
      }
    },
    [scenario, router]
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
    router.push("/account/practice");
  };

  const handleTryAnother = () => {
    stopTts();
    void loadScenario();
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex flex-col h-[100dvh] bg-gray-50 text-gray-900 dark:bg-[#0c0e0d] dark:text-[#f0f2f1]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white dark:bg-[#131614] border-b border-gray-100 dark:border-[#2a2e2c]">
        <div className="flex items-center px-4 py-3 max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            className="p-2.5 -ml-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#1a1d1c] transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-[#9aa39e]" />
          </button>
          <div className="flex items-center flex-1 ml-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <Image src="/logo2.svg" alt="Eklan" width={24} height={24} />
            </div>
            <div className="ml-3 min-w-0">
              <h1 className="text-sm font-semibold text-gray-900 dark:text-[#f0f2f1] truncate">
                Eklan Free Talk
              </h1>
              <p className="text-xs text-gray-500 dark:text-[#9aa39e] truncate">
                {phase === "loading"
                  ? "Preparing scenario…"
                  : phase === "ready"
                  ? "Read the situation below"
                  : phase === "responding"
                  ? "Submit your response"
                  : phase === "grading"
                  ? "Grading your response…"
                  : "Your result"}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full">
        {/* Loading */}
        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400 dark:text-[#9aa39e]">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-sm">Preparing your scenario…</p>
          </div>
        )}

        {/* Situation Card (ready phase) */}
        {(phase === "ready" || phase === "responding") && scenario && (
          <div className="space-y-4">
            {/* Scenario banner when in responding phase */}
            {phase === "responding" && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-0.5">
                  Active Scenario
                </p>
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">
                  {scenario.title}
                </p>
              </div>
            )}

            {phase === "ready" && (
              <>
                {/* Full situation card */}
                <div className="rounded-2xl bg-white dark:bg-[#131614] border border-gray-200 dark:border-[#2a2e2c] shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-[#2a2e2c]">
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">
                      Scenario
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-base font-bold font-nunito text-gray-900 dark:text-[#f0f2f1]">
                        {scenario.title}
                      </h2>
                      <button
                        type="button"
                        onClick={() =>
                          isSpeaking
                            ? stopTts()
                            : void speakSituation(scenario.situation)
                        }
                        className="shrink-0 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#1a1d1c] transition-colors"
                        aria-label={isSpeaking ? "Stop reading" : "Read situation aloud"}
                      >
                        {isSpeaking ? (
                          <VolumeX className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Volume2 className="w-5 h-5 text-gray-400 dark:text-[#9aa39e]" />
                        )}
                      </button>
                    </div>
                    {isSpeaking && (
                      <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                        </span>
                        Reading aloud…
                      </p>
                    )}
                  </div>

                  <div className="px-5 py-4 border-b border-gray-100 dark:border-[#2a2e2c]">
                    <p className="text-xs font-semibold text-gray-500 dark:text-[#9aa39e] uppercase tracking-wide mb-2">
                      Situation
                    </p>
                    <p className="text-sm leading-relaxed text-gray-800 dark:text-[#e8ebe9]">
                      {scenario.situation}
                    </p>
                  </div>

                  <div className="px-5 py-4 border-b border-gray-100 dark:border-[#2a2e2c]">
                    <p className="text-xs font-semibold text-gray-500 dark:text-[#9aa39e] uppercase tracking-wide mb-2">
                      What to cover
                    </p>
                    <p className="text-sm leading-relaxed text-gray-800 dark:text-[#e8ebe9]">
                      {scenario.hint}
                    </p>
                  </div>

                  {scenario.usefulPhrases.length > 0 && (
                    <div className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setPhrasesExpanded((s) => !s)}
                        className="flex items-center justify-between w-full text-left"
                        aria-expanded={phrasesExpanded}
                      >
                        <p className="text-xs font-semibold text-gray-500 dark:text-[#9aa39e] uppercase tracking-wide">
                          Useful phrases
                        </p>
                        {phrasesExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      {phrasesExpanded && (
                        <ul className="mt-3 list-disc pl-5 space-y-1">
                          {scenario.usefulPhrases.map((p) => (
                            <li
                              key={p}
                              className="text-sm text-gray-700 dark:text-[#c8cdc9]"
                            >
                              {p}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Got it CTA */}
                <button
                  type="button"
                  onClick={handleGotIt}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors"
                >
                  Got it — I&apos;m ready to respond
                </button>
              </>
            )}

            {/* Input controls (responding phase) */}
            {phase === "responding" && (
              <div className="space-y-3 mt-2">
                <p className="text-sm text-gray-600 dark:text-[#9aa39e] text-center">
                  Respond to the scenario as you would in a real clinical setting.
                </p>

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTextInput((s) => !s)}
                    className="p-3 rounded-xl border border-gray-200 dark:border-[#2a2e2c] text-gray-600 dark:text-[#9aa39e] hover:bg-gray-50 dark:hover:bg-[#1a1d1c]"
                    aria-label={showTextInput ? "Hide keyboard" : "Show keyboard"}
                  >
                    <Keyboard className="w-5 h-5" />
                  </button>

                  {showTextInput ? (
                    <>
                      <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.ctrlKey) {
                            e.preventDefault();
                            void handleSendText();
                          }
                        }}
                        placeholder="Type your response… (Ctrl+Enter to send)"
                        rows={3}
                        className="flex-1 min-w-0 rounded-xl border border-gray-200 dark:border-[#2a2e2c] bg-white dark:bg-[#0c0e0d] px-3 py-2.5 text-sm text-gray-900 dark:text-[#f0f2f1] resize-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSendText()}
                        disabled={!inputText.trim()}
                        className="p-3 rounded-xl bg-emerald-600 text-white disabled:opacity-40 self-end"
                        aria-label="Send"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (isRecording) { stopRecording(); } else { void startRecording(); }
                      }}
                      disabled={isAnalyzingVoice}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-colors ${
                        isRecording
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-emerald-600 hover:bg-emerald-700"
                      } disabled:opacity-40`}
                    >
                      {isAnalyzingVoice ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Analyzing voice…
                        </>
                      ) : isRecording ? (
                        <>
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                          </span>
                          Tap to stop
                        </>
                      ) : (
                        <>
                          <Mic className="w-5 h-5" />
                          Tap to speak
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Grading state */}
        {phase === "grading" && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-sm text-gray-600 dark:text-[#9aa39e]">
              Grading your response…
            </p>
            {feedbackText && (
              <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#131614] border border-gray-200 dark:border-[#2a2e2c] px-5 py-4 text-sm text-gray-700 dark:text-[#c8cdc9]">
                <MarkdownText>{feedbackText}</MarkdownText>
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {phase === "result" && scenario && (
          <div className="space-y-4 pb-8">
            {/* Score card */}
            <div className="rounded-2xl bg-white dark:bg-[#131614] border border-gray-200 dark:border-[#2a2e2c] shadow-sm px-5 py-5">
              <div className="flex items-center gap-5">
                {gradeResult && <ScoreRing score={gradeResult.overallScore} />}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-500 dark:text-[#9aa39e] uppercase tracking-wide mb-1">
                    {scenario.title}
                  </p>
                  {gradeResult && (
                    <>
                      <p className="text-lg font-bold font-nunito text-gray-900 dark:text-[#f0f2f1] leading-tight">
                        {gradeResult.competencyLevel}
                      </p>
                      <span
                        className={`mt-1.5 inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${
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

            {/* Feedback */}
            {feedbackText && (
              <div className="rounded-2xl bg-white dark:bg-[#131614] border border-gray-200 dark:border-[#2a2e2c] px-5 py-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-[#9aa39e] uppercase tracking-wide mb-3">
                  Feedback
                </p>
                <div className="text-sm text-gray-800 dark:text-[#c8cdc9] leading-relaxed">
                  <MarkdownText>{feedbackText}</MarkdownText>
                </div>
              </div>
            )}

            {/* Behaviour checklist */}
            {gradeResult && gradeResult.behaviours.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-[#131614] border border-gray-200 dark:border-[#2a2e2c] px-5 py-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-[#9aa39e] uppercase tracking-wide mb-3">
                  Clinical Communication Behaviours
                </p>
                <div>
                  {gradeResult.behaviours.map((b) => (
                    <BehaviourRow key={b.id} b={b} />
                  ))}
                </div>
                {/* Legend */}
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-[#9aa39e]">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Full (1 pt)
                  </span>
                  <span className="flex items-center gap-1">
                    <MinusCircle className="w-3.5 h-3.5 text-yellow-500" /> Partial (0.5 pt)
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5 text-red-400" /> None (0 pt)
                  </span>
                </div>
              </div>
            )}

            {/* Try another */}
            <button
              type="button"
              onClick={handleTryAnother}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try another scenario
            </button>
            <button
              type="button"
              onClick={() => router.push("/account/practice")}
              className="w-full py-3 rounded-xl border border-gray-200 dark:border-[#2a2e2c] text-gray-700 dark:text-[#c8cdc9] font-semibold text-sm"
            >
              Back to Practice
            </button>
          </div>
        )}
      </div>

      {/* Leave modal */}
      {showLeaveModal && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40"
            aria-label="Close"
            onClick={() => setShowLeaveModal(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-[#131614] border border-gray-100 dark:border-[#2a2e2c] shadow-xl p-6"
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
              Your progress in this session won&apos;t be saved.
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
