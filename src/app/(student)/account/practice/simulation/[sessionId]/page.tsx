"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { X, Mic, Loader2, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { releaseMediaStream } from "@/lib/ios-audio-utils";
import { Button } from "@/components/ui/Button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScenarioPhase {
  phaseName: string;
}

interface SessionDetail {
  sessionId: string;
  status: "in_progress" | "completed" | "abandoned";
  startedAt: string;
  currentPhaseIndex: number;
  briefingComplete: boolean;
  scenario: {
    title: string;
    maxDurationMinutes: number;
    studentHint: string;
    phases: ScenarioPhase[];
  };
}

interface Finding {
  label: string;
  data: string;
}

type UiPhase =
  | "loading"
  | "briefing"
  | "awaitingStart"
  | "starting"
  | "active"
  | "recording"
  | "processing"
  | "completed"
  | "error";

// ─── SSE parsing (shared between /turn and /opening) ───────────────────────

interface SseHandlers {
  onText?: (text: string) => void;
  onAudio?: (data: string) => void;
  onReveal?: (findings: Finding[]) => void;
  onPhaseAdvance?: (newPhaseIndex: number) => void;
}

async function readSimulationSSE(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: SseHandlers = {},
): Promise<{ audioChunks: string[]; textAccum: string }> {
  const decoder = new TextDecoder();
  let buffer = "";
  const audioChunks: string[] = [];
  let textAccum = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);

      if (rawEvent.startsWith("data: ")) {
        try {
          const parsed = JSON.parse(rawEvent.slice("data: ".length));
          if (parsed?.type === "reveal" && Array.isArray(parsed.findings)) {
            handlers.onReveal?.(parsed.findings);
          } else if (parsed?.type === "audio" && typeof parsed.data === "string") {
            audioChunks.push(parsed.data);
            handlers.onAudio?.(parsed.data);
          } else if (parsed?.type === "text" && typeof parsed.data === "string") {
            textAccum += parsed.data;
            handlers.onText?.(parsed.data);
          } else if (parsed?.type === "phaseAdvance" && typeof parsed.newPhaseIndex === "number") {
            handlers.onPhaseAdvance?.(parsed.newPhaseIndex);
          }
        } catch {
          // partial/malformed SSE frame split across reads — ignore
        }
      }

      boundary = buffer.indexOf("\n\n");
    }
  }

  return { audioChunks, textAccum };
}

async function playPcmAudio(
  audioChunks: string[],
  playbackAudioRef: React.MutableRefObject<HTMLAudioElement | null>,
  onFinished: () => void,
): Promise<void> {
  if (audioChunks.length === 0) {
    onFinished();
    return;
  }

  try {
    const wavRes = await fetch("/api/v1/simulation/audio/wav", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pcmBase64Chunks: audioChunks }),
    });

    if (!wavRes.ok) {
      onFinished();
      return;
    }

    const wavJson = await wavRes.json();
    const audio = new Audio(`data:audio/wav;base64,${wavJson.data.wavBase64}`);
    playbackAudioRef.current = audio;
    audio.onended = onFinished;
    audio.onerror = onFinished;
    audio.play().catch(onFinished);
  } catch {
    // Audio playback is best-effort; a failed conversion shouldn't block the turn.
    onFinished();
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SimulationSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [uiPhase, setUiPhase] = useState<UiPhase>("loading");
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [briefingText, setBriefingText] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [timeRemainingLabel, setTimeRemainingLabel] = useState("");

  const [displayMode, setDisplayMode] = useState<"caption" | "findings">("caption");
  const [captionText, setCaptionText] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const briefingAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);

  // ─── Load session detail + play briefing on mount ───────────────────────────

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [sessionRes, briefingRes] = await Promise.all([
          fetch(`/api/v1/simulation/sessions/${sessionId}`, { credentials: "include" }),
          fetch(`/api/v1/simulation/sessions/${sessionId}/briefing`, { credentials: "include" }),
        ]);

        if (!sessionRes.ok) throw new Error("Failed to load session");
        if (!briefingRes.ok) throw new Error("Failed to load briefing");

        const sessionJson = await sessionRes.json();
        const briefingJson = await briefingRes.json();
        if (cancelled) return;

        setSession(sessionJson.data);

        if (sessionJson.data.briefingComplete) {
          // Returning to an already-started session (e.g. after a refresh).
          setUiPhase("active");
          return;
        }

        setBriefingText(briefingJson.data.displayText || "");
        setUiPhase("briefing");

        const audio = new Audio(`data:audio/wav;base64,${briefingJson.data.audioBase64}`);
        briefingAudioRef.current = audio;
        const finishBriefing = () => {
          if (cancelled) return;
          setBriefingText("");
          setUiPhase("awaitingStart");
        };
        audio.onended = finishBriefing;
        audio.onerror = finishBriefing;
        audio.play().catch(finishBriefing);
      } catch {
        if (cancelled) return;
        toast.error("Could not load this session. Please try again.");
        setUiPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      briefingAudioRef.current?.pause();
      playbackAudioRef.current?.pause();
      releaseMediaStream(mediaStreamRef.current);
    };
  }, [sessionId]);

  // ─── Phase time remaining ─────────────────────────────────────────────────

  useEffect(() => {
    if (!session) return;

    const endTime =
      new Date(session.startedAt).getTime() + session.scenario.maxDurationMinutes * 60_000;

    const tick = () => {
      const remainingMs = Math.max(0, endTime - Date.now());
      const totalSeconds = Math.floor(remainingMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setTimeRemainingLabel(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session]);

  // ─── Start ────────────────────────────────────────────────────────────────

  const handleStart = async () => {
    setUiPhase("starting");
    try {
      const res = await fetch(`/api/v1/simulation/sessions/${sessionId}/start`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to start session");

      const openingRes = await fetch(`/api/v1/simulation/sessions/${sessionId}/opening`, {
        method: "POST",
        credentials: "include",
      });
      if (!openingRes.ok || !openingRes.body) throw new Error("Failed to generate opening line");

      const { audioChunks, textAccum } = await readSimulationSSE(openingRes.body.getReader());

      setCaptionText(textAccum);
      setDisplayMode("caption");

      await playPcmAudio(audioChunks, playbackAudioRef, () => setUiPhase("active"));
    } catch {
      toast.error("Could not start the session. Please try again.");
      setUiPhase("awaitingStart");
    }
  };

  // ─── Turn submission (SSE) ────────────────────────────────────────────────

  const submitTurn = useCallback(
    async (blob: Blob) => {
      setUiPhase("processing");
      try {
        const formData = new FormData();
        formData.append("audio", blob, "turn.webm");

        const res = await fetch(`/api/v1/simulation/sessions/${sessionId}/turn`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (!res.ok) throw new Error("Turn request failed");

        const contentType = res.headers.get("Content-Type") || "";
        if (contentType.includes("application/json")) {
          // No phases left — the endpoint short-circuits with a plain JSON body.
          const json = await res.json();
          if (json?.data?.sessionComplete) {
            setUiPhase("completed");
            return;
          }
          setUiPhase("active");
          return;
        }

        if (!res.body) throw new Error("Turn response had no body");

        let revealedThisTurn = false;
        const { audioChunks, textAccum } = await readSimulationSSE(res.body.getReader(), {
          onReveal: (revealedFindings) => {
            revealedThisTurn = true;
            setFindings(revealedFindings);
            setDisplayMode("findings");
          },
          onPhaseAdvance: (newPhaseIndex) => {
            setSession((prev) => (prev ? { ...prev, currentPhaseIndex: newPhaseIndex } : prev));
          },
        });

        if (!revealedThisTurn) {
          setCaptionText(textAccum);
          setDisplayMode("caption");
        }

        if (audioChunks.length > 0) {
          void playPcmAudio(audioChunks, playbackAudioRef, () => {
            /* autoplay may be blocked — non-fatal */
          });
        }

        setUiPhase("active");
      } catch {
        toast.error("Something went wrong processing your turn. Please try again.");
        setUiPhase("active");
      }
    },
    [sessionId],
  );

  // ─── Mic recording ────────────────────────────────────────────────────────

  const startRecording = async () => {
    if (uiPhase !== "active") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        releaseMediaStream(mediaStreamRef.current);
        mediaStreamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (!blob.size) {
          setUiPhase("active");
          return;
        }
        await submitTurn(blob);
      };

      recorder.start();
      setUiPhase("recording");
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err?.name === "NotAllowedError") {
        toast.error("Microphone access denied. Please allow microphone access to continue.");
      } else {
        toast.error("Could not access the microphone.");
      }
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  // ─── Close / leave ────────────────────────────────────────────────────────

  const handleClose = () => {
    const confirmed = window.confirm(
      "Leave this simulation? Your progress will be saved, but the session will end for now.",
    );
    if (!confirmed) return;
    releaseMediaStream(mediaStreamRef.current);
    router.push("/account/practice/simulation");
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (uiPhase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (uiPhase === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="font-nunito text-foreground">This session could not be loaded.</p>
        <Button onClick={() => router.push("/account/practice/simulation")}>
          Back to Simulation Room
        </Button>
      </div>
    );
  }

  const currentPhaseName =
    session?.scenario.phases[session.currentPhaseIndex]?.phaseName ?? "";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <button
          onClick={handleClose}
          aria-label="Close simulation"
          className="rounded-full p-2 text-muted-foreground hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center">
          <span className="font-nunito text-sm font-semibold text-foreground">
            {currentPhaseName}
          </span>
          {timeRemainingLabel && (
            <span className="font-nunito text-xs text-muted-foreground">
              {timeRemainingLabel} left
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {session?.scenario.phases.map((phase, idx) => (
            <span
              key={`${phase.phaseName}-${idx}`}
              className={`h-1.5 w-1.5 rounded-full ${
                idx === session.currentPhaseIndex ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>
      </header>

      {/* Content area */}
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        {uiPhase === "briefing" && briefingText && (
          <p className="font-nunito text-base leading-relaxed text-foreground">{briefingText}</p>
        )}

        {uiPhase === "awaitingStart" && (
          <div className="flex flex-col items-center gap-4">
            <p className="font-nunito text-base text-foreground">
              {session?.scenario.title}
            </p>
            <Button onClick={handleStart}>Start</Button>
          </div>
        )}

        {uiPhase === "starting" && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}

        {(uiPhase === "active" || uiPhase === "recording" || uiPhase === "processing") &&
          (displayMode === "findings" ? (
            <div className="w-full max-w-md space-y-3 text-left">
              <p className="font-nunito text-sm font-medium text-muted-foreground">
                New information revealed:
              </p>
              <ul className="space-y-2">
                {findings.map((finding) => (
                  <li
                    key={finding.label}
                    className="rounded-xl border border-border bg-card p-3"
                  >
                    <p className="font-nunito text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {finding.label}
                    </p>
                    <p className="font-nunito text-sm text-foreground">{finding.data}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            captionText && (
              <p className="font-nunito text-base leading-relaxed text-foreground">
                {captionText}
              </p>
            )
          ))}

        {uiPhase === "completed" && (
          <div className="flex flex-col items-center gap-4">
            <p className="font-nunito text-base text-foreground">Simulation complete!</p>
            <Button onClick={() => router.push("/account/practice/simulation")}>
              Back to Simulation Room
            </Button>
          </div>
        )}
      </main>

      {/* Bottom bar */}
      {(uiPhase === "active" || uiPhase === "recording" || uiPhase === "processing") && (
        <footer className="flex items-center justify-between border-t border-border px-6 py-4">
          <button
            onClick={() => setShowHint(true)}
            aria-label="Show hint"
            className="rounded-full p-3 text-muted-foreground hover:bg-muted"
          >
            <Lightbulb className="h-5 w-5" />
          </button>

          <button
            onClick={uiPhase === "recording" ? stopRecording : startRecording}
            disabled={uiPhase === "processing"}
            aria-label={uiPhase === "recording" ? "Stop recording" : "Start recording"}
            className={`flex h-16 w-16 items-center justify-center rounded-full transition-all ${
              uiPhase === "recording"
                ? "animate-pulse bg-red-500 text-white"
                : "bg-primary text-white hover:bg-primary-dark"
            } disabled:opacity-50`}
          >
            {uiPhase === "processing" ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </button>

          <div className="w-11" />
        </footer>
      )}

      {/* Hint overlay */}
      {showHint && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center"
          onClick={() => setShowHint(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-card p-6 md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-nunito text-sm font-semibold text-foreground">Hint</p>
            <p className="mt-2 font-nunito text-sm text-muted-foreground">
              {session?.scenario.studentHint || "No hint available for this scenario."}
            </p>
            <Button className="mt-4" fullWidth onClick={() => setShowHint(false)}>
              Got it
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
