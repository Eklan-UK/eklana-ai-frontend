# Eklan Free Talk — Architecture & AI Layers

High-level map of **Free Talk** (open conversation practice under **Account → Practice → AI**): how the UI, APIs, Gemini, and persistence fit together. For configuration quirks vs Pressure Test, see `docs/freetalk-vs-pressure-test-configuration.md`. For post-session summaries, see `docs/freetalk-summary-integration.md`.

---

## 1. Product shape

Learners pick a **topic** or continue from a **completed roleplay drill**, then hold a **multi-turn conversation** with an AI tutor—either **text** (chat + SSE) or **voice** (mic → server → streaming AI speech back). Ending the session can trigger a **structured learning summary** stored in MongoDB.

---

## 2. Layered architecture

| Layer | Role | Main technologies |
|-------|------|-------------------|
| **Presentation** | Topic selection, session UI, history display, voice/text toggles, exit + review modal | Next.js App Router, React, Tailwind (`src/app/(student)/account/practice/ai/`) |
| **API / orchestration** | Auth, validation, wiring to Gemini services, summary persistence | Next.js Route Handlers (`src/app/api/v1/ai/…`) |
| **AI — text chat** | Multiturn text; optional system instructions for topic or drill context | Gemini via REST/SSE (`/api/v1/ai/conversation`, `/api/v1/ai/chat`) |
| **AI — voice (core loop)** | Single pipeline: user audio in → model audio + transcriptions out | **Gemini Live** native audio (`@google/genai`, WebSocket), model `gemini-2.5-flash-native-audio-latest` in `src/services/gemini.service.ts` |
| **AI — end-of-session** | Grammar / vocabulary / flow feedback from transcript | `src/services/summary.service.ts` (e.g. `gemini-2.5-flash` with fallback) |
| **Domain logic** | Free-talk + drill overlay prompts, vocab matching, URL param encoding | `src/domain/ai/free-talk.ts` |
| **Audio utilities** | Format conversion for Live API | FFmpeg (`ffmpeg-static`) server-side |
| **Data** | Session summaries and metadata | MongoDB / Mongoose — `src/models/ai-session.ts` |
| **Auth** | Learner-only routes | `withAuth` / session cookies on API routes |

---

## 3. Request flows (simplified)

### 3.1 Text conversation

1. Client (`session/page.tsx`) maintains `conversationHistory`.
2. **Non-streaming:** `POST /api/v1/ai/conversation` — full reply in JSON.
3. **Streaming:** `POST /api/v1/ai/chat` — SSE chunks for incremental UI.

System instructions for **topic** or **drill-backed** free talk are built with helpers from `free-talk.ts` (e.g. `buildFreeTalkSystemInstruction`).

### 3.2 Voice conversation (primary Free Talk differentiator)

1. Client records audio and posts **multipart** to `POST /api/v1/ai/voice/conversation` (`src/app/api/v1/ai/voice/conversation/route.ts`).
2. Handler loads optional user first name, then calls `generateVoiceConversationSSEStream` in `gemini.service.ts`.
3. Server opens or reuses a **Live** session (cache key pattern `freetalk_<userId>`), converts input to PCM, streams **output audio** and **input/output transcription** back to the client as SSE.
4. Client plays AI audio and appends transcript turns to history.

This path avoids a separate “chat then TTS” chain for the main loop: **audio in, audio out**, with transcriptions from the same Live session.

### 3.3 Drill-linked Free Talk

When the learner enters from a **completed scenario drill**, optional **drill context** (scenario, vocabulary, script) is resolved by `resolveDrillFreeTalkOverlay` and sent to:

- `POST /api/v1/ai/drill-practice` / **greeting** / **voice** routes (server-enriched prompts), and/or
- Voice/text context fields on the session page.

Keeps the AI aligned with the drill’s roleplay material instead of a generic chat.

### 3.4 Session summary (on exit)

1. Client posts transcript to `POST /api/v1/ai/session/summary`.
2. Route validates, calls `generateSessionSummaryFromTranscript` in `summary.service.ts`.
3. Summary is persisted on **`AiSession`**; client shows `SessionReviewModal`.

Learners can list past summaries via `GET /api/v1/ai/session/summaries` (`summaries/page.tsx`).

---

## 4. Directory map (core files)

```
src/
├── app/(student)/account/practice/ai/
│   ├── page.tsx                 ← topic + entry to session
│   ├── session/page.tsx         ← main Free Talk UI (text + voice)
│   └── summaries/page.tsx       ← history of summaries
├── app/api/v1/ai/
│   ├── conversation/route.ts    ← text reply
│   ├── chat/route.ts            ← text SSE
│   ├── voice/conversation/route.ts  ← voice → Live → SSE
│   ├── session/summary/route.ts
│   ├── session/summaries/route.ts
│   └── drill-practice/          ← text/greeting/voice with drill overlay
├── domain/ai/free-talk.ts       ← prompts, overlay, vocab helpers
├── services/gemini.service.ts   ← Live native audio, SSE bridging
├── services/summary.service.ts  ← post-session Gemini summary
├── services/ai.service.ts       ← client fetch helpers for APIs
└── models/ai-session.ts         ← persisted summaries + session metadata
```

---

## 5. AI layer summary

| Concern | Mechanism |
|---------|-----------|
| **Real-time voice** | Gemini **Live** WebSocket, native audio modality, server-side session reuse |
| **Real-time text** | Gemini chat over HTTP (conversation + SSE chat routes) |
| **Reflection / coaching** | One-shot structured JSON from transcript (`summary.service.ts`) |
| **Personalization** | User name, topic id, optional `DrillFreeTalkOverlay` from `free-talk.ts` |

---

## 6. Dependencies & env (voice path)

- **`GEMINI_API_KEY`** — required for Live and summary flows using Gemini.
- **FFmpeg** — bundled for audio conversion on the voice route.

---

## 7. Related documentation

| Doc | Topic |
|-----|--------|
| `docs/freetalk-vs-pressure-test-configuration.md` | Why Free Talk vs Pressure Test use different Gemini surfaces |
| `docs/freetalk-summary-integration.md` | Summary API, payload types, models |
