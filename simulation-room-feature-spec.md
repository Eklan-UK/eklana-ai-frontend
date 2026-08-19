# Simulation Room — Feature Spec (for mobile port)

Everything in this doc is sourced from the `stagin` branch of `Eklan-UK/eklana-ai-frontend` as of the commit this file was written against. File paths are cited so you can go verify directly.

## 1. What the feature is

Simulation Room is a voice-based roleplay training exercise. A tutor authors a **scenario** (a workplace situation — e.g. a nursing handover — with one or more AI-voiced characters and a scripted sequence of phases). A student starts a **session** against that scenario: they hear a spoken briefing, then have a real-time spoken conversation with an AI voice model, turn by turn (record → AI responds in voice) until either the scenario's phases are exhausted or a time limit is hit. Afterward, the student can request AI-generated grading of their pronunciation, grammar, and performance against the scenario's competency rubric.

The AI side is powered by Gemini's Live API (`gemini-2.5-flash-native-audio-latest`) via server-sent events — the server holds the live WebSocket connection to Gemini and re-streams it to the client as SSE. There is no client-to-Gemini direct connection.

## 2. Data model

### `SimulationSession` (`src/models/simulation-session.ts`)

One document per student attempt at a scenario. Fields a client actually interacts with (all exposed through the API endpoints below, not by querying the model directly):

| Field | Type | Client relevance |
|---|---|---|
| `_id` | ObjectId | `sessionId` used in every session-scoped route |
| `scenarioId` | ObjectId ref | which scenario this session is for |
| `status` | `'in_progress' \| 'completed' \| 'abandoned'` | drives which UI phase to show |
| `startedAt` | Date | combine with the scenario's `maxDurationMinutes` to compute the client-side countdown — see §6 |
| `completedAt` | Date? | set when status flips to `completed` |
| `briefingComplete` | boolean | false until `/start` is called; determines whether to replay the briefing or go straight to the conversation on session load |
| `currentPhaseIndex` | number | index into the scenario's `scenarioScript` array; drives phase-progress UI |
| `turns` | array of `{ turnNumber, role: 'student'\|'ai', text, audioUrl, createdAt }` | conversation history. **`audioUrl` is only ever populated for student turns** (uploaded to Cloudinary) — AI turns always have `audioUrl: ''`, so there is no way to re-fetch AI speech audio after the fact; only the AI's text is ever stored |
| `revealedFindings` | array of `{ phaseIndex, label, revealedAt }` | which gated findings have already been revealed this session (server-tracked so it doesn't re-reveal) |
| `overallGradeResult` | object, absent until graded | set by `POST /grade` — see §3 for shape |

Fields that exist on the model but are **not** meaningful to a client (internal bookkeeping): `assignedBy`, `turns[].speechaceResult` (raw per-turn grading detail — the client should read grading via the `/grade` response, not this), `turns[].audioDurationMs` (declared but never actually populated anywhere in the codebase).

### `SimulationScenario` (`src/models/simulation-scenario.ts`)

Authored by a tutor/admin (not part of the student mobile client's job to create — but the student session needs to read scenario-derived data via the endpoints below). Fields surfaced to the client:

| Field | Type | Client relevance |
|---|---|---|
| `title`, `workplaceSetting` | string | shown before the student starts |
| `maxDurationMinutes` | number | session time limit, used for the countdown |
| `displayData` | string | the spoken briefing text (also pre-synthesized as `briefingAudioBase64`) |
| `studentHint` | string | optional on-demand hint text (a "?" button in the web UI) |
| `scenarioScript` | array of phases, each `{ phaseName, triggerCondition, characters, conversationBeats, gatedFindings }` | only `phaseName` and `characters` are ever sent to the client (via session detail, see §3) — `triggerCondition`, `conversationBeats`, and `gatedFindings` are prompt-construction internals used server-side only and never returned to the client |
| `studentCharacterName` | string | the role the student is playing (used server-side in the AI prompt; not otherwise surfaced to the client) |

Fields that are tutor-authoring-only and never touch the client at all: `dramatisationPrompt`, `topicId`, `weeklyFocus`, `gradingRubric`, `hiddenContext`, `rawSourceText`, `assignedLearnerIds`, `createdBy`, `isActive`.

## 3. API contract

All routes are under `src/app/api/v1/simulation/`, auth-gated with `withRole(['user'], ...)` — the same session-cookie/JWT auth as the rest of the app (`credentials: "include"` on web). None of these are public.

---

**`GET /api/v1/simulation/scenarios`**
List the student's assigned scenarios, each paired with their latest session if one exists.
Response `data`: `{ scenarios: [{ scenarioId, title, workplaceSetting, maxDurationMinutes, latestSession: { sessionId, status } | null }] }`
Call when: showing the scenario picker screen. If `latestSession.status === 'in_progress'`, the UI should offer "Continue" (reopen that session) rather than starting a new one.
Source: `src/app/api/v1/simulation/scenarios/route.ts`

---

**`POST /api/v1/simulation/sessions`**
Start a new session for a scenario.
Request body (JSON): `{ scenarioId: string }`
Response `data`: `{ sessionId, displayData, maxDurationMinutes }`
Errors: 404 if scenario doesn't exist or isn't active; 403 if the student isn't assigned to it.
Call when: student picks "Start" on an unstarted scenario.
Source: `src/app/api/v1/simulation/sessions/route.ts`

---

**`GET /api/v1/simulation/sessions/[sessionId]`**
Full session + scenario detail for rendering the session screen.
Response `data`: `{ sessionId, status, startedAt, currentPhaseIndex, briefingComplete, turns: [{role, text, turnNumber}], scenario: { title, workplaceSetting, maxDurationMinutes, studentHint, phases: [{phaseName, characters}] } }`
Call when: loading/resuming a session. If `briefingComplete` is false, the client should play the briefing (see next endpoint) before showing the conversation UI; if true, go straight to the conversation (or the completed screen if `status === 'completed'`).
Source: `src/app/api/v1/simulation/sessions/[sessionId]/route.ts`

---

**`GET /api/v1/simulation/sessions/[sessionId]/briefing`**
Get the spoken briefing (only meaningful before `briefingComplete`).
Response `data`: `{ displayText: string, audioBase64: string }` — `audioBase64` is a full WAV file (pre-synthesized once at scenario-creation time and stored on the scenario, not regenerated per session).
Call when: loading a session that hasn't started yet, to play the intro audio.
Source: `src/app/api/v1/simulation/sessions/[sessionId]/briefing/route.ts`

---

**`POST /api/v1/simulation/sessions/[sessionId]/start`**
Marks the briefing as complete and returns phase 0's info.
No body. Response `data`: `{ phaseName: string, characters: string[] }`
Errors: 400 if session isn't `in_progress`, or if briefing was already started (call is not idempotent — don't call twice).
Call when: the briefing audio finishes playing and the student is ready to begin the conversation.
Source: `src/app/api/v1/simulation/sessions/[sessionId]/start/route.ts`

---

**`POST /api/v1/simulation/sessions/[sessionId]/opening`**
AI speaks first. Streams the AI's opening line as SSE (same event shape as `/turn`, see §4), and persists it as turn 0.
No body. Response: `Content-Type: text/event-stream`, OR a plain JSON `{ data: { sessionComplete: true } }` if the time limit was already exceeded before this was even called (see §6).
**Idempotent**: if turn 0 already exists (e.g. client retried after a network drop), it replays the stored text as a single `text` SSE event and closes — **no audio is re-synthesized on replay**, only text.
Call when: immediately after `/start` succeeds.
Source: `src/app/api/v1/simulation/sessions/[sessionId]/opening/route.ts`

---

**`POST /api/v1/simulation/sessions/[sessionId]/turn`**
The core loop: submit the student's recorded audio, get the AI's spoken response back over SSE. See §4 for the full sequence — this is the most important endpoint to get right.
Request: `multipart/form-data` with field `audio` (a Blob/File). Web sends `audio/webm;codecs=opus` (fallback `audio/webm`) filename `turn.webm` — the server reads whatever MIME type the client reports (`audio.type`) and passes it through to transcription; only webm/opus has actually been exercised, so don't assume other formats are guaranteed to work without testing.
Response: either `text/event-stream` (normal turn) or JSON `{ data: { sessionComplete: true } }` (time limit hit or no phases left — see §4/§6), or a 422 JSON error if the audio was rejected as silent/too short (see §6).
Source: `src/app/api/v1/simulation/sessions/[sessionId]/turn/route.ts`

---

**`POST /api/v1/simulation/sessions/[sessionId]/end`**
Student-initiated early end. Marks `status: 'completed'`, `completedAt: now`. No grading is triggered by this call.
No body. Response `data`: `{ sessionComplete: true }`. Errors: 400 if session isn't `in_progress`.
Call when: student taps "End Session" (web gates this behind 5 real minutes since `startedAt` — see §6, not a server-side rule, purely a client UX choice you can replicate or not).
Source: `src/app/api/v1/simulation/sessions/[sessionId]/end/route.ts`

---

**`POST /api/v1/simulation/sessions/[sessionId]/grade`**
Runs grading. **Not automatic** — must be explicitly called by the client, and only once `status === 'completed'`. Can take up to ~120s (route sets `maxDuration = 120`) since it runs SpeechAce pronunciation scoring per student turn, grammar analysis, and competency scoring against the rubric — in parallel with each other, but each is itself synchronous.
No body. Response `data` (= `SimulationGradeResult`, see `src/domain/simulation/simulation-grading.service.ts`):
```json
{
  "pronunciation": {
    "gradedTurnCount": 0,
    "failedTurnCount": 0,
    "mispronouncedWords": [{ "word": "string", "score": 0, "turnNumber": 0 }]
  },
  "grammar": {
    "errors": [{ "studentTurnNumber": 0, "quotedText": "string", "errorType": "context_error | phrasing_error", "correctedVersion": "string", "explanation": "string" }]
  },
  "competency": {
    "competencyScores": [{ "competencyName": "string", "rating": "exceeds | meets | fails", "evidence": "string" }],
    "overallSummary": "string"
  },
  "gradedAt": "ISO date string"
}
```
`mispronouncedWords` is every word scoring below 70/100 on SpeechAce's quality_score, flattened across all turns.
Errors: 400 if session isn't `completed` yet.
**Partial failure is normal, not exceptional**: if SpeechAce scoring fails for a given turn it's just excluded (reflected in `failedTurnCount`), and if grammar or competency analysis fails outright they fall back to `{errors: []}` / `{competencyScores: [], overallSummary: ''}` respectively — the endpoint itself still returns 200. Don't treat empty arrays/strings here as an error state; render them as empty states.
Call when: student taps "See my grades" on the completed screen.
Source: `src/app/api/v1/simulation/sessions/[sessionId]/grade/route.ts`, `src/domain/simulation/simulation-grading.service.ts`

---

**`POST /api/v1/simulation/audio/wav`** — exists but **not used by the current web client**. Converts a batch of base64 PCM chunks to a WAV file server-side. An earlier version of the web client called this for every audio chunk batch during turn playback; it now does the PCM→WAV conversion client-side instead (see §5) because the round trip was a source of audible playback gaps. The route itself is unchanged and still functional, but treat it as legacy/unused rather than part of the intended client flow — don't build new mobile functionality around it.
Source: `src/app/api/v1/simulation/audio/wav/route.ts`

## 4. The `/turn` flow

1. Client records the student's mic input (push-to-talk — see §6, there's no VAD/open-mic).
2. On stop, POST the recording to `/turn` as `multipart/form-data`.
3. **Before anything else**, the server checks the time limit and phase availability. If either is exhausted, it responds with plain JSON `{ data: { sessionComplete: true } }` (Content-Type `application/json`, not SSE) and the session is marked `completed` server-side. **Check `Content-Type` on the response to distinguish this from the SSE case** — the web client does exactly this (`res.headers.get("Content-Type")`).
4. Otherwise, the server transcribes the audio. If transcription is rejected — audio too short/silent (<3000 bytes), a model refusal, or pathologically repetitive/garbled output — it returns **422 JSON** with `message: "We couldn't understand that clearly — please try again"`. This is a "let the student re-record the same turn" case, not a fatal error; the turn is never persisted.
5. Otherwise, the server returns `Content-Type: text/event-stream` and streams these event types (`data: {...}\n\n` frames, JSON payload):
   - `{ type: "transcript", text }` — the student's own transcribed speech. **Sent first**, before any AI response, so the client can render the student's turn immediately without waiting.
   - `{ type: "phaseAdvance", newPhaseIndex }` — sent if the AI decided this turn satisfied the current phase's trigger condition. Can arrive **before** the AI's audio/text for the same turn (it's buffered and flushed early if the underlying tool call fires mid-generation) — a phase-progress UI can update before the corresponding speech finishes.
   - `{ type: "reveal", findings: [{label, data}] }` — newly-revealed gated findings for this phase, if the student's speech triggered any (detected by a separate server-side check against the transcript, not something the AI voices — see §6, the AI is explicitly instructed to never speak specific data values aloud). **This is the only way findings data reaches the client** — must be rendered in the UI, there's no other channel.
   - `{ type: "audio", data }` — base64 raw PCM audio chunk of the AI's spoken response. See §5 for playback handling.
   - `{ type: "text", data }` — incremental transcript text of the AI's spoken response (accumulate these into the full AI message).
   - `{ type: "error", message }` — only sent if the Live API produced zero audio/text chunks after being retried internally up to 3 times. Message is literally `"The AI did not respond. Please try again."`. **On this event: show the error, and let the student re-record their last turn** (the turn was never persisted server-side in this case either — return the UI to "ready to record", don't advance any turn counter).
   - Stream closes (`controller.close()`) after `turnComplete` — whether that was a normal completion or the exhausted-retries error case above.
6. Once the stream is fully drained (whether or not it errored), the server persists the student+AI turns and any phase/reveal state — this already happened server-side by the time your client's stream read loop returns, so there's nothing further to write back.

## 5. Client audio handling

- **Format**: the AI's voice audio arrives as raw PCM, 24kHz, 16-bit, mono, base64-encoded per `audio` SSE chunk (`src/services/gemini.service.ts`, `PCM_SAMPLE_RATE = 24_000` etc. mirrored in the web client).
- **Chunking/buffering**: the client buffers incoming base64 chunks and flushes a WAV-wrapped batch to the playback queue once ~1 second of audio has accumulated (`FLUSH_THRESHOLD_BYTES`), rather than waiting for the whole response — this is what makes playback start while the AI is still "speaking" server-side.
- **PCM → WAV conversion happens entirely client-side, no network call.** This ported the exact same WAV-header-wrapping logic as the server's `pcmToWavBase64` (`src/services/gemini.service.ts`) into browser JS (`base64ToBytes` / `bytesToBase64` / `pcmChunksToWavBase64` in the session page). A mobile client should do the equivalent locally — either wrap PCM in a WAV header the same way, or play raw PCM directly if the platform's audio APIs support it — rather than round-tripping to `/api/v1/simulation/audio/wav` (see §3, that endpoint is legacy/unused now).
- **Playback queue**: clips play back-to-back through a single audio player. Before playback starts, the client holds a small cushion — it waits for **2 clips** to be queued (or, if the stream has already ended, just **1**) before starting playback, specifically to avoid an audible gap if a later chunk's conversion lags. Once started, each subsequent clip plays immediately as it's enqueued.
- **Recording** (student → server): `MediaRecorder` with `audio/webm;codecs=opus` (fallback plain `audio/webm`), sent as the `audio` field. See §3's `/turn` entry for the caveat on other formats.

## 6. Known limitations / gotchas for the port

- **No open mic / VAD / barge-in.** Recording is strictly push-to-talk: the student explicitly starts and stops recording via a button; there's no silence detection, no ability to interrupt the AI while it's speaking, and no partial/streaming transcription of the student's own speech — the whole clip is transcribed in one shot after they stop recording.
- **Silence/too-short audio is a distinct, recoverable case**, not a generic error: 422 with a specific "couldn't understand" message, and the turn is never persisted. Handle it as "prompt to re-record," not as a failure toast that ends the flow.
- **The Live API's internal retry (up to 3 attempts) is invisible to the client until it's exhausted.** There's no partial-progress signal distinguishing "still generating" from "silently retrying" — a turn can take noticeably longer than usual before either succeeding or surfacing the `error` SSE event. Don't assume a fixed/short latency budget for `/turn`.
- **Time-limit enforcement is lazy, not pushed.** The server only checks `elapsed >= maxDurationMinutes` at the *start* of the next `/turn` or `/opening` call — there's no server-side timer or push notification when time actually runs out. If a student sits idle past the limit without submitting another turn, the session isn't marked `completed` until they try to act again (or explicitly end it). A mobile client that shows a live countdown (as the web client does, computed from `startedAt` + `maxDurationMinutes`) should independently drive its own "time's up" UI transition when the countdown hits zero — don't wait on the server to tell you.
- **Two different "leave" behaviors, both leaving the session `in_progress`:** a header close button with a native confirm dialog and no time gate (just navigates away, no API call), versus a "Leave & Continue Later" action that's gated behind **5 real minutes since `startedAt`** (client-side-only rule — the server places no such restriction on `/end` or on resuming). Both leave `status: 'in_progress'` for later resumption; neither calls `/end`. Only the explicit "End Session" action (same 5-minute gate) calls `/end` and finalizes the session. Replicate this distinction deliberately, or simplify it — but know the server doesn't enforce the 5-minute rule itself, so it's purely a product/UX choice, not an API constraint.
- **Grading is entirely on-demand.** Nothing computes `overallGradeResult` automatically when a session completes — the client must explicitly call `POST /grade`, and only after `status === 'completed'`. Treat the three grading dimensions (pronunciation/grammar/competency) as independently-optional in the response — each can legitimately come back empty on partial failure without the whole call erroring (see §3).
- **The AI never voices gated-finding data.** The system prompt explicitly forbids it from saying specific vitals/measurements/values aloud, even when contextually natural — that information only ever reaches the client via the `reveal` SSE event. A UI that only plays audio and shows the running transcript, without a dedicated findings surface, will silently lose information the scenario intends the student to have.
- **No AI-turn audio persistence.** `session.turns[].audioUrl` is only ever populated for student turns (uploaded to Cloudinary); AI turns are stored as text only. There's no way to re-fetch or replay a past AI response's audio after the live stream has closed — only the text survives in session history.
- **`/opening` replay has no audio.** If called again after turn 0 already exists (e.g. reconnecting after a dropped connection), it replays the stored opening line as a single `text` event only — don't expect audio on a replay.
