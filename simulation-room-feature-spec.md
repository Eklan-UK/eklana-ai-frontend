# Simulation Room — Feature Spec (for mobile port)

Everything in this doc is sourced from the `Dev_Amanda` branch of `Eklan-UK/eklana-ai-frontend`, current as of commit `047d05b` ("fix: stale closure in submitTurn causing phase-intro screen to never show on advance"). File paths are cited so you can go verify directly.

This spec was substantially rewritten after a "restructure Simulation Room flow" pass (commit `2fb96df`) that changed the scenario data model, the pre-conversation flow, the hint mechanic, and removed the mid-conversation "gated findings" reveal mechanism entirely. If you have an older copy of this doc, treat it as stale — the API response shapes below changed, not just prose.

## 1. What the feature is

Simulation Room is a voice-based roleplay training exercise. A tutor/admin authors a **scenario** (a workplace situation — e.g. a nursing handover — identified solely by a **topic**, with a background, patient information, and a scripted sequence of phases, each phase voiced by one or more AI characters). A student starts a **session** against that scenario: they click Start, read/hear a two-part briefing (Background, then Patient Information), see an intro screen for the first phase (title, situation, and that phase's clinical information — all shown upfront now, not gated), then have a real-time spoken conversation with an AI voice model, turn by turn (record → AI responds in voice), advancing through phases until the phases are exhausted or the time limit is hit. Afterward, the student can request AI-generated grading of their pronunciation, grammar, and performance against the scenario's competency rubric — though as of this rewrite, grading normally already ran automatically when the session ended (see §3, `/end`).

The AI side is powered by Gemini's Live API (`gemini-2.5-flash-native-audio-latest`), proxied through a separate **relay service** (`config.RELAY_URL`, see `src/lib/api/config.ts`) rather than held directly by this Next.js app — this app's `/turn` and `/opening` routes POST to `${RELAY_URL}/relay/turn` and re-stream the relay's SSE response to the client as SSE. There is no client-to-Gemini and no client-to-relay direct connection; the client only ever talks to this app's `/api/v1/simulation/*` routes.

## 2. Data model

### `SimulationSession` (`src/models/simulation-session.ts`)

One document per student attempt at a scenario. Fields a client actually interacts with (all exposed through the API endpoints below, not by querying the model directly):

| Field | Type | Client relevance |
|---|---|---|
| `_id` | ObjectId | `sessionId` used in every session-scoped route |
| `scenarioId` | ObjectId ref | which scenario this session is for |
| `status` | `'in_progress' \| 'completed' \| 'abandoned'` | drives which UI phase to show |
| `startedAt` | Date | combine with the scenario's `maxDurationMinutes` to compute the client-side countdown — see §6. Reset to "now" when `/start` is called (timer starts on the Start click, not at session-creation time), and shifted forward server-side on resume after a pause (see `pausedAt` below and `/pause` in §3) |
| `completedAt` | Date? | set when status flips to `completed` |
| `pausedAt` | Date \| null | **new**. Set by `POST /pause` when the student uses "Leave & Continue Later"; cleared automatically (and `startedAt` shifted forward by the elapsed pause duration) the next time `GET /sessions/[sessionId]` is called — see §3 |
| `briefingComplete` | boolean | false until `/start` is called; determines whether to replay the pre-conversation screens or go straight to the conversation on session load |
| `currentPhaseIndex` | number | index into the scenario's `scenarioScript` array; drives phase-progress UI |
| `turns` | array of `{ turnNumber, role: 'student'\|'ai', text, audioUrl, createdAt }` | conversation history. **`audioUrl` is only ever populated for student turns** (uploaded to Cloudinary) — AI turns always have `audioUrl: ''`, so there is no way to re-fetch AI speech audio after the fact; only the AI's text is ever stored |
| `overallGradeResult` | object, absent until graded | set automatically by `POST /end` (as of this rewrite) or on-demand by `POST /grade` — see §3 for shape |

Fields that exist on the model but are **not** meaningful to a client (internal bookkeeping): `studentId`, `assignedBy`, `turns[].speechaceResult` (raw per-turn grading detail — the client should read grading via the `/grade`/`/end` response, not this), `turns[].audioDurationMs` (declared but never actually populated anywhere in the codebase).

**Removed since the previous version of this doc**: `revealedFindings` no longer exists on the model at all — the entire gated-findings/"reveal" mechanism was deleted in the restructure (`simulation-turn-reveal.service.ts` was removed outright). All clinical information a student needs is now sent upfront (see the scenario phase fields below), not drip-fed mid-conversation.

### `SimulationScenario` (`src/models/simulation-scenario.ts`)

Authored by a tutor/admin (not part of the student mobile client's job to create — but the student session needs to read scenario-derived data via the endpoints below). Fields surfaced to the client:

| Field | Type | Client relevance |
|---|---|---|
| `workplaceSetting` | string | shown before the student starts |
| `topicId` | string | **replaces `title`, which was removed entirely.** Resolved server-side to a display string via `getTopicName(topicId)` (`@/config/competency-framework`) and returned to the client as `topic` — it is now the *sole* identifier shown to students (and to tutors/admins) for a scenario. Known tradeoff, called out directly in the model source (`simulation-scenario.ts:103-106`): multiple scenarios can share the same topic with nothing else distinguishing them in a list. |
| `maxDurationMinutes` | number | session time limit, used for the countdown |
| `background` / `backgroundAudioBase64` | string | **replaces `displayData`/(prior single briefing audio).** First of two sequential pre-conversation screens: spoken + written scene background. |
| `patientInformation` / `patientInformationAudioBase64` | string | Second of the two pre-conversation screens, shown right after Background. |
| `hints` | array of `{ phaseTitle, hintText }` | **replaces the old singular `studentHint`.** A scenario can now define multiple hints per phase — the client filters `hints` down to entries whose `phaseTitle` matches the current phase and renders them as a swipeable carousel (prev/next) behind the "?" lightbulb button. |
| `scenarioScript` | array of phases, each `{ phaseTitle, situation, clinicalInformation, triggerCondition, characters, conversationBeats }` | `phaseTitle`, `situation`, `clinicalInformation`, and `characters` are now all sent to the client (via session detail, see §3) and shown up front on the phase-intro screen before each phase's conversation begins. `triggerCondition` and `conversationBeats` remain prompt-construction internals, server-side only. **`gatedFindings` has been removed from the phase schema entirely** — there is no more mid-conversation reveal mechanic. |
| `studentCharacterName` | string | the role the student is playing (used server-side in the AI prompt; not otherwise surfaced to the client) |

Fields that are tutor-authoring-only and never touch the client at all: `dramatisationPrompt`, `weeklyFocus`, `gradingRubric`, `hiddenContext`, `rawSourceText`, `assignedLearnerIds`, `createdBy`, `isActive`.

**Immutability note for mobile clients**: once *any* session exists for a scenario (regardless of that session's status), the admin edit endpoint refuses further edits to it (`src/app/api/v1/admin/simulation/scenarios/[scenarioId]/route.ts` — existence check via `SimulationSession.exists({ scenarioId })`, returns 400 "cannot be edited because students have already started sessions on it"). A mobile client can therefore treat scenario/phase data fetched for an in-progress session as stable for that session's whole lifetime — no need to defensively re-fetch for staleness mid-session.

## 3. API contract

All routes are under `src/app/api/v1/simulation/`, auth-gated with `withRole(['user'], ...)` — the same session-cookie/JWT auth as the rest of the app (`credentials: "include"` on web). None of these are public.

---

**`GET /api/v1/simulation/scenarios`**
List the student's assigned scenarios, each paired with their latest session if one exists.
Response `data`: `{ scenarios: [{ scenarioId, workplaceSetting, maxDurationMinutes, topic, latestSession: { sessionId, status } | null }] }`
**`title` is gone — `topic` (a resolved display string derived from `topicId`) is the only name shown.**
Call when: showing the scenario picker screen. If `latestSession.status === 'in_progress'`, the UI should offer "Continue" (reopen that session) rather than starting a new one; if `'completed'`, offer "Try Again" alongside a "Show attempts" affordance (see the new `/attempts` endpoint below).
Source: `src/app/api/v1/simulation/scenarios/route.ts`

---

**`POST /api/v1/simulation/sessions`**
Start a new session for a scenario.
Request body (JSON): `{ scenarioId: string }`
Response `data`: `{ sessionId, background, maxDurationMinutes }` — **`background` replaces the old `displayData` key.**
Errors: 404 if scenario doesn't exist or isn't active; 403 if the student isn't assigned to it.
Call when: student picks "Start" on an unstarted scenario.
Source: `src/app/api/v1/simulation/sessions/route.ts`

---

**`GET /api/v1/simulation/sessions/[sessionId]`**
Full session + scenario detail for rendering the session screen.
Response `data`: `{ sessionId, status, startedAt, currentPhaseIndex, briefingComplete, turns: [{role, text, turnNumber}], scenario: { workplaceSetting, maxDurationMinutes, background, patientInformation, hints: [{phaseTitle, hintText}], phases: [{phaseTitle, situation, clinicalInformation, characters}] } }`
**No `title`/`studentHint` any more — see §2 for the field renames.** Every phase's `situation` and `clinicalInformation` are included upfront (not gated).
**New side effect**: if `session.pausedAt` is set (student previously used "Leave & Continue Later"), this call shifts `startedAt` forward by the elapsed pause duration and clears `pausedAt`, before returning — so the countdown resumes from where it was, not where it would be if the clock had kept running while the student was away.
Call when: loading/resuming a session. If `briefingComplete` is false, the client should show the pre-conversation flow (Start → Background → Patient Information → phase intro, see next endpoints); if true and `turns.length === 0`, resume into the current phase's intro screen (Start was clicked but the AI opening line never fired); if true and `turns.length > 0`, go straight to the live conversation; if `status === 'completed'`, show the completed screen.
Source: `src/app/api/v1/simulation/sessions/[sessionId]/route.ts`

---

**`GET /api/v1/simulation/sessions/[sessionId]/briefing`**
Get the spoken/written Background and Patient Information screens (only meaningful before `briefingComplete`).
Response `data`: `{ background: { displayText, audioBase64 }, patientInformation: { displayText, audioBase64 } }` — **this is now two sections, not one.** Each `audioBase64` is a full WAV file, pre-synthesized once at scenario-creation time and stored on the scenario, not regenerated per session.
Call when: on session load, before `briefingComplete`, to have both screens' audio ready to autoplay as the student advances through them.
Source: `src/app/api/v1/simulation/sessions/[sessionId]/briefing/route.ts`

---

**`POST /api/v1/simulation/sessions/[sessionId]/start`**
Marks the briefing as complete, **restarts the session timer** (`session.startedAt = new Date()` — the countdown begins here, not at session creation), and returns phase 0's info.
No body. Response `data`: `{ phaseTitle, characters, startedAt }` — **`phaseTitle` (was `phaseName`), plus the new `startedAt` so the client can immediately recompute its countdown without a second fetch.**
Errors: 400 if session isn't `in_progress`, or if briefing was already started (call is not idempotent — don't call twice).
Call when: the student taps "Start" on the pre-briefing screen — i.e. this now happens *before* Background/Patient Information are shown, not after the briefing audio finishes. The web client's flow is Start (this call) → Background screen → Patient Information screen → phase-intro screen → "Begin conversation" (which is what triggers `/opening`).
Source: `src/app/api/v1/simulation/sessions/[sessionId]/start/route.ts`

---

**`POST /api/v1/simulation/sessions/[sessionId]/opening`**
AI speaks first. Streams the AI's opening line as SSE (same event shape as `/turn`, see §4), and persists it as turn 0.
No body. Response: `Content-Type: text/event-stream`, OR a plain JSON `{ data: { sessionComplete: true } }` if the time limit was already exceeded before this was even called (see §6).
**Idempotent**: if turn 0 already exists (e.g. client retried after a network drop), it replays the stored text as a single `text` SSE event and closes — **no audio is re-synthesized on replay**, only text.
Call when: the student taps "Begin conversation" on the phase-intro screen (first entry into a phase, before any turns exist). On a phase advance mid-session, the client does **not** call this again — it just flips to "active" directly (the live Gemini session is cached server-side under a `sim_${sessionId}` key, so no new opening line is needed to resume).
Source: `src/app/api/v1/simulation/sessions/[sessionId]/opening/route.ts`

---

**`POST /api/v1/simulation/sessions/[sessionId]/turn`**
The core loop: submit the student's recorded audio, get the AI's spoken response back over SSE. See §4 for the full sequence — this is the most important endpoint to get right.
Request: `multipart/form-data` with field `audio` (a Blob/File). Web sends `audio/webm;codecs=opus` (fallback `audio/webm`) filename `turn.webm` — the server reads whatever MIME type the client reports (`audio.type`) and passes it through to transcription; only webm/opus has actually been exercised, so don't assume other formats are guaranteed to work without testing.
Response: either `text/event-stream` (normal turn) or JSON `{ data: { sessionComplete: true } }` (time limit hit or no phases left — see §4/§6), or a 422 JSON error if the audio was rejected as silent/too short (see §6).
Source: `src/app/api/v1/simulation/sessions/[sessionId]/turn/route.ts`

---

**`POST /api/v1/simulation/sessions/[sessionId]/pause`** — **new endpoint**, not in the previous version of this doc.
Records that the student is leaving via "Leave & Continue Later": sets `session.pausedAt = new Date()`. Session `status` stays `in_progress` — this is purely a timer bookkeeping call, not a status change.
No body. Response `data`: `{ sessionPaused: true }`. Errors: 400 if session isn't `in_progress`, or if already paused.
Call when: student taps "Leave & Continue Later" (web gates this behind the same 5-real-minutes-since-`startedAt` client UX rule as End Session — see §6). The resulting `startedAt` shift happens automatically the next time the session is loaded (see `GET /sessions/[sessionId]` above) — there's no separate "resume" call.
Source: `src/app/api/v1/simulation/sessions/[sessionId]/pause/route.ts`

---

**`POST /api/v1/simulation/sessions/[sessionId]/end`**
Student-initiated early end. Marks `status: 'completed'`, `completedAt: now`.
**Behavior change from the previous version of this doc: grading is no longer a separate step the client must trigger.** This route now calls `gradeSimulationSession` itself immediately after marking the session completed, best-effort (a grading failure is logged and swallowed — it does not fail the request, and the student can still retry via `/grade`). `maxDuration` is 120s on this route now, to give the inline grading call room.
No body. Response `data`: `{ sessionComplete: true }`. Errors: 400 if session isn't `in_progress`.
Call when: student taps "End Session" (web gates this behind 5 real minutes since `startedAt` — see §6, not a server-side rule, purely a client UX choice you can replicate or not).
Source: `src/app/api/v1/simulation/sessions/[sessionId]/end/route.ts`

---

**`POST /api/v1/simulation/sessions/[sessionId]/grade`**
Runs grading (or, as of this rewrite, **usually just returns the result `/end` already computed** — see below). Only callable once `status === 'completed'`. Can take up to ~120s (route sets `maxDuration = 120`) since it runs SpeechAce pronunciation scoring per student turn, grammar analysis, and competency scoring against the rubric — in parallel with each other, but each is itself synchronous.
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
**Short-circuit**: `gradeSimulationSession` checks `session.overallGradeResult` first and, if already set (the normal case now, since `/end` grades automatically), returns that stored result directly rather than re-running any LLM/SpeechAce calls. This route is therefore mostly a fast "fetch the grade" call in the current flow — it still serves as the retry path if the automatic run from `/end` failed or never completed.
`mispronouncedWords` is every word scoring below 70/100 on SpeechAce's quality_score, flattened across all turns.
Errors: 400 if session isn't `completed` yet.
**Partial failure is normal, not exceptional**: if SpeechAce scoring fails for a given turn it's just excluded (reflected in `failedTurnCount`), and if grammar or competency analysis fails outright they fall back to `{errors: []}` / `{competencyScores: [], overallSummary: ''}` respectively — the endpoint itself still returns 200. Don't treat empty arrays/strings here as an error state; render them as empty states.
Call when: student taps "See my grades" on the completed screen (will typically resolve near-instantly since grading already ran).
Source: `src/app/api/v1/simulation/sessions/[sessionId]/grade/route.ts`, `src/domain/simulation/simulation-grading.service.ts`

---

**`GET /api/v1/simulation/scenarios/[scenarioId]/attempts`** — **new endpoint**, not in the previous version of this doc.
Every **completed** session the authenticated student has run against a given scenario, oldest-first (so "Attempt 1", "Attempt 2", ... numbering on the client is stable/chronological). In-progress and abandoned/paused sessions are excluded.
Response `data`: `{ attempts: [{ sessionId, status, attemptedAt, overallGradeResult: SimulationGradeResult | null }] }` — `attemptedAt` is `completedAt` (falls back to `startedAt` if somehow unset). This is a summary list only — no `turns` array; fetch full turn history via `GET /sessions/[sessionId]` if ever needed.
Call when: student taps "Show attempts" on a scenario card that has a `latestSession`. The web client renders this as a list, and tapping a graded attempt opens a detail view reusing the same grade-result rendering as the live completed screen.
Source: `src/app/api/v1/simulation/scenarios/[scenarioId]/attempts/route.ts`

---

**`POST /api/v1/simulation/audio/wav`** — exists but **not used by the current web client**. Converts a batch of base64 PCM chunks to a WAV file server-side. An earlier version of the web client called this for every audio chunk batch during turn playback; it now does the PCM→WAV conversion client-side instead (see §5) because the round trip was a source of audible playback gaps. The route itself is unchanged and still functional, but treat it as legacy/unused rather than part of the intended client flow — don't build new mobile functionality around it.
Source: `src/app/api/v1/simulation/audio/wav/route.ts`

## 4. The `/turn` flow

1. Client records the student's mic input (push-to-talk — see §6, there's no VAD/open-mic).
2. On stop, POST the recording to `/turn` as `multipart/form-data`.
3. **Before anything else**, the server checks the time limit and phase availability. If either is exhausted, it responds with plain JSON `{ data: { sessionComplete: true } }` (Content-Type `application/json`, not SSE) and the session is marked `completed` server-side. **Check `Content-Type` on the response to distinguish this from the SSE case** — the web client does exactly this (`res.headers.get("Content-Type")`). Note: this lazy-completion path does **not** trigger auto-grading — only the explicit `/end` call does (see §3).
4. Otherwise, the server transcribes the audio. If transcription is rejected — audio too short/silent (<3000 bytes), a model refusal, or pathologically repetitive/garbled output — it returns **422 JSON** with `message: "We couldn't understand that clearly — please try again"`. This is a "let the student re-record the same turn" case, not a fatal error; the turn is never persisted.
5. Otherwise, the server proxies the turn to the relay service and returns `Content-Type: text/event-stream`, streaming these event types (`data: {...}\n\n` frames, JSON payload):
   - `{ type: "transcript", text }` — the student's own transcribed speech. **Sent first**, before any AI response, so the client can render the student's turn immediately without waiting.
   - `{ type: "phaseAdvance", newPhaseIndex }` — sent if the AI decided this turn satisfied the current phase's trigger condition. Can arrive **before** the AI's audio/text for the same turn (it's buffered and flushed early if the underlying tool call fires mid-generation) — a phase-progress UI can update before the corresponding speech finishes. On this event, the client should navigate to the phase-intro screen for the new phase (title/situation/clinical info, "Continue conversation" button) rather than continuing straight into the next phase's dialogue.
   - `{ type: "audio", data }` — base64 raw PCM audio chunk of the AI's spoken response. See §5 for playback handling.
   - `{ type: "text", data }` — incremental transcript text of the AI's spoken response (accumulate these into the full AI message).
   - `{ type: "error", message }` — sent if the Live API produced zero audio/text chunks. Message is literally `"The AI did not respond. Please try again."`. **On this event: show the error, and let the student re-record their last turn** (the turn was never persisted server-side in this case either — return the UI to "ready to record", don't advance any turn counter). **Note**: the retry logic that decides when to give up and emit this event now lives in the separate relay service (`config.RELAY_URL`, outside this repo) rather than in this route directly — if you need exact retry-count/backoff details, they're not verifiable from this codebase alone.
   - Stream closes (`controller.close()`) after the above — whether that was a normal completion or the exhausted-retries error case.
   - **Removed since the previous version of this doc**: there is no more `{ type: "reveal", findings }` event. The gated-findings mechanism was deleted entirely in the restructure — all clinical information for a phase is now delivered upfront via `GET /sessions/[sessionId]`'s `phases[].situation`/`phases[].clinicalInformation`, shown on the phase-intro screen before the phase's conversation starts, rather than drip-fed mid-conversation based on what the student said.
6. Once the stream is fully drained (whether or not it errored), the server persists the student+AI turns and any phase-advance state — this already happened server-side by the time your client's stream read loop returns, so there's nothing further to write back.

## 5. Client audio handling

- **Format**: the AI's voice audio arrives as raw PCM, 24kHz, 16-bit, mono, base64-encoded per `audio` SSE chunk (`src/services/gemini.service.ts`, `PCM_SAMPLE_RATE = 24_000` etc. mirrored in the web client).
- **Chunking/buffering**: the client buffers incoming base64 chunks and flushes a WAV-wrapped batch to the playback queue once ~1 second of audio has accumulated (`FLUSH_THRESHOLD_BYTES`), rather than waiting for the whole response — this is what makes playback start while the AI is still "speaking" server-side.
- **PCM → WAV conversion happens entirely client-side, no network call.** This ports the same WAV-header-wrapping logic as the server's `pcmToWavBase64` (`src/services/gemini.service.ts`) into browser JS (`base64ToBytes` / `bytesToBase64` / `pcmChunksToWavBase64` in the session page). A mobile client should do the equivalent locally — either wrap PCM in a WAV header the same way, or play raw PCM directly if the platform's audio APIs support it — rather than round-tripping to `/api/v1/simulation/audio/wav` (see §3, that endpoint is legacy/unused now).
- **Playback queue**: clips play back-to-back through a single audio player. Before playback starts, the client holds a small cushion — it waits for **2 clips** to be queued (or, if the stream has already ended, just **1**) before starting playback, specifically to avoid an audible gap if a later chunk's conversion lags. Once started, each subsequent clip plays immediately as it's enqueued.
- **Recording** (student → server): `MediaRecorder` with `audio/webm;codecs=opus` (fallback plain `audio/webm`), sent as the `audio` field. See §3's `/turn` entry for the caveat on other formats.
- The two static pre-conversation screens (Background, Patient Information) each autoplay their own WAV audio (`backgroundAudioBase64`/`patientInformationAudioBase64` from `/briefing`) the same fire-and-forget, best-effort way — autoplay-block is non-fatal since the text is already on screen.

## 6. Known limitations / gotchas for the port

- **No open mic / VAD / barge-in.** Recording is strictly push-to-talk: the student explicitly starts and stops recording via a button; there's no silence detection, no ability to interrupt the AI while it's speaking, and no partial/streaming transcription of the student's own speech — the whole clip is transcribed in one shot after they stop recording.
- **Silence/too-short audio is a distinct, recoverable case**, not a generic error: 422 with a specific "couldn't understand" message, and the turn is never persisted. Handle it as "prompt to re-record," not as a failure toast that ends the flow.
- **The relay's retry behavior is opaque from this repo.** Live API calls now go through a separate relay service; the app-level route no longer visibly implements the "retry N times before giving up" logic described in older versions of this doc. Don't assume a fixed/short latency budget for `/turn` — a turn can still take noticeably longer than usual before either succeeding or surfacing the `error` SSE event, you just can't verify the exact retry policy from this codebase.
- **Time-limit enforcement is lazy, not pushed.** The server only checks `elapsed >= maxDurationMinutes` at the *start* of the next `/turn` or `/opening` call — there's no server-side timer or push notification when time actually runs out, and this lazy-completion path does **not** trigger auto-grading (only `/end` does). If a student sits idle past the limit without submitting another turn, the session isn't marked `completed` until they try to act again (or explicitly end it). A mobile client that shows a live countdown (as the web client does, computed from `startedAt` + `maxDurationMinutes`) should independently drive its own "time's up" UI transition when the countdown hits zero — don't wait on the server to tell you.
- **Two different "leave" behaviors, both leaving the session `in_progress`:** a header close button with a native confirm dialog and no time gate (just navigates away, no API call), versus a "Leave & Continue Later" action that's gated behind **5 real minutes since `startedAt`** (client-side-only rule — the server places no such gate on `/pause` itself) and now **does** call the server (`POST /pause`, sets `pausedAt`). Only the explicit "End Session" action (same 5-minute client gate) calls `/end` and finalizes the session (now with auto-grading — see §3). The pause/resume timer math (shifting `startedAt` forward by the time spent away) is handled server-side, automatically, the next time `GET /sessions/[sessionId]` is called — replicate this rather than trying to track elapsed pause time purely on-device.
- **Grading is no longer purely on-demand.** `POST /end` now triggers `gradeSimulationSession` automatically, best-effort, right after marking the session completed. `POST /grade` still exists and is still the right call for "See my grades" / attempt-detail UI, but in the normal flow it's now mostly returning an already-computed result via a short-circuit rather than doing fresh work — it remains the retry path for when the automatic run failed. Treat the three grading dimensions (pronunciation/grammar/competency) as independently-optional in the response — each can legitimately come back empty on partial failure without the whole call erroring (see §3).
- **No mid-conversation "reveal" mechanic any more.** The AI never withheld clinical data to begin with, but the old drip-feed reveal system (`{type: "reveal"}` SSE events, `revealedFindings` on the session, `gatedFindings` on each phase) has been deleted outright. All of a phase's clinical information (`situation`, `clinicalInformation`) is now shown up front on that phase's intro screen, before any conversation for that phase happens. A UI that doesn't render the phase-intro screen's `situation`/`clinicalInformation` text will lose information the scenario intends the student to have — there's no other channel it arrives on.
- **No AI-turn audio persistence.** `session.turns[].audioUrl` is only ever populated for student turns (uploaded to Cloudinary); AI turns are stored as text only. There's no way to re-fetch or replay a past AI response's audio after the live stream has closed — only the text survives in session history.
- **`/opening` replay has no audio.** If called again after turn 0 already exists (e.g. reconnecting after a dropped connection), it replays the stored opening line as a single `text` event only — don't expect audio on a replay.
- **Hints are now a per-phase carousel, not one static string.** A scenario can define multiple `hints` entries sharing the same `phaseTitle`; the client filters to the current phase and lets the student page through them. Design for zero, one, or many hints per phase — "no hint available for this phase" is an expected, renderable state, not an error.
- **Topic is the only scenario name.** `title` was removed from the schema entirely; scenarios are identified to students purely by `topic` (derived from `topicId` via `getTopicName()`). Multiple scenarios can resolve to the same topic string with nothing else in the list UI to tell them apart — this is a known, unaddressed tradeoff, not a bug to "fix" independently in a mobile port without a broader product decision.
- **Scenario data is immutable once any session exists against it** (admin-side edit-lock — see §2). A mobile client can safely treat scenario/phase content as stable for the duration it's showing a session; it does not need to guard against the scenario changing out from under an in-progress attempt.
- **Attempt history is a new, separate surface.** `GET /scenarios/[scenarioId]/attempts` lists a student's own completed attempts (with grade results) for a given scenario, independent of the currently-active session flow. A mobile port should decide deliberately whether/how to expose this rather than assuming the old single-latest-session model still covers everything the API can now show.
