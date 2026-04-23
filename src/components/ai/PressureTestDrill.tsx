"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  audioDurationMs: number;
  audioBase64: string;
}

interface PressureTestDrillProps {
  drillId: string;
}

const TOTAL_TURNS = 3;
const MAX_AUDIO_SIZE = 5 * 1024 * 1024;

function getInitialPrompt(drill: any): string {
  if (Array.isArray(drill?.roleplay_scenes) && drill.roleplay_scenes.length > 0) {
    const scene = drill.roleplay_scenes[0];
    // Prefer scene context, then the first AI dialogue line, then scene_name
    if (typeof scene?.context === "string" && scene.context.trim()) return scene.context.trim();
    const aiLine = (scene?.dialogue as any[] | undefined)?.find(
      (d: any) => d.speaker !== "student" && typeof d.text === "string",
    );
    if (aiLine) return aiLine.text.trim();
    if (typeof scene?.scene_name === "string" && scene.scene_name.trim())
      return `Scene: ${scene.scene_name.trim()}. What would you say in this situation?`;
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

export function PressureTestDrill({ drillId }: PressureTestDrillProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: drill } = useDrill(drillId);

  const [studentLevel, setStudentLevel] = useState<number>(1);
  const [messages, setMessages] = useState<Message[]>([]);
  const [turnNumber, setTurnNumber] = useState(1);
  const [isAiTyping, setIsAiTyping] = useState(false);
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

  const {
    playAudio: playTTS,
    stopAudio: stopTTS,
    isGenerating: isTTSGenerating,
    isPlaying: isTTSPlaying,
  } = useTTS({
    onError: () => {}, // silent — TTS is best-effort
    apiPath: "/api/v1/pressure-test/tts",
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiDoneAtRef = useRef<number | null>(null);
  const pendingLatencyRef = useRef<number>(0);

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

  const firstName = useMemo(
    () => String(user?.firstName || user?.name || "there").trim().split(" ")[0],
    [user],
  );

  const progressWidth = `${(turnNumber / TOTAL_TURNS) * 100}%`;

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

    // Cancel any in-flight analysis request
    analyzeAbortRef.current?.abort();
    analyzeAbortRef.current = null;

    // Stop TTS playback
    stopTTS();

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
  }, [stopTTS, stopVisualizer]);

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

  // Track whether we've already kicked off the intro fetch so re-renders don't repeat it.
  const chatInitialisedRef = useRef(false);

  useEffect(() => {
    if (!drill || !firstName || chatInitialisedRef.current) return;
    chatInitialisedRef.current = true;

    const intro = `Hello ${firstName} 👋 The pressure test is to help you respond naturally in day-to-day conversation. Let's get started.`;

    // Show the intro immediately + an empty typing bubble for the AI scenario
    setMessages([
      { role: "ai", text: intro },
      { role: "ai", text: "" },
    ]);
    setIsAiTyping(true);

    const fallback = getInitialPrompt(drill);

    const showFallback = () => {
      setMessages([
        { role: "ai", text: intro },
        { role: "ai", text: fallback },
      ]);
      setIsAiTyping(false);
      aiDoneAtRef.current = Date.now();
      // TTS reads both intro and fallback scenario
      void playTTS(`${intro} ${fallback}`);
    };

    // Abort if the server takes more than 6 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    fetch("/api/v1/pressure-test/chat", {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // A hidden "begin" turn — never shown in the UI
        messages: [{ role: "user", content: "begin" }],
        level: studentLevel,
        turnNumber: 1,
        drillId,
      }),
    })
      .then(async (res) => {
        if (!res.ok || !res.body) { showFallback(); return; }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let text = "";
        while (true) {
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
        if (!text) showFallback();
        else {
          setIsAiTyping(false);
          aiDoneAtRef.current = Date.now();
          // Speak intro + scenario together so display and audio match
          void playTTS(`${intro} ${text}`);
        }
      })
      .catch(() => showFallback())
      .finally(() => clearTimeout(timeoutId));

    return () => { controller.abort(); clearTimeout(timeoutId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill, firstName]);

  useEffect(() => {
    return () => {
      stopAllActivity();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [stopAllActivity, previewUrl]);

  const startRecording = useCallback(async () => {
    if (isRecording || isAnalyzing || isAiTyping) return;
    // Stop any AI voice so it doesn't bleed into the student's microphone
    stopTTS();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      pendingLatencyRef.current = aiDoneAtRef.current ? Date.now() - aiDoneAtRef.current : 0;

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
  }, [isAiTyping, isAnalyzing, isRecording, previewUrl, recordingMs, startVisualizer, stopTTS]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // Capture actual duration here (not in onstop closure which has stale state)
    setRecordedDurationMs(Date.now() - startedAtRef.current);
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    stopVisualizer();
    setWaveBars(Array.from({ length: 56 }, () => 0.18));
    // Stop Web Speech API and let it finalise any pending results
    try { recognitionRef.current?.stop(); } catch (_) {}
  }, [isRecording, stopVisualizer]);

  const resetRecording = useCallback(() => {
    setRecordedAudio(null);
    setRecordedDurationMs(0);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
  }, [previewUrl]);

  const formatDuration = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    return `0:${secs.toString().padStart(2, "0")}`;
  };

  const streamAiReply = useCallback(
    async (nextMessages: Message[], level = studentLevel) => {
      const payloadMessages = nextMessages.map((m) => ({
        role: m.role === "ai" ? "model" : "user",
        content: m.text,
      }));

      const response = await fetch("/api/v1/pressure-test/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: payloadMessages,
          level,
          turnNumber: Math.min(turnNumber + 1, TOTAL_TURNS),
          drillId,
        }),
      });
      if (!response.ok || !response.body) {
        throw new Error("Failed to stream pressure test response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalText = "";
      setIsAiTyping(true);
      setMessages((prev) => [...prev, { role: "ai", text: "" }]);

      const updateLastAi = (text: string) => {
        setMessages((prev) => {
          const copy = [...prev];
          const idx = copy.length - 1;
          copy[idx] = { role: "ai", text };
          return copy;
        });
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let end = buffer.indexOf("\n\n");
        while (end !== -1) {
          const evt = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (evt.startsWith("data: ")) {
            const parsed = JSON.parse(evt.slice(6));
            if (parsed.type === "text" && typeof parsed.data === "string") {
              finalText += parsed.data;
              updateLastAi(finalText);
            }
          }
          end = buffer.indexOf("\n\n");
        }
      }

      if (!finalText) {
        // Gemini returned no text (rate-limit / quota). Replace the empty bubble with
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
      }
      setIsAiTyping(false);
      aiDoneAtRef.current = Date.now();
      return finalText;
    },
    [drillId, studentLevel, turnNumber],
  );

  const submitTurn = useCallback(async () => {
    if (!recordedAudio || isAiTyping || isAnalyzing || isTranscribing) return;

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
        [...messages].reverse().find((m) => m.role === "ai")?.text || "Prompt unavailable";
      const audioBase64 = await blobToBase64(recordedAudio);
      const turnDraft: TurnDraft = {
        turnNumber,
        aiPrompt: latestAiPrompt,
        studentResponseText: userText,
        latencyMs: pendingLatencyRef.current,
        audioDurationMs: recordedDurationMs,
        audioBase64,
      };
      const nextTurns = [...turns, turnDraft];
      setTurns(nextTurns);
      resetRecording();
      setMessages((prev) => [...prev, { role: "user", text: userText }]);

      if (turnNumber >= TOTAL_TURNS) {
        setIsAnalyzing(true);
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

      const historyWithUser = [...messages, { role: "user" as const, text: userText }];
      const aiText = await streamAiReply(historyWithUser, studentLevel);
      if (isExitingRef.current) return;
      setTurnNumber((prev) => prev + 1);
      // Speak the AI's follow-up prompt aloud
      if (aiText) void playTTS(aiText);
    } catch (error: any) {
      toast.error(error?.message || "Failed to process this turn.");
      setIsAiTyping(false);
      setIsAnalyzing(false);
      setIsTranscribing(false);
    }
  }, [
    drillId,
    isAiTyping,
    isAnalyzing,
    isTranscribing,
    messages,
    playTTS,
    recordedAudio,
    recordedDurationMs,
    resetRecording,
    streamAiReply,
    studentLevel,
    turnNumber,
    turns,
  ]);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-gray-50">
      <header className="flex-shrink-0 bg-white border-b border-gray-100 z-10">
        <div className="max-w-2xl mx-auto w-full px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => { stopAllActivity(); router.back(); }}
                className="w-8 h-8 rounded-full bg-[#eff0ef] flex items-center justify-center"
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4 text-[#2f2f2f]" />
              </button>
              <h1 className="text-md font-semibold text-gray-900 leading-tight">Pressure Test</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-md font-medium text-gray-500 tabular-nums">
                {turnNumber} of {TOTAL_TURNS}
              </span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="More options"
                >
                  <MoreVertical className="w-5 h-5 text-gray-500" />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-10 z-40 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenu(false);
                          stopAllActivity();
                          router.back();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
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
          <div className="ml-10 mt-2.5 h-1 rounded-full bg-[#dedede] overflow-hidden">
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
                const currentAiIdx = aiIdx++;
                return (
                  <section key={`ai-${idx}`} className="bg-[#f4f5f4] border border-[#ebebeb] rounded-2xl p-4">
                    <div className="w-10 h-10 rounded-full bg-[#d9f1da] flex items-center justify-center mb-3">
                      <Image src="/logo2.svg" alt="Eklan" width={20} height={20} />
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {currentAiIdx === 0 ? (
                        // Intro bubble — styled greeting
                        <>
                          <span className="font-semibold text-emerald-600">Hello {firstName} 👋 </span>
                          {msg.text.replace(/^Hello\s+\S+\s*👋\s*/i, "")}
                        </>
                      ) : msg.text ? (
                        // Scenario bubble
                        <span className="font-semibold text-emerald-700">{msg.text}</span>
                      ) : (
                        // Typing indicator while AI is streaming
                        <span className="inline-flex gap-1 items-center text-gray-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-3 mt-3 text-gray-700">
                      <Languages className="w-4 h-4" />
                      <button
                        type="button"
                        onClick={() => {
                          if (isTTSGenerating || isTTSPlaying) {
                            stopTTS();
                          } else {
                            void playTTS(msg.text);
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

          {isAnalyzing && (
            <div className="fixed inset-0 z-40 bg-gray-50/95 flex flex-col items-center justify-center px-8">
              <p className="text-6xl mb-4">👏</p>
              <h2 className="text-[50px] font-bold text-slate-800 mb-1 leading-none">Nice work!</h2>
              <p className="text-[35px] text-slate-500 mb-8 text-center leading-tight">You just completed a Pressure Test</p>
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-4 animate-[pulse_1.8s_ease-in-out_infinite]">
                <Image src="/logo2.svg" alt="Eklan" width={34} height={34} />
              </div>
              <p className="text-[32px] text-slate-600 leading-tight">Analyzing your responses...</p>
            </div>
          )}
        </div>
      </main>

      <footer className="flex-shrink-0 bg-white border-t border-gray-100 z-10">
        <div className="max-w-2xl mx-auto w-full px-4 pt-3 pb-2">

          {/* ── Recording state: label + live waveform ─── */}
          {isRecording && (
            <>
              <p className="text-center text-sm text-gray-700 mb-2">
                🎙 Your turn &nbsp;<span className="text-gray-400">Tap to Speak</span>
              </p>
              <div className="bg-[#f6f7f6] border border-[#ebedeb] rounded-full px-3 py-2 mb-4 flex items-center gap-2">
                <div className="flex-1 h-7 flex items-center gap-[1px] overflow-hidden">
                  {waveBars.map((v, i) => (
                    <span
                      key={i}
                      className="w-[2px] rounded-full bg-emerald-500/80"
                      style={{ height: `${Math.round(4 + v * 18)}px` }}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-500 tabular-nums pr-1">
                  {formatDuration(recordingMs)}
                </span>
              </div>
            </>
          )}

          {/* ── Recorded / preview state ─── */}
          {recordedAudio && !isRecording && (
            <>
              <p className="text-center text-xs text-gray-400 mb-2">
                preview your recording using the play button
              </p>
              <div className="bg-[#f6f7f6] border border-[#ebedeb] rounded-full px-3 py-2 mb-4 flex items-center gap-2">
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
                <span className="text-xs text-gray-500 tabular-nums">{formatDuration(recordedDurationMs)}</span>
                <button
                  type="button"
                  onClick={resetRecording}
                  className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            </>
          )}

          {/* ── Idle hint ─── */}
          {!isRecording && !recordedAudio && (
            <p className="text-center text-xs text-gray-400 mb-3">
              {isAiTyping ? "Eklan is thinking…" : isTranscribing ? "Processing…" : "Tap to speak"}
            </p>
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
