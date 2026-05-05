# Eklan Pressure Test — Architecture & AI Layers

High-level map of **Pressure Test** (staged roleplay under **Account → Practice → AI → Pressure Test**): pressured dialogue, scoring, levels, and persistence. For full API contracts, prompts, scoring math, and audio limits, see `docs/pressure-test-technical.md`.

---

## 1. Product shape

Learners choose a **drill-backed scenario**, then complete **short turns** (typically up to three) where the AI acts as a **demanding counterpart** (text streamed from Gemini, spoken via TTS). Responses are **timed**; speech is transcribed (browser-first, server fallback). At the end, the app **scores** accuracy, pronunciation, confidence, and speed, updates a **level (1–20)**, and stores the session for history and tutor review.

---

## 2. Layered architecture

| Layer | Role | Main technologies |
|-------|------|-------------------|
| **Presentation** | Drill picker, session history, chat drill UI, recording, results overlay | Next.js App Router, React (`src/app/(student)/account/practice/ai/pressure-test/`, `src/components/ai/PressureTestDrill.tsx`, `LessonReview.tsx`) |
| **API / orchestration** | Auth, Zod validation, drill lookup, streaming adapters | Next.js Route Handlers (`src/app/api/v1/pressure-test/…`) |
| **AI — scenario dialogue** | Multiturn **text** prompts; level- and turn-aware system instructions | `@google/generative-ai`, `startChat` + `sendMessageStream`, model from **`GEMINI_CHAT_MODEL`** (default `gemini-2.5-flash-lite`) |
| **AI — TTS** | Turn AI text into speech for playback | `@google/genai` `generateContent`, **`gemini-2.5-flash-preview-tts`** (`generateGeminiTTSAudio`) — `POST /api/v1/pressure-test/tts` |
| **AI — session analysis** | Structured qualitative scores + feedback JSON | Same chat stack, `generateContent` on aggregated transcript (`POST /api/v1/pressure-test/analyze`) |
| **Speech analytics** | Per-word pronunciation | **Speechace** API (parallel per turn in analyze) |
| **Transcription** | Student speech → text | **Web Speech API** (client primary); optional server **`transcribeAudio`** (Gemini on audio) |
| **Domain / prompts** | System prompt assembly from level, turn, drill content | `src/lib/api/pressure-test-prompts.ts` |
| **Data** | Sessions, raw archive, user level | MongoDB — `PressureTestSession`, `PressureTestRawData`, `user.pressureTestLevel` |
| **Auth & roles** | Student routes; tutor/admin aggregates; admin export | `withAuth`, `withRole`, tutor–student checks |

---

## 3. Request flows (simplified)

### 3.1 During a session (each AI turn)

1. Client sends message history + **level**, **turnNumber**, **drillId** to `POST /api/v1/pressure-test/chat`.
2. Server loads drill, builds system prompt via `buildSystemPrompt`, streams Gemini reply as **SSE** (`text` chunks + `done`).
3. Client requests audio for the line: `POST /api/v1/pressure-test/tts` → WAV bytes from Gemini preview TTS.

**Note:** This is **not** the Gemini Live path used by Free Talk voice; it is **REST chat + separate TTS** per line.

### 3.2 Student reply capture

1. **Transcript:** Web Speech API (with timeout); if empty, server transcription or placeholder `"(voice response)"`.
2. **Audio:** `MediaRecorder` → base64 in analyze payload (size-guarded per turn).

### 3.3 End of session — analyze

1. Client posts `POST /api/v1/pressure-test/analyze` with turns (text, latency, duration, optional audio).
2. Server runs **Speechace** (fan-out per turn) and **Gemini** evaluation in parallel where possible.
3. **Composite score** drives level rules (e.g. progress mix: accuracy, pronunciation, confidence, speed).
4. Writes **`PressureTestSession`**, **`PressureTestRawData`** (archive), updates **`User.pressureTestLevel`**.
5. Returns labels, strengths/weaknesses, next steps, per-turn feedback for UI (`LessonReview`).

---

## 4. Directory map (core files)

```
src/
├── app/(student)/account/practice/ai/pressure-test/
│   ├── page.tsx                    ← drill selection + history
│   └── chat/page.tsx               ← mounts PressureTestDrill
├── app/api/v1/pressure-test/
│   ├── chat/route.ts               ← Gemini SSE (text roleplay)
│   ├── tts/route.ts                ← Gemini preview TTS
│   ├── analyze/route.ts            ← Speechace + Gemini scoring + DB
│   └── sessions/route.ts           ← learner history
├── app/api/v1/tutor/pressure-test/
│   ├── [studentId]/route.ts
│   └── [studentId]/[sessionId]/route.ts
├── app/api/v1/admin/pressure-test/export/route.ts
├── components/ai/
│   ├── PressureTestDrill.tsx
│   └── LessonReview.tsx
├── lib/api/pressure-test-prompts.ts
├── models/
│   ├── pressure-test-session.ts
│   ├── pressure-test-raw-data.ts
│   └── user.ts                     ← pressureTestLevel
```

---

## 5. AI layer summary

| Stage | SDK / API style | Typical model (configurable where noted) |
|-------|-----------------|----------------------------------------|
| **Chat / roleplay** | `@google/generative-ai` streaming | `GEMINI_CHAT_MODEL` (e.g. flash-lite) |
| **TTS** | `@google/genai` `generateContent` | `gemini-2.5-flash-preview-tts` |
| **Analyze** | `generateContent` structured JSON | Same family as chat config |
| **Fallback transcribe** | Gemini on audio inline data | Aligns with other `generateContent` helpers |

Pressure Test **intentionally combines** several Gemini call styles; a healthy **Live** Free Talk setup does **not** guarantee every Pressure Test stage (especially **preview TTS** and **Speechace**) works without separate configuration and quota.

---

## 6. Scoring & progression (conceptual)

- **Progress to next level** blends **accuracy**, **pronunciation**, **confidence**, and **speed** (weighted).
- **Level up / down** thresholds apply to that composite (caps at levels 1–20).

Exact formulas and labels are documented in `docs/pressure-test-technical.md` (Scoring Formula section).

---

## 7. Related documentation

| Doc | Topic |
|-----|--------|
| `docs/pressure-test-technical.md` | Full stack table, API bodies, SSE format, MongoDB schemas, prompts, scoring |
| `docs/freetalk-vs-pressure-test-configuration.md` | Side-by-side Gemini and pipeline differences vs Free Talk |
| `docs/pressure-test-student-experience.md` | UX-oriented notes (if present) |
| `docs/pressure-test-connections.md` | Integration points (if present) |
