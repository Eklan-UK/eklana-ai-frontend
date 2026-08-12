/**
 * Eklan AI — Multi-Turn Live Voice Conversation Spike (Mode A vs Mode C)
 * ========================================================================
 * THROWAWAY DIAGNOSTIC — not production code. Do not import this from app code.
 *
 * Mode A (Topic Practice's real flow): audio clip → transcribeAudio() (the real
 *   production transcription hop, gemini.service.ts:782-820, same call
 *   /api/v1/ai/transcribe uses) → transcribed text sent as a Live turn via
 *   generateWithLiveAPIStream, exactly mirroring generateTopicPracticeResponseStream's
 *   turn-building (:1554-1575: history as text turns, not systemInstruction).
 *
 * Mode C (Free Talk's real flow — a genuinely working audio-in path): audio clip
 *   sent directly to generateVoiceConversationSSEStream (gemini.service.ts:1258-1483),
 *   the function the mobile Free Talk route actually uses in production. It sends
 *   raw PCM via sendRealtimeInput (activityStart → chunked PCM → activityEnd, manual
 *   VAD) instead of transcribeAudio() + sendClientContent. Conversation history is
 *   embedded as the last 6 turns of text inside systemInstruction (:1280-1284) —
 *   a different, fixed-window mechanism from Mode A's unboundedly-growing turns
 *   array. Both are the real, unmodified exported production functions — nothing
 *   in this file re-implements Live API plumbing.
 *
 * ─── WHY MODE B (sendClientContent + inlineData) IS GONE ──────────────────────
 * An earlier version tried sending audio directly as an inlineData part on a
 * generateWithLiveAPIStream-style turn (Topic Practice's own call shape), to see
 * if Topic Practice could accept audio without adopting Free Talk's whole
 * realtime-input mechanism. It can't:
 *
 *   - Empirically: every combination tried (WAV, raw 16kHz PCM, WebM/Opus;
 *     inputAudioTranscription on/off/outputAudioTranscription on/off) was
 *     rejected by the Live API server — close code 1007 "Precondition check
 *     failed" or 1011 "Internal error encountered" — before emitting a single
 *     message, audio or text.
 *   - By design: `sendClientContent` (what generateWithLiveAPIStream uses,
 *     gemini.service.ts:448-451) is documented by the @google/genai SDK itself
 *     (node_modules/@google/genai/dist/node/node.d.ts:9714-9747) as a text /
 *     turn-management / context-prefill API. Audio input requires the different
 *     `sendRealtimeInput` call (:9749-9770) — which is exactly what Mode C uses,
 *     via the real generateVoiceConversationSSEStream.
 *   - `transcribeWithLiveAPI` (gemini.service.ts:478-590), the one piece of
 *     existing code that tries audio via `sendClientContent`, is unexported dead
 *     code with zero callers — replicating its config verbatim reproduced the
 *     same 1011 failure, suggesting it was never exercised against real audio.
 *
 * So: audio input isn't a config tweak on Topic Practice's own call shape — it
 * requires Free Talk's realtime-input mechanism, which is what Mode C measures.
 *
 * ─── FAIRNESS NOTE ON CONVERSATION HISTORY ─────────────────────────────────────
 * Each mode's AI reply is a fresh, independent generation — that will always
 * differ between modes. To stop that from also polluting the *input* side of
 * history, each turn's *user* history entry is the canonical scripted line
 * (ground truth) in BOTH modes. The two modes still use that history
 * differently, because that's a real, load-bearing architectural difference
 * between them, not a test artifact: Mode A passes the FULL unbounded history
 * as Live turns every call; Mode C's function only ever embeds the last 6 turns
 * into systemInstruction (gemini.service.ts:1281). Both are exactly what the
 * real functions do — this script doesn't paper over that difference.
 *
 * AUDIO CLIPS
 *   Generated once via ElevenLabs (the same generateElevenLabsAudio() used by
 *   production Free Talk TTS), converted to 16kHz mono WAV via the bundled
 *   ffmpeg-static binary. Cached under scripts/fixtures/simulation-spike/
 *   turn-XX.wav — reruns skip regeneration. Requires ELEVEN_LABS_API_KEY
 *   (already set in this repo's .env.local). These WAVs already match the fast
 *   path in convertAudioToRawPcm16k (gemini.service.ts:107-117), so Mode C skips
 *   ffmpeg conversion entirely at request time, same as a real iOS recording would.
 *
 * REQUIREMENTS
 *   Must be run with tsx, NOT plain `node` — imports gemini.service.ts and
 *   tts-provider.service.ts directly, which use `@/` path aliases only tsx's
 *   loader resolves.
 *
 * ENV VARS
 *   SPIKE_MODE               'A' | 'C' | 'both' (default: 'both')
 *   SPIKE_MAX_TURNS          Limit turns for a quick preview (default: 12)
 *   SPIKE_VOICE              Gemini prebuilt voice name (default: 'Kore')
 *   SPIKE_REGENERATE_AUDIO   '1' to force-regenerate cached audio clips
 *
 * USAGE
 *   npx tsx scripts/simulation-spike.mjs                       # full 12-turn A+C run
 *   SPIKE_MAX_TURNS=2 npx tsx scripts/simulation-spike.mjs      # quick preview
 *   SPIKE_MODE=C npx tsx scripts/simulation-spike.mjs           # Mode C only
 */

import { config as loadEnv } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

try {
  loadEnv({ path: join(root, ".env") });
  loadEnv({ path: join(root, ".env.local"), override: true });
} catch {
  // dotenv is a dependency here, but don't hard-fail if env is pre-set (CI).
}

if (!process.env.GEMINI_API_KEY) {
  console.error(`
ERROR: GEMINI_API_KEY not set. This script reads it the same way the app does
(src/lib/api/config.ts). Make sure .env.local has it, or export it directly.
`);
  process.exit(1);
}

// Imports AFTER env is loaded — these modules read config at module-load time.
const { generateWithLiveAPIStream, transcribeAudio, generateVoiceConversationSSEStream } =
  await import("../src/services/gemini.service.ts");
const { generateElevenLabsAudio } = await import("../src/services/tts-provider.service.ts");
const { resolveElevenLabsApiKey } = await import("../src/services/tts-config.ts");

// ── Config ────────────────────────────────────────────────────────────────────
const VOICE = process.env.SPIKE_VOICE?.trim() || "Kore";
const MODE = (process.env.SPIKE_MODE?.trim() || "both").toUpperCase(); // 'A' | 'C' | 'BOTH'
const RUN_A = MODE === "A" || MODE === "BOTH";
const RUN_C = MODE === "C" || MODE === "BOTH";
const MAX_TURNS = Math.max(1, parseInt(process.env.SPIKE_MAX_TURNS || "12", 10));
const FORCE_REGEN = process.env.SPIKE_REGENERATE_AUDIO === "1";

const FIXTURES_DIR = join(root, "scripts", "fixtures", "simulation-spike");
const RUN_ID = Date.now();

const TOTAL_TIMEOUT_MS = 90_000;

// ── Fixed dramatisation system prompt (identical for both modes) ──────────────
const SYSTEM_PROMPT = `You are Eklan, playing the role of an anxious patient in an ICU for an English
speaking-practice roleplay. Stay in character as the patient at all times. Respond
naturally in 1-3 sentences per turn, showing appropriate anxiety/discomfort for an
ICU setting, and let the "nurse" (the student) lead the conversation.`;

// ── Scripted 12-turn conversation (student side, ground truth) ─────────────────
const STUDENT_TURNS = [
  "Hi, I'm your nurse today. How are you feeling right now?",
  "I understand. Can you tell me where the pain is coming from?",
  "On a scale of one to ten, how bad is the pain?",
  "Okay, I'm going to check your vitals now. Try to stay as still as you can.",
  "Your blood pressure is a little high. Have you been feeling anxious?",
  "That's completely understandable. Is there anything that would help you feel calmer?",
  "I can get the doctor to come speak with you about the pain medication.",
  "In the meantime, would you like me to adjust your pillow or blanket?",
  "Your family called and asked how you're doing. Would you like me to call them back?",
  "The doctor will be here in about ten minutes. Do you have any questions before then?",
  "I'm going to step out to get your medication now, okay?",
  "I'm back. Here's your medication — this should help with the pain shortly.",
].slice(0, MAX_TURNS);

// ── ffmpeg helper (mp3 → 16kHz mono wav, matches the bundled binary gemini.service.ts uses) ──
function runFfmpeg(args, input) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    const chunks = [];
    let stderr = "";
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
      resolve(Buffer.concat(chunks));
    });
    proc.on("error", reject);
    if (input) {
      proc.stdin.write(input);
      proc.stdin.end();
    }
  });
}

async function mp3ToWav16kMono(mp3Buffer) {
  return runFfmpeg(["-i", "pipe:0", "-ar", "16000", "-ac", "1", "-f", "wav", "pipe:1"], mp3Buffer);
}

// ── Audio clip generation / caching ────────────────────────────────────────────
async function ensureAudioClips() {
  mkdirSync(FIXTURES_DIR, { recursive: true });

  const clips = [];
  const missing = [];

  for (let i = 0; i < STUDENT_TURNS.length; i++) {
    const path = join(FIXTURES_DIR, `turn-${String(i + 1).padStart(2, "0")}.wav`);
    if (!FORCE_REGEN && existsSync(path)) {
      clips.push({ index: i, text: STUDENT_TURNS[i], path, buffer: readFileSync(path) });
    } else {
      missing.push({ index: i, text: STUDENT_TURNS[i], path });
      clips.push(null);
    }
  }

  if (missing.length > 0) {
    if (!resolveElevenLabsApiKey()) {
      console.error(`
ERROR: ${missing.length} audio clip(s) missing from ${FIXTURES_DIR} and
ELEVEN_LABS_API_KEY is not set, so they can't be generated.

Either set ELEVEN_LABS_API_KEY in .env.local, or record these lines yourself as
16kHz mono WAV files named turn-01.wav .. turn-${String(STUDENT_TURNS.length).padStart(2, "0")}.wav in:
  ${FIXTURES_DIR}

Missing lines:
${missing.map((m) => `  turn-${String(m.index + 1).padStart(2, "0")}.wav: "${m.text}"`).join("\n")}
`);
      process.exit(1);
    }

    console.log(`Generating ${missing.length} audio clip(s) via ElevenLabs (cached for future runs)...`);
    for (const m of missing) {
      process.stdout.write(`  turn-${String(m.index + 1).padStart(2, "0")}... `);
      const mp3Arraybuffer = await generateElevenLabsAudio({ text: m.text });
      const wavBuffer = await mp3ToWav16kMono(Buffer.from(mp3Arraybuffer));
      writeFileSync(m.path, wavBuffer);
      clips[m.index] = { index: m.index, text: m.text, path: m.path, buffer: wavBuffer };
      console.log(`done (${wavBuffer.length} bytes)`);
    }
  }

  return clips;
}

// ── Turn-building helper for Mode A (mirrors generateTopicPracticeResponseStream) ──
function buildTurns(history, userMessage) {
  const historyTurns = history.map((msg) => ({ role: msg.role, parts: [{ text: msg.content }] }));
  return [...historyTurns, { role: "user", parts: [{ text: userMessage }] }];
}

function historySizeChars(history) {
  return history.reduce((sum, msg) => sum + msg.content.length, 0);
}

// ── Mode A stream consumer ──────────────────────────────────────────────────────
// generateWithLiveAPIStream emits `data: {"type":"audio"|"text",...}\n\n` and
// closes on turnComplete — no terminal marker, end-of-stream IS the signal.
async function consumeModeAStream(stream, t0) {
  let firstAudioMs = null;
  let lastAudioMs = null;
  let audioChunkCount = 0;
  let transcript = "";
  let timedOut = false;
  let errorMessage = null;

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const totalTimeoutHandle = setTimeout(() => {
    timedOut = true;
    try {
      reader.cancel("spike total timeout");
    } catch {
      /* ignore */
    }
  }, TOTAL_TIMEOUT_MS);

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let end;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const event = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (!event.startsWith("data: ")) continue;

        let parsed;
        try {
          parsed = JSON.parse(event.slice(6));
        } catch {
          continue;
        }
        const { type, data } = parsed;

        if (type === "audio") {
          audioChunkCount += 1;
          const now = performance.now() - t0;
          if (firstAudioMs === null) firstAudioMs = now;
          lastAudioMs = now;
        }
        if (type === "text" && typeof data === "string") {
          transcript += data;
        }
      }
    }
  } catch (err) {
    errorMessage = err.message;
  } finally {
    clearTimeout(totalTimeoutHandle);
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }

  return {
    firstAudioMs,
    lastAudioMs,
    audioChunkCount,
    transcript: transcript.trim(),
    inputTranscript: null, // Mode A doesn't transcribe its own input via Live — see transcribeMs
    timedOut,
    errorMessage,
    totalMs: performance.now() - t0,
  };
}

// ── Mode C stream consumer ──────────────────────────────────────────────────────
// generateVoiceConversationSSEStream additionally emits a `metadata` chunk
// (fullText, inputText, error?) right before closing — a more reliable signal
// than end-of-stream alone, and it surfaces its own two-stage 45s/90s timeouts
// as metadata.error rather than just hanging (gemini.service.ts:1380-1394).
async function consumeModeCStream(stream, t0) {
  let firstAudioMs = null;
  let lastAudioMs = null;
  let audioChunkCount = 0;
  let transcript = "";
  let inputTranscript = "";
  let timedOut = false;
  let errorMessage = null;

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const totalTimeoutHandle = setTimeout(() => {
    timedOut = true;
    try {
      reader.cancel("spike total timeout");
    } catch {
      /* ignore */
    }
  }, TOTAL_TIMEOUT_MS);

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let end;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const event = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (!event.startsWith("data: ")) continue;

        let parsed;
        try {
          parsed = JSON.parse(event.slice(6));
        } catch {
          continue;
        }
        const { type, data } = parsed;

        if (type === "audio") {
          audioChunkCount += 1;
          const now = performance.now() - t0;
          if (firstAudioMs === null) firstAudioMs = now;
          lastAudioMs = now;
        }
        if (type === "text" && typeof data === "string") {
          transcript += data;
        }
        if (type === "metadata" && data) {
          if (data.fullText) transcript = data.fullText;
          if (data.inputText) inputTranscript = data.inputText;
          if (data.error) errorMessage = data.error;
        }
      }
    }
  } catch (err) {
    errorMessage = errorMessage || err.message;
  } finally {
    clearTimeout(totalTimeoutHandle);
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }

  return {
    firstAudioMs,
    lastAudioMs,
    audioChunkCount,
    transcript: transcript.trim(),
    inputTranscript: inputTranscript.trim(),
    timedOut,
    errorMessage,
    totalMs: performance.now() - t0,
  };
}

// ── Per-turn runners ────────────────────────────────────────────────────────────
async function runModeATurn(history, clip) {
  const t0 = performance.now();

  const transcribeStart = performance.now();
  let transcribedText = "";
  let transcribeError = null;
  try {
    transcribedText = await transcribeAudio(clip.buffer, "audio/wav");
  } catch (err) {
    transcribeError = err.message;
  }
  const transcribeMs = performance.now() - transcribeStart;

  if (transcribeError) {
    return {
      firstAudioMs: null,
      lastAudioMs: null,
      audioChunkCount: 0,
      transcript: "",
      timedOut: false,
      errorMessage: `transcribe failed: ${transcribeError}`,
      totalMs: performance.now() - t0,
      transcribeMs,
      transcribedText: "",
    };
  }

  const turns = buildTurns(history, transcribedText || clip.text);

  let stream;
  try {
    stream = await generateWithLiveAPIStream(SYSTEM_PROMPT, turns, VOICE);
  } catch (err) {
    return {
      firstAudioMs: null,
      lastAudioMs: null,
      audioChunkCount: 0,
      transcript: "",
      timedOut: false,
      errorMessage: `connect failed: ${err.message}`,
      totalMs: performance.now() - t0,
      transcribeMs,
      transcribedText,
    };
  }

  // t0 is before transcription, so firstAudioMs reflects the full real-world
  // latency a student would wait through (transcription hop + Live connect + reply).
  const consumed = await consumeModeAStream(stream, t0);
  return { ...consumed, transcribeMs, transcribedText };
}

async function runModeCTurn(history, clip) {
  const t0 = performance.now();

  let stream;
  try {
    stream = await generateVoiceConversationSSEStream(
      clip.buffer,
      history,
      SYSTEM_PROMPT,
      "audio/wav",
      VOICE,
      undefined, // userName
      `spike-modec-${RUN_ID}` // userId — cache key only; session is evicted every turn anyway
    );
  } catch (err) {
    return {
      firstAudioMs: null,
      lastAudioMs: null,
      audioChunkCount: 0,
      transcript: "",
      inputTranscript: "",
      timedOut: false,
      errorMessage: `connect failed: ${err.message}`,
      totalMs: performance.now() - t0,
    };
  }

  // Hard outer safety net: consumeModeCStream relies on the production stream's
  // internal timeouts/controller.close() to end the read loop, but a raw WS
  // failure (e.g. abnormal closure, code 1006) can leave that machinery in a
  // state where the reader never gets a final `done`. Race against a local
  // timeout so the spike itself can never hang, independent of root cause.
  const hangGuardMs = TOTAL_TIMEOUT_MS + 15_000;
  const hangGuard = new Promise((resolve) => {
    setTimeout(() => resolve({ __hangGuardFired: true }), hangGuardMs);
  });

  const result = await Promise.race([consumeModeCStream(stream, t0), hangGuard]);
  if (result.__hangGuardFired) {
    return {
      firstAudioMs: null,
      lastAudioMs: null,
      audioChunkCount: 0,
      transcript: "",
      inputTranscript: "",
      timedOut: true,
      errorMessage: "hang guard fired — stream never signalled completion",
      totalMs: performance.now() - t0,
    };
  }
  return result;
}

// ── Stats helpers ────────────────────────────────────────────────────────────
function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}
function mean(values) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}
function fmt(ms) {
  return ms == null ? "—" : `${Math.round(ms)}ms`;
}

function driftCheck(label, succeeded) {
  if (succeeded.length < 4) {
    console.log(`  ${label}: not enough successful turns to check drift.`);
    return;
  }
  const mid = Math.floor(succeeded.length / 2);
  const firstHalf = succeeded.slice(0, mid);
  const secondHalf = succeeded.slice(mid);
  const avg = (arr) => mean(arr.map((r) => r.firstAudioMs));
  const firstHalfAvg = avg(firstHalf);
  const secondHalfAvg = avg(secondHalf);
  const delta = secondHalfAvg - firstHalfAvg;
  console.log(
    `  ${label}: turns 1-${mid} avg ${fmt(firstHalfAvg)}  →  turns ${mid + 1}-${succeeded.length} avg ${fmt(secondHalfAvg)}  ` +
      `delta ${delta >= 0 ? "+" : ""}${Math.round(delta)}ms ${Math.abs(delta) > (firstHalfAvg || 1) * 0.25 ? "(looks like degradation with history growth)" : "(no strong sign of degradation)"}`
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`
Eklan Multi-Turn Live Voice Simulation Spike — Mode A vs Mode C
──────────────────────────────────────────────────────────────
Mode A: transcribeAudio() → text turn → generateWithLiveAPIStream (Topic Practice's real flow)
Mode C: raw audio → generateVoiceConversationSSEStream / sendRealtimeInput (Free Talk's real, working audio-in flow)
Voice:  ${VOICE}
Turns:  ${STUDENT_TURNS.length}  (of 12 scripted)
Modes:  ${RUN_A ? "A " : ""}${RUN_C ? "C" : ""}
`);

const clips = await ensureAudioClips();

const historyA = [];
const historyC = [];
const resultsA = [];
const resultsC = [];

for (let i = 0; i < STUDENT_TURNS.length; i++) {
  const turnNumber = i + 1;
  const clip = clips[i];
  const groundTruth = STUDENT_TURNS[i];

  console.log(`\nTurn ${String(turnNumber).padStart(2, "0")}/${STUDENT_TURNS.length}  ground truth: "${groundTruth.slice(0, 55)}${groundTruth.length > 55 ? "…" : ""}"`);

  let a = null;
  let c = null;

  if (RUN_A) {
    const historyChars = historySizeChars(historyA);
    a = await runModeATurn(historyA, clip);
    resultsA.push({ turnNumber, historyChars, ...a });
    const zero = a.audioChunkCount === 0;
    console.log(
      `  [A] history=${historyChars}chars  transcribeHop=${fmt(a.transcribeMs)}  firstAudio=${fmt(a.firstAudioMs)}  lastAudio=${fmt(a.lastAudioMs)}  chunks=${a.audioChunkCount}  total=${fmt(a.totalMs)}` +
        `${zero ? "  ⚠ ZERO CHUNKS" : ""}${a.timedOut ? "  ⚠ TIMEOUT" : ""}${a.errorMessage ? `  ⚠ ERROR: ${a.errorMessage}` : ""}`
    );
    console.log(`      transcribed: "${(a.transcribedText || "").slice(0, 90)}"`);
    console.log(`      reply:       "${(a.transcript || "(none)").slice(0, 90)}"`);
  }

  if (RUN_C) {
    const historyChars = historySizeChars(historyC.slice(-6)); // Mode C only ever embeds the last 6 turns
    c = await runModeCTurn(historyC, clip);
    resultsC.push({ turnNumber, historyChars, ...c });
    const zero = c.audioChunkCount === 0;
    console.log(
      `  [C] history(last6)=${historyChars}chars  firstAudio=${fmt(c.firstAudioMs)}  lastAudio=${fmt(c.lastAudioMs)}  chunks=${c.audioChunkCount}  total=${fmt(c.totalMs)}` +
        `${zero ? "  ⚠ ZERO CHUNKS" : ""}${c.timedOut ? "  ⚠ TIMEOUT" : ""}${c.errorMessage ? `  ⚠ ERROR: ${c.errorMessage}` : ""}`
    );
    console.log(`      heard (input transcript): "${(c.inputTranscript || "(none)").slice(0, 90)}"`);
    console.log(`      reply:                    "${(c.transcript || "(none)").slice(0, 90)}"`);
  }

  // Both modes' history grows with the SAME ground-truth user text (see header
  // comment on fairness) but each mode's OWN model reply.
  historyA.push({ role: "user", content: groundTruth });
  historyA.push({ role: "model", content: a?.transcript || "(no transcript)" });

  historyC.push({ role: "user", content: groundTruth });
  historyC.push({ role: "model", content: c?.transcript || "(no transcript)" });
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n\nSummary\n───────`);

function summarize(label, results) {
  const succeeded = results.filter((r) => r.audioChunkCount > 0 && !r.errorMessage);
  const failed = results.filter((r) => r.audioChunkCount === 0 || r.errorMessage);
  const firstFailure = results.find((r) => r.audioChunkCount === 0 || r.errorMessage || r.timedOut);
  const firstAudioTimes = succeeded.map((r) => r.firstAudioMs).filter((v) => v != null);

  console.log(`\nMode ${label}:`);
  console.log(`  Turns attempted:        ${results.length}`);
  console.log(`  Turns with audio:       ${succeeded.length}`);
  console.log(`  Turns with zero chunks: ${failed.length}`);
  console.log(
    `  First failing turn:     ${firstFailure ? `#${firstFailure.turnNumber} (${firstFailure.errorMessage || (firstFailure.timedOut ? "timeout" : "zero audio chunks")})` : "none"}`
  );
  console.log(`  p50 time-to-first-audio: ${fmt(percentile(firstAudioTimes, 0.5))}`);
  console.log(`  p95 time-to-first-audio: ${fmt(percentile(firstAudioTimes, 0.95))}`);
  driftCheck(`Mode ${label} history-growth drift`, succeeded);

  return { succeeded, firstAudioTimes };
}

const summaryA = RUN_A ? summarize("A", resultsA) : null;
const summaryC = RUN_C ? summarize("C", resultsC) : null;

if (RUN_A && RUN_C) {
  const meanA = mean(summaryA.firstAudioTimes);
  const meanC = mean(summaryC.firstAudioTimes);
  const meanTranscribeHop = mean(resultsA.map((r) => r.transcribeMs).filter((v) => v != null));
  console.log(`
Side-by-side delta
───────────────────
  Mode A mean time-to-first-audio: ${fmt(meanA)}  (of which transcription hop: ${fmt(meanTranscribeHop)})
  Mode C mean time-to-first-audio: ${fmt(meanC)}
  Mean delta (A − C):              ${meanA != null && meanC != null ? `${Math.round(meanA - meanC) >= 0 ? "+" : ""}${Math.round(meanA - meanC)}ms` : "—"}
  (Positive = Mode C is faster by that much. Mode C is a materially different
   implementation, not just a config swap — see header comment for the history-
   window difference — so this delta reflects both "no transcription hop" AND
   "different history mechanism", not modality alone.)
`);
}

console.log("\nPer-turn detail — Mode A (for pasting into a bug report):\n");
if (RUN_A) {
  console.table(
    resultsA.map((r) => ({
      turn: r.turnNumber,
      historyChars: r.historyChars,
      transcribeMs: r.transcribeMs != null ? Math.round(r.transcribeMs) : null,
      firstAudioMs: r.firstAudioMs != null ? Math.round(r.firstAudioMs) : null,
      lastAudioMs: r.lastAudioMs != null ? Math.round(r.lastAudioMs) : null,
      audioChunks: r.audioChunkCount,
      totalMs: Math.round(r.totalMs),
      zeroChunks: r.audioChunkCount === 0,
      timedOut: r.timedOut,
      error: r.errorMessage || "",
    }))
  );
}

console.log("\nPer-turn detail — Mode C:\n");
if (RUN_C) {
  console.table(
    resultsC.map((r) => ({
      turn: r.turnNumber,
      historyChars: r.historyChars,
      firstAudioMs: r.firstAudioMs != null ? Math.round(r.firstAudioMs) : null,
      lastAudioMs: r.lastAudioMs != null ? Math.round(r.lastAudioMs) : null,
      audioChunks: r.audioChunkCount,
      totalMs: Math.round(r.totalMs),
      zeroChunks: r.audioChunkCount === 0,
      timedOut: r.timedOut,
      error: r.errorMessage || "",
    }))
  );
}

console.log("\nDone.\n");

// Force-exit: generateVoiceConversationSSEStream's session cache / idle timers
// (gemini.service.ts:1162-1169) and any live WebSocket handles can keep the
// event loop alive past normal completion. This is a throwaway script, not a
// long-running process, so terminate explicitly rather than let it hang.
process.exit(0);
