# Free Talk — Conversation Dying: Root Causes & Solution Options

This document maps each identified root cause to concrete, ranked fix options.
No code has been changed yet.

---

## Root Cause 1 — Hard 45-second Live API Timeout

### What happens
`generateWithLiveAPIStream` starts a 45-second `setTimeout` the moment the WebSocket opens.
If Gemini has not sent `turnComplete` by then, the stream is **silently closed** via
`controller.close()` — no error, no `metadata` chunk, just a dead stream.

With a long `userMessage` or large conversation history, Gemini needs more time to process
context before generating any tokens. This 45-second budget shrinks further as conversations grow.

**All** Live API callers share this same timeout: drill-practice, topic-practice, and free-talk.

### Fix Options

#### Option A — Raise the timeout (simplest, least safe)
Change `45000` to a higher value, e.g. `90000` (90 seconds) or `120000` (2 minutes).

- Pros: One-line change; immediately buys more room on slow connections.
- Cons: Masks the real problem; does nothing for conversations that keep growing;
  very long-running WebSocket sessions can be killed by the hosting platform anyway.
- Risk: If Gemini never sends `turnComplete` (e.g., a silent provider-side hang),
  the stream would stay open for 2 full minutes before timing out.

**Recommendation:** Use only as a quick interim measure. Combine with Option B.

---

#### Option B — Add a rolling "first-byte" sub-timeout (best practice)
Keep the overall session timeout (e.g. 90s) but add a **separate short timer** that fires
if **no audio or text chunk has arrived within N seconds** of sending the message.
Reset this "first-byte" timer as soon as the first chunk arrives.

```
const FIRST_BYTE_TIMEOUT = 20_000; // 20s to receive first chunk
const TOTAL_TIMEOUT      = 120_000; // 2min overall

// reset firstByteTimer when sendChunk() is called for the first time
```

- Pros: Catches genuine hangs early; total timeout still exists as a safety net.
- Cons: Slightly more state to manage; requires tracking "has first chunk arrived?"
- Risk: Low. Rolling timeout is standard practice for SSE streams.

**Recommendation:** This is the correct long-term solution alongside history trimming (RC2).

---

## Root Cause 2 — Unbounded Conversation History Sent in One WebSocket Message

### What happens
`generateFreeTalkResponseStream` sends the **entire** `conversationHistory` array plus the
new message in a single `sendClientContent({ turns, turnComplete: true })` call.

As the conversation grows (turn 6, 8, 10+), the total text payload keeps growing.
This directly increases:
- Context window usage → risk of provider rejection or degraded quality
- Pre-processing latency → shrinks the budget before the 45s timeout fires
- WebSocket payload size → risk of proxy or platform limits

Comparable endpoints (voice AI Talk, voice drill) already cap history: AI Talk uses the
**last 6** messages; drill voice uses the **last 4**. Free Talk has no such cap.

### Fix Options

#### Option A — Keep only the last N turn-pairs (recommended)
Before building `turns`, slice `validHistory` to the **most recent N messages**
(e.g. last 10 entries = 5 user + 5 model).

```ts
// Keep only the most recent 10 history entries
const trimmedHistory = validHistory.slice(-10);
const turns = [
  ...trimmedHistory.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
  { role: 'user', parts: [{ text: userMessage }] },
];
```

- Pros: Directly reduces payload; mirrors what AI Talk (6) and drill voice (4) already do.
- Cons: Very early context (scenario setup text) is lost; AI may "forget" the opening.
  For a Free Talk scenario this is mostly fine — the scenario title is in the system prompt.
- Risk: Low for scenarios up to 5 turns; AI still has current scenario context in system prompt.

**Recommendation:** Use `slice(-10)` as a safe default. The scenario title and situation
are already encoded in the system prompt, so losing old turns is acceptable.

---

#### Option B — Summarise older turns in the system prompt (advanced, high quality)
Instead of discarding old turns, periodically summarise the conversation so far
(using a cheap model call) and inject the summary into the system prompt as
"Conversation so far: ...". Only the most recent N turns are sent as `turns`.

- Pros: AI retains semantic memory of the full scenario without large payloads.
- Cons: Adds latency (extra model call) and complexity; overkill for 5-10 turn sessions.
- Risk: Medium — needs careful prompt design.

**Recommendation:** Not needed for the current scenario length. Revisit if scenarios
regularly exceed 15 turns.

---

## Root Cause 3 — `metadata` Chunk Lost When Stream Errors

### What happens
The final `metadata` SSE chunk (which carries `scenarioComplete`, `hint`,
`usefulPhrases`, etc.) is **only emitted in the `TransformStream.flush()` callback**.

`flush()` is only called when the upstream `ReadableStream` closes **cleanly**.
If `generateWithLiveAPIStream` calls `controller.error()` (WebSocket `onerror`) or the
45-second timeout fires and the stream is aborted, **`flush` never runs**.
The mobile app never receives `metadata` and the session state becomes undefined.

Additionally, `TextDecoder` is created without `stream: true`, meaning a UTF-8 character
that happens to be split across two consecutive `Uint8Array` chunks will be decoded
incorrectly, silently corrupting that SSE event.

### Fix Options

#### Option A — Emit `metadata` inside `transform` after the sentinel is detected
Instead of deferring `metadata` to `flush`, emit it **immediately** when
`SCENARIO_COMPLETE_TOKEN` is stripped from the text stream. A final "always-emit"
metadata can still be sent from `flush` as a fallback.

```ts
// In transform(), when SCENARIO_COMPLETE_TOKEN is found:
scenarioComplete = true;
const metadata = buildMetadata(textSoFar, true);
controller.enqueue(encode(`data: ${JSON.stringify({ type: 'metadata', data: metadata })}\n\n`));
```

- Pros: `metadata` is sent as soon as it is known; survives upstream errors.
- Cons: `fullText` at that point is incomplete (rest of the stream has not been received);
  `fullText` in `metadata` would be truncated.
- Risk: Low if the mobile app only uses `scenarioComplete` / `hint` from metadata
  and does not rely on `fullText` being complete.

---

#### Option B — Wrap the upstream pipe in a `try/finally` and emit a fallback metadata (recommended)
Pipe the `liveStream` through the transform, but if piping fails, catch the error and
emit a minimal `metadata` chunk before closing.

The pattern is to attach an `error` event listener to the `ReadableStream` reader and,
on error, manually enqueue a `{ type: 'metadata', data: { fullText: '', scenarioComplete: false } }`
so the mobile app always has something to act on.

- Pros: Keeps the current `flush`-based metadata path for the happy path;
  adds a safety-net for the error path; `fullText` is accurate on happy path.
- Cons: Slightly more wiring around the `pipeTo` call.
- Risk: Low.

**Recommendation:** Option B for the happy-path accuracy, combined with Option C.

---

#### Option C — Fix `TextDecoder` streaming mode
Change:
```ts
const decoder = new TextDecoder();
// …
const raw = decoder.decode(chunk);
```
To:
```ts
const decoder = new TextDecoder('utf-8', { fatal: false });
// …
const raw = decoder.decode(chunk, { stream: true });
```
And flush the decoder at the end of `transform` or in `flush`:
```ts
flush() { decoder.decode(); /* flush remaining bytes */ }
```

- Pros: Eliminates the multi-byte UTF-8 split bug; zero runtime cost; low risk.
- Cons: None.
- Risk: None.

**Recommendation:** Always apply this fix alongside any other stream changes.

---

## Root Cause 4 — Voice Transcription Truncates Long Speech

### What happens
`transcribeAudio` uses `maxOutputTokens: 2000`, which caps how long the **returned
transcript** can be. A student who speaks for 20-30 seconds in a native-language accent
(longer sentences, more words) can have their speech silently cut off at ~1500 words.

The Free Talk backend then receives a **truncated `userMessage`** — the AI responds to
an incomplete input, which appears to the user as the conversation "going off track"
or dying.

The `/api/v1/ai/voice` route also has `maxDuration = 30`, meaning the **entire
transcription HTTP handler must finish within 30 seconds** on platforms that enforce it
(e.g. Vercel Hobby/Pro). Long audio can push past this.

### Fix Options

#### Option A — Raise `maxOutputTokens` for transcription (immediate)
Change `2000` to `4096` (Gemini's practical per-response token limit for transcription).
```ts
generationConfig: {
  temperature: 0.1,
  maxOutputTokens: 4096,
}
```
- Pros: One-line change; immediately supports longer speech.
- Cons: Does not help if the audio itself exceeds Gemini's inline data limit.
- Risk: None.

**Recommendation:** Apply immediately.

---

#### Option B — Raise `maxDuration` on the voice route
Change `export const maxDuration = 30` to `export const maxDuration = 60` in
`src/app/api/v1/ai/voice/route.ts`.

- Pros: Prevents platform from killing the handler for longer recordings.
- Cons: Increases perceived latency on failures (user waits 60s instead of 30s before error).
- Risk: Low. Transcription should complete well within 60s for typical mobile recordings.

**Recommendation:** Apply alongside Option A.

---

#### Option C — Validate and cap audio size before calling Gemini
Add a simple size check before calling `transcribeAudio`:
```ts
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB
if (audioBuffer.length > MAX_AUDIO_BYTES) {
  return NextResponse.json(
    { code: 'Error', message: 'Recording is too long. Please keep recordings under 2 minutes.' },
    { status: 413 }
  );
}
```
- Pros: Provides a clear user-facing error instead of a silent hang or truncated transcript.
- Cons: Requires choosing a byte limit that matches Gemini's inline data limits.
- Risk: Low.

**Recommendation:** Add as a guard alongside the `maxOutputTokens` raise.

---

## Combined Recommended Fix Plan

| Priority | Area | Change |
|---|---|---|
| 1 (High) | History trimming | `slice(-10)` on `validHistory` before building `turns` |
| 2 (High) | Live API timeout | Raise overall timeout to 90s; add 20s first-byte sub-timer |
| 3 (Medium) | Metadata resilience | Emit fallback `metadata` on stream error; fix `TextDecoder` with `stream: true` |
| 4 (Medium) | Transcription output | Raise `maxOutputTokens` to `4096`; raise `maxDuration` to `60` |
| 5 (Low) | Audio size guard | Add `MAX_AUDIO_BYTES` check in voice route |

**Only `src/services/gemini.service.ts` and `src/app/api/v1/ai/voice/route.ts` need to change.**
Route files (`free-talk/route.ts`, `greeting/route.ts`) need no changes.

---

## What Will NOT Fix the Problem

- Changing the system prompt or scenario logic — the root causes are in the streaming
  infrastructure, not in AI instructions.
- Adding retry logic on the client — if the stream closes cleanly (timeout fires →
  `controller.close()`), the client has no way to distinguish a clean end from a hang.
- Increasing `maxDuration` on the Free Talk route — it is already 300s (5 minutes);
  the bottleneck is the internal 45s WebSocket timeout, not the HTTP handler limit.
