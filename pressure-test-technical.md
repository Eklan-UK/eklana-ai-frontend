# Pressure Test — Technical Breakdown

## Stack Overview

| Layer | Technology | Role |
|-------|-----------|------|
| Frontend | Next.js 14 (App Router), React, Tailwind CSS | UI, state management, audio capture |
| API Routes | Next.js Route Handlers (Node.js) | Business logic, auth, data persistence |
| AI — Chat | Google Gemini (`gemini-2.0-flash`) via SSE streaming | Roleplay partner, pressure scenarios |
| AI — Scoring | Google Gemini (`gemini-2.0-flash`) | Qualitative evaluation (accuracy, confidence, feedback) |
| Pronunciation | Speechace API | Per-word pronunciation scoring |
| Transcription | Web Speech API (client-side primary) + Gemini transcription (fallback) | Convert audio to text |
| Database | MongoDB via Mongoose | Session persistence, raw data archive, user levels |
| Auth | `withAuth` / `withRole` middleware | JWT-based route protection |

---

## Directory Map

```
src/
├── app/
│   ├── (student)/account/practice/ai/pressure-test/
│   │   ├── page.tsx                          ← drill selection + session history UI
│   │   └── chat/
│   │       └── page.tsx                      ← mounts PressureTestDrill component
│   └── api/v1/
│       ├── pressure-test/
│       │   ├── chat/route.ts                 ← Gemini SSE streaming
│       │   ├── analyze/route.ts              ← scoring engine + DB write
│       │   └── sessions/route.ts             ← student session history
│       ├── tutor/pressure-test/
│       │   ├── [studentId]/route.ts          ← aggregate overview for tutor
│       │   └── [studentId]/[sessionId]/route.ts ← session detail for tutor
│       └── admin/pressure-test/
│           └── export/route.ts               ← raw data export
├── components/ai/
│   ├── PressureTestDrill.tsx                 ← main drill component (recording, streaming, state)
│   └── LessonReview.tsx                      ← post-session results overlay
├── models/
│   ├── pressure-test-session.ts              ← scored session document
│   ├── pressure-test-raw-data.ts             ← audio + full transcript archive
│   └── user.ts                               ← includes pressureTestLevel field
└── lib/api/
    └── pressure-test-prompts.ts              ← shared Gemini prompt builders
```

---

## API Routes — Contracts and Logic

### `POST /api/v1/pressure-test/chat`

**Purpose:** Stream an AI roleplay prompt to the student turn-by-turn.

**Auth:** `withAuth` (student must be logged in)

**Request body:**
```json
{
  "messages": [{ "role": "user|model", "content": "string" }],
  "level": 4,
  "turnNumber": 1,
  "drillId": "abc123",
  "temperature": 0.75,
  "maxTokens": 120
}
```

**What happens inside:**
1. Validates input with Zod schema.
2. Fetches the drill from MongoDB to enrich the system prompt with roleplay context, target vocabulary, grammar focus, etc.
3. Calls `buildSystemPrompt(level, turnNumber, drill)` from `pressure-test-prompts.ts`.
4. Creates a Gemini `startChat` session with the constructed history.
5. Streams chunks back as Server-Sent Events (SSE):
   ```
   data: {"type":"text","data":"What would you"}
   data: {"type":"done","data":null}
   ```

**SSE format:**
- `{"type":"text","data":"<chunk>"}` — incremental text
- `{"type":"done","data":null}` — stream complete
- `{"type":"error","data":{"message":"..."}}` — stream error

---

### `POST /api/v1/pressure-test/analyze`

**Purpose:** Score the completed session, run the level progression engine, and persist all data.

**Auth:** `withAuth`

**Request body:**
```json
{
  "level": 4,
  "drillId": "abc123",
  "turns": [
    {
      "turnNumber": 1,
      "aiPrompt": "You're late. Explain yourself.",
      "studentResponseText": "I'm sorry, the train was delayed.",
      "latencyMs": 1800,
      "audioDurationMs": 4200,
      "audioBase64": "<base64 webm>"
    }
  ]
}
```

**Processing pipeline (runs in parallel where possible):**

```
turns ──► Speechace (pronunciation per word, fan-out per turn)
      ──► Gemini evaluation (accuracy, confidence, strengths, weaknesses, next steps)
            │
            ▼
      Aggregate scores
            │
            ▼
      progressToNextLevel = accuracy×0.4 + pronunciation×0.3 + confidence×0.2 + speedScore×0.1
            │
            ▼
      Level progression engine
        ≥ 75 → level up (max 20)
        ≤ 25 → level down (min 1)
            │
            ▼
      PressureTestSession.create(...)     ← scored session
      PressureTestRawData.create(...)     ← audio + full data (best-effort)
      User.findByIdAndUpdate(...)         ← update pressureTestLevel if changed
```

**Response:**
```json
{
  "data": {
    "responseSpeedSeconds": 1.8,
    "responseSpeedLabel": "Strong speed",
    "sentenceAccuracy": { "value": 72, "label": "Strong" },
    "pronunciation": { "value": 68, "label": "Strong" },
    "confidence": { "value": 65, "label": "Growing" },
    "level": 4,
    "levelBefore": 4,
    "levelAfter": 5,
    "levelChanged": true,
    "progressToNextLevel": 58,
    "strengths": ["..."],
    "weaknesses": ["..."],
    "nextSteps": ["..."],
    "turnFeedback": [{ "turnNumber": 1, "feedback": "...", "rating": "adequate" }]
  }
}
```

---

### `GET /api/v1/pressure-test/sessions`

**Purpose:** Return the authenticated student's session history.

**Auth:** `withAuth`

**Query params:** `limit` (default 10), `offset` (default 0)

**Response includes:** `currentLevel`, `totalSessions`, `averages`, `sessions[]` (with strengths, weaknesses, next steps per session)

---

### `GET /api/v1/tutor/pressure-test/[studentId]`

**Auth:** `withAuth` + `withRole(["tutor", "admin"])` + tutor-student assignment check

Returns aggregate statistics and paginated session list for a student.

---

### `GET /api/v1/tutor/pressure-test/[studentId]/[sessionId]`

**Auth:** Same as above.

Returns full session detail including turn transcripts, per-turn feedback, and qualitative analysis.

---

## MongoDB Collections

### `users` (existing, extended)

Added field:
```typescript
pressureTestLevel: { type: Number, default: 1, min: 1, max: 20 }
```

### `pressure_test_sessions`

One document per completed session. Stores:

| Field | Type | Description |
|-------|------|-------------|
| `userId` | ObjectId | Student reference |
| `drillId` | String | Source drill (nullable) |
| `level` / `levelBefore` / `levelAfter` | Number | Level state at session boundaries |
| `progressToNextLevel` | Number (0–100) | Composite weighted score |
| `overallResponseSpeed` | Number | Average latency in seconds |
| `overallAccuracy` | Number (0–100) | Gemini-scored grammar/relevance |
| `overallPronunciation` | Number (0–100) | Speechace aggregate |
| `overallConfidence` | Number (0–100) | Gemini-scored fluency/decisiveness |
| `strengths` / `weaknesses` / `nextSteps` | String[] | Qualitative feedback from Gemini |
| `turnFeedback` | Array | Per-turn rating + one-line feedback |
| `turns` | Array | AI prompt + student response + latency per turn |

### `pressure_test_raw_data`

One document per completed session. Stores everything needed for future model fine-tuning:

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | ObjectId | Links to `PressureTestSession` |
| `userId` | ObjectId | Student reference |
| `turns[].audioBase64` | String | Full audio recording (webm) |
| `turns[].pronunciationWordScores` | Array | Per-word Speechace scores + quality tag |
| `geminiModelUsed` | String | Model version for reproducibility |
| `systemPromptUsed` | String | Full system prompt snapshot |

**Storage constraint:** Each turn is guarded at 5 MB. Three turns = max ~15 MB, safely under MongoDB's 16 MB BSON document limit.

---

## Prompt Engineering

### System Prompt Construction (`pressure-test-prompts.ts`)

Every chat request builds a context-aware system prompt dynamically:

```
Base identity
+ Student level (1–20)
+ Turn number (1 = opening scene, 2–3 = follow-ups)
+ Drill enrichment:
    - roleplay_scenes (scene name, context, example dialogue)
    - target_sentences
    - target_vocabulary
    - grammar_focus
    - drill context
+ Level-specific behavior modifier
```

**Opening turn (turn 1):** The AI sets the full scene in ≤50 words — who it is, the situation, what happened, and a direct question.

**Follow-up turns (turns 2–3):** The AI keeps prompts under 20 words, acts impatient, and interrupts based on level intensity.

### Level Behavior Tiers

| Level range | Behavior |
|-------------|----------|
| 1–3 | Slow and clear; accept 1–3 word answers; repeat if no answer after 3 s |
| 4–7 | Mixed tenses; expect full sentences; interrupt after 2 s pause |
| 8–12 | Idioms and phrasal verbs; interrupt mid-sentence; no one-word answers |
| 13–17 | Abstract topics, rapid topic switches; interrupt on any hesitation |
| 18–20 | Near-native intensity; 1 s response expectation; penalise filler words |

### Token Limits by Level

| Turn | 1–3 | 4–7 | 8–12 | 13–20 |
|------|-----|-----|------|-------|
| Opening (turn 1) | 120 | 120 | 120 | 120 |
| Follow-ups | 80 | 140 | 200 | 260 |

---

## Scoring Formula

### Progress to Next Level (composite, 0–100)

```
progressToNextLevel = accuracy   × 0.40
                    + pronunciation × 0.30
                    + confidence    × 0.20
                    + speedScore    × 0.10

speedScore = max(0, 100 − responseSpeedSeconds × 22)
```

Speed score calibration:
- 0 s → 100 (perfect)
- 2 s → 56 (acceptable)
- 4.5 s → 0 (too slow)

### Level Progression Rules

| Condition | Outcome |
|-----------|---------|
| `progressToNextLevel >= 75` | Level +1 (capped at 20) |
| `progressToNextLevel <= 25` | Level −1 (floored at 1) |
| Otherwise | Level unchanged |

### Score Labels

| Score range | Label |
|-------------|-------|
| 85–100 | Excellent |
| 70–84 | Strong |
| 50–69 | Growing |
| 0–49 | Building |

---

## Audio Pipeline

```
Browser microphone
      │
      ▼
MediaRecorder (audio/webm;codecs=opus, 32kbps)
      │
      ├──► Web Speech API (runs in parallel, client-side, free)
      │         └──► primary transcript
      │
      └──► Blob captured on stop
                │
                ▼
            Size guard (> 5 MB → reject with toast)
                │
                ▼
            blobToBase64()
                │
                ▼
            Sent in analyze payload as audioBase64
                │
                ▼
            Speechace pronunciation scoring (server-side)
```

**Transcription priority:**
1. Web Speech API final result (waited up to 1.5 s after stop)
2. Server-side Gemini transcription via `aiService.transcribeAudio()`
3. Fallback label: `"(voice response)"`

---

## Security and Access Control

- All API routes are protected by `withAuth` — unauthenticated requests return 401.
- Tutor routes additionally require `withRole(["tutor", "admin"])` and verify the tutor-student assignment via `TutorAssignment` before returning any data.
- Audio payloads are validated server-side: base64 decoded and checked against the 5 MB limit.
- `maxDuration = 300` is set on the analyze route to support longer Speechace + Gemini calls.
