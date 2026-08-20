"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { X, Mic, Loader2, Lightbulb, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { releaseMediaStream } from "@/lib/ios-audio-utils";
import { Button } from "@/components/ui/Button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScenarioPhase {
  phaseTitle: string;
  situation: string;
  clinicalInformation: string;
  characters: string[];
}

interface ScenarioHint {
  phaseTitle: string;
  hintText: string;
}

interface SessionTurn {
  role: "student" | "ai";
  text: string;
  turnNumber: number;
}

interface SessionDetail {
  sessionId: string;
  status: "in_progress" | "completed" | "abandoned";
  startedAt: string;
  currentPhaseIndex: number;
  briefingComplete: boolean;
  turns: SessionTurn[];
  scenario: {
    workplaceSetting: string;
    maxDurationMinutes: number;
    background: string;
    patientInformation: string;
    hints: ScenarioHint[];
    phases: ScenarioPhase[];
  };
}

type ChatMessage = { kind: "turn"; role: "student" | "ai"; text: string };

interface BriefingScreen {
  displayText: string;
  audioBase64: string;
}

interface BriefingData {
  background: BriefingScreen;
  patientInformation: BriefingScreen;
}

// New flow, in order: awaitingStart (Start button, timer starts on click) ->
// background (static text + audio, Continue) -> patientInformation (static
// text + audio, Continue) -> phaseIntro (current phase's title/situation/
// clinical info, "Begin conversation" the first time / "Continue
// conversation" after a phase advance) -> active/recording/processing (live
// conversation) -> phaseIntro again on each advancePhase -> ... -> completed.
type UiPhase =
  | "loading"
  | "awaitingStart"
  | "starting"
  | "background"
  | "patientInformation"
  | "phaseIntro"
  | "active"
  | "recording"
  | "processing"
  | "completed"
  | "error";

// ─── Grading result (POST /grade response shape) ───────────────────────────
//
// session.overallGradeResult.pronunciation only ever stored gradedTurnCount/
// failedTurnCount (counts) — per-word detail lived exclusively on each turn's
// speechaceResult.word_scores and was never aggregated or returned anywhere.
// simulation-grading.service.ts now flattens that into mispronouncedWords so
// the client actually receives word-level detail instead of just counts.
// Grammar error detail (quotedText/correctedVersion/explanation) was already
// present in session.overallGradeResult.grammar.errors — the route just
// wasn't returning it; it returned only summary counts before.

interface MispronouncedWord {
  word: string;
  score: number;
  turnNumber: number;
}

interface GrammarError {
  studentTurnNumber: number;
  quotedText: string;
  errorType: "context_error" | "phrasing_error";
  correctedVersion: string;
  explanation: string;
}

interface CompetencyScore {
  competencyName: string;
  rating: "exceeds" | "meets" | "fails";
  evidence: string;
}

// Sub-fields are optional, not just their arrays defaulted — a session graded
// before a given sub-grading pass existed (or whose pass failed outside the
// documented { errors: [] }-style fallback) can have the field missing
// entirely. gradeSimulationSession's overallGradeResult short-circuit returns
// whatever was previously persisted as-is, so this can reach the client even
// on a fresh "See my grades" call for an old session.
interface GradeResult {
  pronunciation?: {
    gradedTurnCount: number;
    failedTurnCount: number;
    mispronouncedWords?: MispronouncedWord[];
  };
  grammar?: {
    errors?: GrammarError[];
  };
  competency?: {
    competencyScores?: CompetencyScore[];
    overallSummary?: string;
  };
}

type GradingState = "idle" | "loading" | "done" | "error";

// ─── SSE parsing (shared between /turn and /opening) ───────────────────────

interface SseHandlers {
  onText?: (text: string) => void;
  onAudio?: (data: string) => void;
  onPhaseAdvance?: (newPhaseIndex: number) => void;
  onTranscript?: (text: string) => void;
  onError?: (message: string) => void;
}

async function readSimulationSSE(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: SseHandlers = {},
): Promise<{ textAccum: string }> {
  const decoder = new TextDecoder();
  let buffer = "";
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
          if (parsed?.type === "audio" && typeof parsed.data === "string") {
            handlers.onAudio?.(parsed.data);
          } else if (parsed?.type === "text" && typeof parsed.data === "string") {
            textAccum += parsed.data;
            handlers.onText?.(parsed.data);
          } else if (parsed?.type === "phaseAdvance" && typeof parsed.newPhaseIndex === "number") {
            handlers.onPhaseAdvance?.(parsed.newPhaseIndex);
          } else if (parsed?.type === "transcript" && typeof parsed.text === "string") {
            handlers.onTranscript?.(parsed.text);
          } else if (parsed?.type === "error" && typeof parsed.message === "string") {
            handlers.onError?.(parsed.message);
          }
        } catch {
          // partial/malformed SSE frame split across reads — ignore
        }
      }

      boundary = buffer.indexOf("\n\n");
    }
  }

  return { textAccum };
}

// ─── Progressive, gapless audio playback ───────────────────────────────────
//
// Gemini Live streams PCM audio a chunk at a time. Rather than buffer the
// whole response and convert+play one WAV at the end, we flush ~1s worth
// of PCM to WAV as it arrives and queue each resulting clip for back-to-back
// playback, so the student hears the AI start speaking well before it
// finishes generating. Playback holds a one-clip cushion before starting
// (see createAudioQueue) so a lagging conversion doesn't stall it.

const PCM_SAMPLE_RATE = 24_000;
const PCM_BYTES_PER_SAMPLE = 2; // 16-bit
const PCM_CHANNELS = 1;
const PCM_BYTES_PER_SECOND = PCM_SAMPLE_RATE * PCM_BYTES_PER_SAMPLE * PCM_CHANNELS;
const FLUSH_THRESHOLD_BYTES = PCM_BYTES_PER_SECOND * 1.0; // ~1s of audio per flush

/** Estimates decoded byte length of a base64 string without decoding it. */
function estimateBase64ByteLength(base64: string): number {
  return (base64.length * 3) / 4;
}

// ─── Client-side PCM → WAV conversion (TEMPORARY / interim fix) ────────────
//
// Every audio chunk batch used to round-trip to POST /api/v1/simulation/audio/wav
// for conversion, which was a likely source of audible playback gaps (a slow
// round trip for chunk N+1 could outpace chunk N's playback). This ports the
// same WAV-header-wrapping logic as gemini.service.ts's pcmToWavBase64 to run
// directly in the browser instead, with no network call.
//
// TEMPORARY: this duplicates pcmToWavBase64's logic client-side. Once the
// live-conversation piece potentially moves to different infrastructure,
// /api/v1/simulation/audio/wav and this duplicated conversion logic should be
// reconciled or removed rather than left as two parallel implementations.

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

function pcmChunksToWavBase64(
  pcmBase64Chunks: string[],
  sampleRate = PCM_SAMPLE_RATE,
  numChannels = PCM_CHANNELS,
  bitsPerSample = PCM_BYTES_PER_SAMPLE * 8,
): string {
  const pcmByteArrays = pcmBase64Chunks.map(base64ToBytes);
  const pcmLength = pcmByteArrays.reduce((sum, arr) => sum + arr.length, 0);

  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const wavHeaderSize = 44;
  const wavBytes = new Uint8Array(wavHeaderSize + pcmLength);
  const view = new DataView(wavBytes.buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  // RIFF header
  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcmLength, true);
  writeString(8, "WAVE");

  // fmt sub-chunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(36, "data");
  view.setUint32(40, pcmLength, true);

  let offset = wavHeaderSize;
  for (const arr of pcmByteArrays) {
    wavBytes.set(arr, offset);
    offset += arr.length;
  }

  return bytesToBase64(wavBytes);
}

/** Sequential playback queue: clips play back-to-back via a single <audio> element. */
function createAudioQueue(
  playbackAudioRef: React.MutableRefObject<HTMLAudioElement | null>,
  onDrain?: () => void,
) {
  const queue: string[] = [];
  let playing = false;
  let streamEnded = false;
  let hasStartedPlaying = false;

  const maybeNotifyDrain = () => {
    if (streamEnded && !playing && queue.length === 0) onDrain?.();
  };

  const playNext = () => {
    const wavBase64 = queue.shift();
    if (!wavBase64) {
      playing = false;
      maybeNotifyDrain();
      return;
    }
    hasStartedPlaying = true;
    playing = true;
    const audio = new Audio(`data:audio/wav;base64,${wavBase64}`);
    playbackAudioRef.current = audio;
    audio.onended = playNext;
    audio.onerror = playNext;
    audio.play().catch(playNext);
  };

  return {
    // Keep one clip's cushion before starting playback: wait for 2 clips queued,
    // or the stream to have ended with at least 1 clip queued, so a lagging
    // conversion for a later chunk doesn't produce an audible gap. Once
    // playback has started, resume immediately as each new clip arrives.
    enqueue(wavBase64: string) {
      queue.push(wavBase64);
      if (playing) return;
      if (!hasStartedPlaying) {
        if (queue.length >= 2 || (streamEnded && queue.length >= 1)) playNext();
        return;
      }
      playNext();
    },
    markStreamEnded() {
      streamEnded = true;
      if (!playing && !hasStartedPlaying && queue.length >= 1) playNext();
      maybeNotifyDrain();
    },
  };
}

/** Converts a batch of base64 PCM chunks to WAV (client-side) and enqueues it for playback. */
function flushAudioChunks(chunks: string[], queue: ReturnType<typeof createAudioQueue>): void {
  if (chunks.length === 0) return;
  try {
    const wavBase64 = pcmChunksToWavBase64(chunks);
    queue.enqueue(wavBase64);
  } catch {
    // Audio playback is best-effort; a failed conversion shouldn't block the turn.
  }
}

/**
 * Buffers incoming PCM chunks and flushes them to the playback queue in
 * ~1s batches. Conversion is synchronous (client-side) so batches are
 * naturally enqueued — and therefore played — in arrival order.
 */
function createChunkedAudioPlayer(playbackAudioRef: React.MutableRefObject<HTMLAudioElement | null>) {
  let resolvePlaybackDone: () => void;
  const playbackDone = new Promise<void>((resolve) => {
    resolvePlaybackDone = resolve;
  });

  const queue = createAudioQueue(playbackAudioRef, () => resolvePlaybackDone());

  let buffer: string[] = [];
  let bufferedBytes = 0;

  return {
    /** Call for every 'audio' SSE event as it arrives. */
    pushChunk(base64: string) {
      buffer.push(base64);
      bufferedBytes += estimateBase64ByteLength(base64);
      if (bufferedBytes >= FLUSH_THRESHOLD_BYTES) {
        flushAudioChunks(buffer, queue);
        buffer = [];
        bufferedBytes = 0;
      }
    },
    /** Call once the SSE stream ends. Flushes any remaining tail chunk. */
    async finish(): Promise<void> {
      if (buffer.length > 0) {
        flushAudioChunks(buffer, queue);
        buffer = [];
        bufferedBytes = 0;
      }
      queue.markStreamEnded();
    },
    /** Resolves once every enqueued clip has finished playing (post-finish). */
    playbackDone,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SimulationSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [uiPhase, setUiPhase] = useState<UiPhase>("loading");
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [briefingData, setBriefingData] = useState<BriefingData | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hintCarouselIndex, setHintCarouselIndex] = useState(0);
  const [timeRemainingLabel, setTimeRemainingLabel] = useState("");
  const [gradingState, setGradingState] = useState<GradingState>("idle");
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [sessionControlsEnabled, setSessionControlsEnabled] = useState(false);
  const [endingSession, setEndingSession] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const briefingAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const phaseTimerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        setBriefingData(briefingJson.data);
        setMessages(
          (sessionJson.data.turns as SessionTurn[]).map((turn) => ({
            kind: "turn",
            role: turn.role,
            text: turn.text,
          })),
        );

        if (sessionJson.data.status === "completed") {
          setUiPhase("completed");
          return;
        }

        if (sessionJson.data.briefingComplete) {
          const turns = sessionJson.data.turns as SessionTurn[];
          if (turns.length > 0) {
            // Genuinely mid-conversation (the AI has spoken at least once) —
            // background/patient-info/phase-intro screens were already shown
            // earlier in this session, so skip straight back into it.
            setUiPhase("active");
          } else {
            // Start was clicked (briefingComplete is set) but the student left
            // before reaching "Begin conversation" — no AI opening line has
            // fired yet. Resuming into "active" here would be a dead-end mic
            // screen with an empty message list, so resume into the current
            // phase's intro screen instead; it already renders "Begin
            // conversation" whenever messages.length === 0. Background/Patient
            // Information aren't replayed — the student already saw them once
            // this session.
            setUiPhase("phaseIntro");
          }
          return;
        }

        // Start button click is still the very first action shown — no
        // pre-Start audio plays automatically any more.
        setUiPhase("awaitingStart");
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

  const SESSION_CONTROLS_ELIGIBLE_MS = 5 * 60_000;

  useEffect(() => {
    if (!session) return;

    const startTime = new Date(session.startedAt).getTime();
    const endTime = startTime + session.scenario.maxDurationMinutes * 60_000;
    const controlsEligibleAt = startTime + SESSION_CONTROLS_ELIGIBLE_MS;

    const tick = () => {
      const remainingMs = Math.max(0, endTime - Date.now());
      const totalSeconds = Math.floor(remainingMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setTimeRemainingLabel(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      setSessionControlsEnabled(Date.now() >= controlsEligibleAt);
    };

    tick();
    const interval = setInterval(tick, 1000);
    phaseTimerIntervalRef.current = interval;
    return () => {
      clearInterval(interval);
      phaseTimerIntervalRef.current = null;
    };
  }, [session]);

  // ─── Auto-scroll chat to bottom on new message ─────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── Start → Background → Patient Information → Phase intro ───────────────

  const handleStart = async () => {
    setUiPhase("starting");
    try {
      const res = await fetch(`/api/v1/simulation/sessions/${sessionId}/start`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to start session");

      const startJson = await res.json();
      const newStartedAt = startJson?.data?.startedAt;
      if (newStartedAt) {
        setSession((prev) => (prev ? { ...prev, startedAt: newStartedAt } : prev));
      }

      playBriefingScreenAudio("background");
      setUiPhase("background");
    } catch {
      toast.error("Could not start the session. Please try again.");
      setUiPhase("awaitingStart");
    }
  };

  /** Autoplays a briefing screen's narration — best-effort, the Continue button never waits on it. */
  const playBriefingScreenAudio = (screen: keyof BriefingData) => {
    const audioBase64 = briefingData?.[screen]?.audioBase64;
    if (!audioBase64) return;
    briefingAudioRef.current?.pause();
    const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
    briefingAudioRef.current = audio;
    audio.play().catch(() => {
      // Autoplay can be blocked — non-fatal, the text is already on screen.
    });
  };

  const handleBackgroundContinue = () => {
    briefingAudioRef.current?.pause();
    playBriefingScreenAudio("patientInformation");
    setUiPhase("patientInformation");
  };

  const handlePatientInformationContinue = () => {
    briefingAudioRef.current?.pause();
    setUiPhase("phaseIntro");
  };

  // Phase-intro "Begin conversation" (first entry, no turns yet) triggers the
  // opening line the same way handleStart used to. "Continue conversation"
  // (after an advancePhase) just resumes — the live Gemini session is still
  // cached server-side under the same sessionKey, so no API call is needed.
  const handleBeginConversation = async () => {
    setUiPhase("starting");
    try {
      const openingRes = await fetch(`/api/v1/simulation/sessions/${sessionId}/opening`, {
        method: "POST",
        credentials: "include",
      });
      if (!openingRes.ok || !openingRes.body) throw new Error("Failed to generate opening line");

      const player = createChunkedAudioPlayer(playbackAudioRef);
      const { textAccum } = await readSimulationSSE(openingRes.body.getReader(), {
        onAudio: (data) => player.pushChunk(data),
      });
      await player.finish();

      setMessages((prev) => [...prev, { kind: "turn", role: "ai", text: textAccum }]);

      void player.playbackDone.then(() => setUiPhase("active"));
    } catch {
      toast.error("Could not start the conversation. Please try again.");
      setUiPhase("phaseIntro");
    }
  };

  const handleContinueConversation = () => setUiPhase("active");

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
          // No phases left, or time limit reached — the endpoint short-circuits
          // with a plain JSON body.
          const json = await res.json();
          if (json?.data?.sessionComplete) {
            setUiPhase("completed");
            return;
          }
          setUiPhase("active");
          return;
        }

        if (!res.body) throw new Error("Turn response had no body");

        let sseErrorMessage: string | null = null;
        // Set only when advancePhase fires AND there's a next phase to show an
        // intro screen for (the last phase advancing past the end is left to
        // the existing sessionComplete detection on the next /turn call).
        let advancedToPhaseIndex: number | null = null;
        const player = createChunkedAudioPlayer(playbackAudioRef);
        const { textAccum } = await readSimulationSSE(res.body.getReader(), {
          onAudio: (data) => player.pushChunk(data),
          onTranscript: (text) => {
            setMessages((prev) => [...prev, { kind: "turn", role: "student", text }]);
          },
          onPhaseAdvance: (newPhaseIndex) => {
            setSession((prev) => (prev ? { ...prev, currentPhaseIndex: newPhaseIndex } : prev));
            if (newPhaseIndex < (session?.scenario.phases.length ?? 0)) {
              advancedToPhaseIndex = newPhaseIndex;
            }
          },
          onError: (message) => {
            sseErrorMessage = message;
          },
        });

        // Playback is fire-and-forget here — autoplay may be blocked, which is non-fatal.
        void player.finish();

        if (sseErrorMessage) {
          toast.error(sseErrorMessage);
          setUiPhase("active");
          return;
        }

        if (textAccum) {
          setMessages((prev) => [...prev, { kind: "turn", role: "ai", text: textAccum }]);
        }

        setUiPhase(advancedToPhaseIndex !== null ? "phaseIntro" : "active");
      } catch {
        toast.error("Something went wrong processing your turn. Please try again.");
        setUiPhase("active");
      }
    },
    [sessionId, session],
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

  // ─── Grading (student-triggered, on the completion screen) ─────────────────

  const handleSeeGrades = async () => {
    setGradingState("loading");
    try {
      const res = await fetch(`/api/v1/simulation/sessions/${sessionId}/grade`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to grade session");
      setGradeResult(json.data);
      setGradingState("done");
    } catch {
      setGradingState("error");
    }
  };

  // ─── Close / leave ────────────────────────────────────────────────────────

  const handleClose = () => {
    const confirmed = window.confirm(
      "Leave this simulation? Your progress will be saved, but the session will end for now.",
    );
    if (!confirmed) return;
    clearPhaseTimer();
    releaseMediaStream(mediaStreamRef.current);
    router.push("/account/practice/simulation");
  };

  // ─── Session controls (end / leave-and-continue-later) ─────────────────────

  const handleSessionControlsBlocked = () => {
    toast.error("Available after 5 minutes");
  };

  // Explicitly clear the phase-timer interval before navigating away —
  // router.push doesn't unmount synchronously, so relying solely on the
  // effect's own cleanup can leave the interval ticking briefly after
  // navigation starts.
  const clearPhaseTimer = () => {
    if (phaseTimerIntervalRef.current) {
      clearInterval(phaseTimerIntervalRef.current);
      phaseTimerIntervalRef.current = null;
    }
  };

  const handleLeaveAndContinueLater = async () => {
    if (!sessionControlsEnabled) {
      handleSessionControlsBlocked();
      return;
    }
    // Session stays in_progress server-side — the Simulation Room list page
    // already resumes it via its "Continue" button.
    try {
      const res = await fetch(`/api/v1/simulation/sessions/${sessionId}/pause`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to pause session");
    } catch {
      // Non-fatal — losing the pause adjustment shouldn't trap the student
      // on the page. The timer will simply keep counting in the background.
      toast.warning("Could not pause the timer. It will keep counting while you're away.");
    }
    clearPhaseTimer();
    releaseMediaStream(mediaStreamRef.current);
    router.push("/account/practice/simulation");
  };

  const handleEndSession = async () => {
    if (!sessionControlsEnabled) {
      handleSessionControlsBlocked();
      return;
    }
    setEndingSession(true);
    try {
      const res = await fetch(`/api/v1/simulation/sessions/${sessionId}/end`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to end session");
      clearPhaseTimer();
      releaseMediaStream(mediaStreamRef.current);
      router.push("/account/practice/simulation");
    } catch {
      toast.error("Could not end the session. Please try again.");
      setEndingSession(false);
    }
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

  const currentPhase = session?.scenario.phases[session.currentPhaseIndex];
  const currentPhaseName = currentPhase?.phaseTitle ?? "";
  const currentPhaseHints =
    session?.scenario.hints.filter((hint) => hint.phaseTitle === currentPhaseName) ?? [];

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
          {uiPhase !== "awaitingStart" &&
            uiPhase !== "starting" &&
            uiPhase !== "completed" &&
            timeRemainingLabel && (
              <span className="font-nunito text-xs text-muted-foreground">
                {timeRemainingLabel} left
              </span>
            )}
        </div>

        <div className="w-11" />
      </header>

      {/* Session controls */}
      {(uiPhase === "active" || uiPhase === "recording" || uiPhase === "processing") && (
        <div className="flex items-center justify-center gap-2 border-b border-border px-4 py-2">
          <button
            onClick={handleLeaveAndContinueLater}
            aria-disabled={!sessionControlsEnabled}
            className={`rounded-full px-3 py-1.5 font-nunito text-xs font-semibold transition-all ${
              sessionControlsEnabled
                ? "bg-primary text-white hover:bg-primary-dark"
                : "bg-muted text-muted-foreground opacity-50"
            }`}
          >
            Leave &amp; Continue Later
          </button>
          <button
            onClick={handleEndSession}
            disabled={endingSession}
            aria-disabled={!sessionControlsEnabled}
            className={`rounded-full px-3 py-1.5 font-nunito text-xs font-semibold transition-all ${
              sessionControlsEnabled
                ? "bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
                : "bg-muted text-muted-foreground opacity-50"
            }`}
          >
            {endingSession ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "End Session"}
          </button>
        </div>
      )}

      {/* Progress bar */}
      {session && session.scenario.phases.length > 0 && (
        <div className="flex h-1 w-full gap-1 bg-border">
          {session.scenario.phases.map((phase, idx) => (
            <span
              key={`${phase.phaseTitle}-${idx}`}
              className={`h-full flex-1 ${
                idx <= session.currentPhaseIndex ? "bg-primary" : "bg-transparent"
              }`}
            />
          ))}
        </div>
      )}

      {/* Content area */}
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        {uiPhase === "awaitingStart" && (
          <div className="flex flex-col items-center gap-4">
            {session?.scenario.workplaceSetting && (
              <p className="font-nunito text-base text-foreground">
                {session.scenario.workplaceSetting}
              </p>
            )}
            <Button onClick={handleStart}>Start</Button>
          </div>
        )}

        {uiPhase === "starting" && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}

        {uiPhase === "background" && (
          <div className="flex w-full max-w-md flex-col items-center gap-6">
            <p className="font-nunito text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Background
            </p>
            <p className="font-nunito text-base leading-relaxed text-foreground">
              {session?.scenario.background}
            </p>
            <Button onClick={handleBackgroundContinue}>Continue</Button>
          </div>
        )}

        {uiPhase === "patientInformation" && (
          <div className="flex w-full max-w-md flex-col items-center gap-6">
            <p className="font-nunito text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Patient Information
            </p>
            <p className="font-nunito text-base leading-relaxed text-foreground">
              {session?.scenario.patientInformation}
            </p>
            <Button onClick={handlePatientInformationContinue}>Continue</Button>
          </div>
        )}

        {uiPhase === "phaseIntro" && currentPhase && (
          <div className="flex w-full max-w-md flex-col items-center gap-6">
            <p className="font-nunito text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {currentPhase.phaseTitle}
            </p>
            <p className="font-nunito text-base leading-relaxed text-foreground">
              {currentPhase.situation}
            </p>
            <p className="font-nunito text-sm leading-relaxed text-muted-foreground">
              {currentPhase.clinicalInformation}
            </p>
            <Button onClick={messages.length === 0 ? handleBeginConversation : handleContinueConversation}>
              {messages.length === 0 ? "Begin conversation" : "Continue conversation"}
            </Button>
          </div>
        )}

        {(uiPhase === "active" || uiPhase === "recording" || uiPhase === "processing") && (
          <div className="flex w-full max-w-md flex-1 flex-col gap-3 overflow-y-auto text-left">
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={`flex flex-col gap-1 ${
                  message.role === "student" ? "items-end" : "items-start"
                }`}
              >
                <p
                  className={`max-w-[85%] rounded-2xl px-4 py-2 font-nunito text-base leading-relaxed ${
                    message.role === "student"
                      ? "bg-primary text-white"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {message.text}
                </p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {uiPhase === "completed" && (
          <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
            <p className="font-nunito text-lg font-semibold text-foreground">
              Well done — simulation complete!
            </p>
            <p className="font-nunito text-sm text-muted-foreground">
              Great work getting through this scenario. Ready to see how you did?
            </p>

            {gradingState === "idle" && (
              <Button onClick={handleSeeGrades}>See my grades</Button>
            )}

            {gradingState === "loading" && (
              <div className="flex flex-col items-center gap-2 py-2">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="font-nunito text-sm text-muted-foreground">Grading your session…</p>
              </div>
            )}

            {gradingState === "error" && (
              <div className="flex flex-col items-center gap-2">
                <p className="font-nunito text-sm text-red-500">
                  Could not grade this session. Please try again.
                </p>
                <Button onClick={handleSeeGrades}>Try again</Button>
              </div>
            )}

            {gradingState === "done" && gradeResult && (() => {
              const mispronouncedWords = gradeResult.pronunciation?.mispronouncedWords ?? [];
              const grammarErrors = gradeResult.grammar?.errors ?? [];
              const overallSummary = gradeResult.competency?.overallSummary || "No summary available.";

              return (
                <div className="w-full space-y-4 rounded-2xl border border-border bg-card p-4 text-left">
                  <div>
                    <p className="font-nunito text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Summary
                    </p>
                    <p className="font-nunito text-sm text-foreground">{overallSummary}</p>
                  </div>

                  <div>
                    <p className="font-nunito text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Mispronounced words
                    </p>
                    {mispronouncedWords.length === 0 ? (
                      <p className="font-nunito text-sm text-muted-foreground">
                        No mispronounced words detected.
                      </p>
                    ) : (
                      <ul className="mt-1 flex flex-wrap gap-2">
                        {mispronouncedWords.map((w, idx) => (
                          <li
                            key={idx}
                            className="rounded-full bg-muted px-3 py-1 font-nunito text-sm text-foreground"
                          >
                            {w.word}{" "}
                            <span className="text-xs text-muted-foreground">
                              ({Math.round(w.score)})
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="font-nunito text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Misused words / grammar
                    </p>
                    {grammarErrors.length === 0 ? (
                      <p className="font-nunito text-sm text-muted-foreground">
                        No grammar issues detected.
                      </p>
                    ) : (
                      <ul className="mt-1 space-y-2">
                        {grammarErrors.map((err, idx) => (
                          <li key={idx} className="font-nunito text-sm text-foreground">
                            <span className="text-muted-foreground line-through">
                              {err.quotedText}
                            </span>{" "}
                            → <span className="font-medium">{err.correctedVersion}</span>
                            <p className="text-xs text-muted-foreground">{err.explanation}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })()}

            <Button variant="outline" onClick={() => router.push("/account/practice/simulation")}>
              Back to Simulation Room
            </Button>
          </div>
        )}
      </main>

      {/* Bottom bar */}
      {(uiPhase === "active" || uiPhase === "recording" || uiPhase === "processing") && (
        <footer className="flex items-center justify-between border-t border-border px-6 py-4">
          <button
            onClick={() => {
              setHintCarouselIndex(0);
              setShowHint(true);
            }}
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
            <div className="flex items-center justify-between">
              <p className="font-nunito text-sm font-semibold text-foreground">Hint</p>
              {currentPhaseHints.length > 1 && (
                <p className="font-nunito text-xs text-muted-foreground">
                  {hintCarouselIndex + 1} / {currentPhaseHints.length}
                </p>
              )}
            </div>

            {currentPhaseHints.length === 0 ? (
              <p className="mt-2 font-nunito text-sm text-muted-foreground">
                No hint available for this phase.
              </p>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                {currentPhaseHints.length > 1 && (
                  <button
                    onClick={() =>
                      setHintCarouselIndex(
                        (i) => (i - 1 + currentPhaseHints.length) % currentPhaseHints.length,
                      )
                    }
                    aria-label="Previous hint"
                    className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                <p className="flex-1 font-nunito text-sm text-muted-foreground">
                  {currentPhaseHints[hintCarouselIndex]?.hintText}
                </p>
                {currentPhaseHints.length > 1 && (
                  <button
                    onClick={() => setHintCarouselIndex((i) => (i + 1) % currentPhaseHints.length)}
                    aria-label="Next hint"
                    className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            <Button className="mt-4" fullWidth onClick={() => setShowHint(false)}>
              Got it
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
