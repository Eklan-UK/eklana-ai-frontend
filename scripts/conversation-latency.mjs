` /**
 * Eklan AI — Conversation Latency Benchmark
 * ==========================================
 * Measures end-to-end response times for Free Talk (text + voice) and Pressure Test
 * by hitting the real Next.js API routes over HTTP and parsing the SSE stream.
 *
 * REQUIREMENTS
 *   Node 18+ (native fetch, FormData, Blob)
 *
 * ENV VARS
 *   LATENCY_BASE_URL       Base URL of the running Next.js server. Default: http://localhost:3000
 *   LATENCY_COOKIE         Full Cookie header string (copy from browser DevTools →
 *                          Network → any /api request → Request Headers → Cookie).
 *                          Required unless LATENCY_AUTHORIZATION is set.
 *   LATENCY_AUTHORIZATION  Bearer <token> string for mobile-style auth.
 *                          Alternative to LATENCY_COOKIE.
 *   LATENCY_RUNS           Number of timed runs per scenario (after warmup). Default: 3
 *   LATENCY_WARMUP         Warmup runs discarded before recording. Default: 1
 *   LATENCY_ONLY           Comma-separated list to restrict scenarios:
 *                            freetalk-text, freetalk-voice, pressure
 *                          Default: all three.
 *   PRESSURE_LEVEL         Student level 1-20 for Pressure Test payload. Default: 3
 *   PRESSURE_DRILL_ID      Optional drillId to include in Pressure Test request for
 *                          a realistic system prompt. Leave blank for generic prompt.
 *
 * EXAMPLE
 *   npm run latency:conversation
 *   LATENCY_BASE_URL=http://localhost:3000 LATENCY_COOKIE='better-auth.session_token=abc...' npm run latency:conversation
 *   LATENCY_ONLY=freetalk-text,pressure LATENCY_RUNS=5 npm run latency:conversation
 *
 * REGENERATE VOICE FIXTURE
 *   ./node_modules/ffmpeg-static/ffmpeg -f lavfi -i anullsrc=r=16000:cl=mono -t 1 \
 *     -c:a libopus -b:a 16000 scripts/fixtures/minimal-voice.webm -y
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

// ── Load .env ─────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

try {
  const { default: dotenv } = await import("dotenv");
  dotenv.config({ path: join(root, ".env") });
} catch {
  // dotenv is a devDependency; tolerate it missing in CI where env is pre-set
}

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL    = (process.env.LATENCY_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const COOKIE      = process.env.LATENCY_COOKIE        || "";
const AUTH_HEADER = process.env.LATENCY_AUTHORIZATION || "";
const RUNS        = parseInt(process.env.LATENCY_RUNS   || "3",  10);
const WARMUP      = parseInt(process.env.LATENCY_WARMUP || "1",  10);
const ONLY_RAW    = (process.env.LATENCY_ONLY || "").trim();
const ONLY        = ONLY_RAW ? ONLY_RAW.split(",").map((s) => s.trim()) : null;

const PRESSURE_LEVEL    = parseInt(process.env.PRESSURE_LEVEL || "3", 10);
const PRESSURE_DRILL_ID = process.env.PRESSURE_DRILL_ID || "";

const VOICE_FIXTURE = join(__dirname, "fixtures", "minimal-voice.webm");

// ── Auth guard ────────────────────────────────────────────────────────────────
if (!COOKIE && !AUTH_HEADER) {
  console.error(`
ERROR: No authentication provided.

Set one of:
  LATENCY_COOKIE         — full Cookie header copied from browser DevTools
  LATENCY_AUTHORIZATION  — "Bearer <token>"

Example (browser cookie):
  LATENCY_COOKIE='better-auth.session_token=abc...' npm run latency:conversation
`);
  process.exit(1);
}

// ── Auth headers builder ──────────────────────────────────────────────────────
function authHeaders() {
  if (COOKIE)      return { Cookie: COOKIE };
  if (AUTH_HEADER) return { Authorization: AUTH_HEADER };
  return {};
}

// ── SSE streaming parser ──────────────────────────────────────────────────────
/**
 * Reads an SSE Response body and calls onChunk for every parsed JSON payload.
 * Handles the `data: {...}\n\n` wire format used by all three AI routes.
 * Returns timing measurements collected during the stream.
 *
 * @param {Response} response
 * @param {string[]} firstChunkTypes  SSE type values that count as "first model output"
 * @param {string[]} terminalTypes    SSE type values that signal the stream is done
 * @returns {Promise<{ firstMs: number|null, totalMs: number, responseText: string }>}
 */
async function consumeSSE(response, firstChunkTypes, terminalTypes) {
  const t0 = performance.now();
  let firstMs = null;
  let responseText = "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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

        if (firstMs === null && firstChunkTypes.includes(type)) {
          firstMs = performance.now() - t0;
        }

        if (type === "text" && typeof data === "string") {
          responseText += data;
        }

        if (terminalTypes.includes(type)) {
          // Don't break yet — consume remaining buffer; let reader.done close naturally
        }

        if (type === "error") {
          const msg = typeof data?.message === "string" ? data.message : String(data);
          throw new Error(`SSE error: ${msg}`);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    firstMs,
    totalMs: performance.now() - t0,
    responseText: responseText.trim(),
  };
}

// ── Percentile helper ─────────────────────────────────────────────────────────
function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum    = sorted.reduce((a, b) => a + b, 0);
  const p95idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return {
    min:  sorted[0],
    max:  sorted[sorted.length - 1],
    avg:  sum / sorted.length,
    p95:  sorted[p95idx],
  };
}

function fmt(ms) { return ms == null ? "—" : `${Math.round(ms)}ms`; }

function printStats(label, firstTimes, totalTimes) {
  const f = firstTimes.filter((v) => v != null);
  const t = totalTimes;
  console.log(`  First output  ${f.length ? `min ${fmt(stats(f).min)}  avg ${fmt(stats(f).avg)}  max ${fmt(stats(f).max)}  p95 ${fmt(stats(f).p95)}` : "(none recorded)"}`);
  console.log(`  Full stream   min ${fmt(stats(t).min)}  avg ${fmt(stats(t).avg)}  max ${fmt(stats(t).max)}  p95 ${fmt(stats(t).p95)}`);
}

// ── Scenario: Free Talk text (POST /api/v1/ai/chat) ──────────────────────────
async function runFreeTalkText() {
  const t0 = performance.now();
  const response = await fetch(`${BASE_URL}/api/v1/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Hey! Can you give me a quick tip for improving my English speaking confidence?" }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  const headersMs = performance.now() - t0;

  return consumeSSE(response, ["text"], ["done", "error"]).then((r) => ({
    ...r,
    headersMs,
  }));
}

// ── Scenario: Free Talk voice (POST /api/v1/ai/voice/conversation) ────────────
async function runFreeTalkVoice() {
  let fixtureBytes;
  try {
    fixtureBytes = readFileSync(VOICE_FIXTURE);
  } catch {
    throw new Error(`Voice fixture not found: ${VOICE_FIXTURE}\nRegenerate it with:\n  ./node_modules/ffmpeg-static/ffmpeg -f lavfi -i anullsrc=r=16000:cl=mono -t 1 -c:a libopus -b:a 16000 scripts/fixtures/minimal-voice.webm -y`);
  }

  const formData = new FormData();
  formData.append("audio", new Blob([fixtureBytes], { type: "audio/webm" }), "recording.webm");
  formData.append("conversationHistory", "[]");
  formData.append("context", "You are Eklan, a friendly English conversation partner. The student just wants a quick hello to begin.");

  const t0 = performance.now();
  const response = await fetch(`${BASE_URL}/api/v1/ai/voice/conversation`, {
    method: "POST",
    headers: authHeaders(),   // No Content-Type — FormData sets it with boundary
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  const headersMs = performance.now() - t0;

  // Voice route emits: audio (PCM base64), text (transcript/response), metadata (turn end)
  return consumeSSE(response, ["audio", "text"], ["metadata", "error"]).then((r) => ({
    ...r,
    headersMs,
  }));
}

// ── Scenario: Pressure Test chat (POST /api/v1/pressure-test/chat) ────────────
async function runPressureTest() {
  const sessionId = randomUUID();

  const body = {
    messages: [{ role: "user", content: "begin" }],
    level: PRESSURE_LEVEL,
    turnNumber: 1,
    sessionId,
    isNewSession: true,
    reset: true,
    ...(PRESSURE_DRILL_ID ? { drillId: PRESSURE_DRILL_ID } : {}),
  };

  const t0 = performance.now();
  const response = await fetch(`${BASE_URL}/api/v1/pressure-test/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const headersMs = performance.now() - t0;

  return consumeSSE(response, ["text"], ["done", "error"]).then((r) => ({
    ...r,
    headersMs,
  }));
}

// ── Runner: execute one scenario N+warmup times ───────────────────────────────
async function runScenario(name, fn, { runs, warmup }) {
  const firstTimes = [];
  const totalTimes = [];
  const headerTimes = [];

  const totalAttempts = warmup + runs;

  for (let i = 0; i < totalAttempts; i++) {
    const isWarmup = i < warmup;
    const label = isWarmup ? `(warmup ${i + 1}/${warmup})` : `run ${i - warmup + 1}/${runs}`;
    process.stdout.write(`  ${label}... `);

    try {
      const result = await fn();

      const preview = result.responseText
        ? `"${result.responseText.slice(0, 60).replace(/\n/g, " ")}${result.responseText.length > 60 ? "…" : ""}"`
        : "(audio/binary response)";

      console.log(
        `first=${fmt(result.firstMs)} total=${fmt(result.totalMs)} | ${preview}`
      );

      if (!isWarmup) {
        firstTimes.push(result.firstMs);
        totalTimes.push(result.totalMs);
        headerTimes.push(result.headersMs);
      }
    } catch (err) {
      console.log(`FAILED — ${err.message}`);
      if (!isWarmup) {
        // Push null so run count stays correct; filter nulls out in stats
        firstTimes.push(null);
        totalTimes.push(null);
      }
    }
  }

  const validTotal = totalTimes.filter((v) => v != null);
  if (validTotal.length === 0) {
    console.log("  All runs failed — no stats available.");
    return;
  }

  console.log("");
  printStats(name, firstTimes, validTotal);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const scenarios = [
  {
    id: "freetalk-text",
    name: "Free Talk — text (POST /api/v1/ai/chat)",
    fn: runFreeTalkText,
  },
  {
    id: "freetalk-voice",
    name: "Free Talk — voice (POST /api/v1/ai/voice/conversation)",
    fn: runFreeTalkVoice,
  },
  {
    id: "pressure",
    name: "Pressure Test — chat (POST /api/v1/pressure-test/chat)",
    fn: runPressureTest,
  },
];

const selected = ONLY
  ? scenarios.filter((s) => ONLY.includes(s.id))
  : scenarios;

if (selected.length === 0) {
  console.error(`No matching scenarios for LATENCY_ONLY="${ONLY_RAW}". Valid: freetalk-text, freetalk-voice, pressure`);
  process.exit(1);
}

console.log(`
Eklan Conversation Latency Benchmark
─────────────────────────────────────
Target: ${BASE_URL}
Auth:   ${COOKIE ? "Cookie" : "Bearer token"}
Warmup: ${WARMUP} run(s) per scenario (discarded)
Runs:   ${RUNS} timed run(s) per scenario

Note: All timings measured from fetch() call until first model chunk / stream end.
      Voice path includes FFmpeg audio conversion server-side (~200–600ms overhead).
`);

for (const scenario of selected) {
  console.log(`\n▶  ${scenario.name}`);
  await runScenario(scenario.name, scenario.fn, { runs: RUNS, warmup: WARMUP });
}

console.log("\nDone.\n");
