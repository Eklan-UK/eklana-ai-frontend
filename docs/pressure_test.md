# Eklan Pressure Test — Backend Implementation Plan

## How the Pressure Test works (user perspective)

The Pressure Test is a **fixed three-turn** spoken exercise built on a **roleplay drill** the student has already **completed in Free Talk** (only those drills are **unlocked** on the selection page).

1. **Start a session** — The student opens a drill and lands on the chat screen. They see a **greeting** plus an AI “typing” state while the first scenario **streams in** word by word. When the stream **finishes**, a **2s mental-translation** clock starts (used for on-device speed feedback: time until their **first speech** or **tap to record**). The full AI text is **read aloud automatically** (server TTS, with a **browser speech fallback** if playback or the TTS request fails).
2. **Each turn** — The bottom control shows **“Eklan is thinking…”** while the AI is generating, **“Processing…”** while the last reply is being transcribed, and **“Tap to speak”** when it is the student’s turn. The student **records** (live **waveform** + timer), can **play back** or **discard** the take, then **sends** it. Their line appears; the **next AI line streams in** and is **read aloud the same way** when streaming completes. The header shows **turn 1 of 3 → 2 of 3 → 3 of 3**.
3. **After turn 3** — An **analyzing** state runs, then a **review** overlay with scores, qualitative feedback, and (where implemented) level progression. The student can return to practice or their **history** from the Pressure Test area.

A longer, step-by-step **student experience** (selection, history, review cards) is in [`pressure-test-student-experience.md`](./pressure-test-student-experience.md).

---

## Current Status

### What exists today

| Layer | Status | Notes |
|-------|--------|-------|
| **UI — Selection page** | Done | `pressure-test/page.tsx` — lists drills, navigates to chat |
| **UI — Drill session** | Done | `PressureTestDrill.tsx` — 3-turn chat, recording, waveform, send |
| **UI — Lesson Review** | Done | `LessonReview.tsx` — post-session metrics overlay |
| **API — `/pressure-test/chat`** | Scaffold | Streams Gemini text via SSE; system prompt is generic; **level hardcoded to 4** |
| **API — `/pressure-test/analyze`** | Scaffold | Calls Speechace + single Gemini scoring pass; persists `PressureTestSession`; **no progression logic** |
| **Model — `PressureTestSession`** | Scaffold | Stores turns + aggregate scores; **no link to drill**; no tutor visibility |
| **Student level system** | Missing | No `pressureTestLevel` on User; UI sends `level: 4` everywhere |
| **Tutor review** | Missing | No API or UI for tutors to view pressure test results |
| **Historical data / analytics** | Missing | Sessions are write-only; no read/list API; no longitudinal tracking |
| **Data sovereignty pipeline** | Missing | Audio discarded after scoring; transcripts stored but no export/training pipeline |

### What the Free Talk backend already provides (reference, not to modify)

- `gemini.service.ts` — Live API streaming, drill-aware prompts (`buildDrillPracticePrompt`), session caching
- `speechace.service.ts` — pronunciation scoring with 5 MB guard
- `ai.service.ts` (client) — SSE helpers, transcription
- `withAuth` / `withRole` middleware pattern
- Mongoose models for drills, drill assignments, AI sessions, user, profile

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT (Next.js)                       │
│                                                                │
│  PressureTestDrill.tsx ──► /api/v1/pressure-test/chat (SSE)   │
│          │                                                      │
│          └──► /api/v1/pressure-test/analyze (POST)             │
│          └──► /api/v1/pressure-test/sessions (GET — new)       │
│                                                                │
│  TutorDashboard ──► /api/v1/tutor/pressure-test/[studentId]   │
│                     /api/v1/tutor/pressure-test/[studentId]/   │
│                       [sessionId]                               │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                     API ROUTES (Node.js)                       │
│                                                                │
│  pressure-test/                                                │
│    chat/route.ts ────► Gemini text streaming (SSE)            │
│    analyze/route.ts ──► Speechace + Gemini scoring            │
│                        ► Level progression engine              │
│                        ► PressureTestSession.create            │
│                        ► PressureTestRawData.create (sovereign)│
│    sessions/route.ts ─► Read student history (new)            │
│                                                                │
│  tutor/pressure-test/                                         │
│    [studentId]/route.ts ────► Aggregate + session list (new)  │
│    [studentId]/[sessionId]/route.ts ──► Detail view (new)     │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                     MONGODB COLLECTIONS                        │
│                                                                │
│  users ──────────────── pressureTestLevel (new field)         │
│  pressure_test_sessions ── existing, expanded                 │
│  pressure_test_raw_data ── new (audio + transcripts archive)  │
└──────────────────────────────────────────────────────────────┘
```

---

## Phase 1 — Student Level System

### Problem

There is no concept of a "pressure test level" on the student. The UI hardcodes `level: 4` in both the chat and analyze calls. The system prompt treats all students identically.

### Solution

Add a `pressureTestLevel` field to the User model and build a progression engine in the analyze route.

### 1.1 — Add `pressureTestLevel` to User model

**File:** `src/models/user.ts`

Add to the schema:

```typescript
pressureTestLevel: {
  type: Number,
  default: 1,
  min: 1,
  max: 20,
},
```

No migration needed — Mongoose defaults handle existing documents.

### 1.2 — Read level on session start

**File:** `src/components/ai/PressureTestDrill.tsx`

Replace the hardcoded `level: 4` with a fetch from the user's profile on mount:

```typescript
const [studentLevel, setStudentLevel] = useState<number>(1);

useEffect(() => {
  fetch("/api/v1/users/me", { credentials: "include" })
    .then((r) => r.json())
    .then((d) => setStudentLevel(d.data?.pressureTestLevel ?? 1))
    .catch(() => setStudentLevel(1));
}, []);
```

Pass `studentLevel` to both `streamAiReply(historyWithUser, studentLevel)` and the analyze payload `level: studentLevel`.

### 1.3 — Level progression engine

**File:** `src/app/api/v1/pressure-test/analyze/route.ts`

After computing the aggregate scores, determine whether the student levels up:

```typescript
const LEVEL_UP_THRESHOLD = 75;   // progressToNextLevel >= 75 → advance
const LEVEL_DOWN_THRESHOLD = 25; // progressToNextLevel <= 25 → regress (minimum level 1)

// Fetch current level from User
const user = await User.findById(context.userId).select("pressureTestLevel");
const currentLevel = user?.pressureTestLevel ?? 1;

// Compute progressToNextLevel (already exists in the route)
// progressToNextLevel = weighted blend of accuracy, pronunciation, confidence, speed

let newLevel = currentLevel;
if (progressToNextLevel >= LEVEL_UP_THRESHOLD) {
  newLevel = Math.min(currentLevel + 1, 20);
} else if (progressToNextLevel <= LEVEL_DOWN_THRESHOLD) {
  newLevel = Math.max(currentLevel - 1, 1);
}

// Persist
if (newLevel !== currentLevel) {
  await User.findByIdAndUpdate(context.userId, { pressureTestLevel: newLevel });
}
```

Store `levelBefore` and `levelAfter` on the session document so progression is auditable.

### 1.4 — Expand `PressureTestSession` schema

**File:** `src/models/pressure-test-session.ts`

Add:

```typescript
drillId: { type: String, index: true },          // links session to the source drill
levelBefore: { type: Number, required: true },    // level at session start
levelAfter: { type: Number, required: true },     // level after progression engine
```

---

## Phase 2 — Drill-Aware Scenario Generation

### Problem

The chat system prompt is a static string. It does not incorporate the drill's vocabulary, grammar targets, or roleplay scenes.

### Solution

Fetch the drill document server-side and inject its content into the system prompt.

### 2.1 — Pass `drillId` through to the chat route

**File:** `src/components/ai/PressureTestDrill.tsx`

Already sends `drillId` in the chat payload — confirmed.

### 2.2 — Enrich the system prompt

**File:** `src/app/api/v1/pressure-test/chat/route.ts`

```typescript
import { connectToDatabase } from "@/lib/api/db";
import Drill from "@/models/drill";

// Inside handler, after validation:
await connectToDatabase();
const drill = validated.drillId
  ? await Drill.findById(validated.drillId).lean()
  : null;

function buildSystemPrompt(level: number, turnNumber: number, drill: any): string {
  const base = [
    "You are an AI instructor conducting an Eklan Pressure Test.",
    "Your goal: eliminate the student's mental translation so they respond within 1–2 seconds.",
    "Act impatient but professional — like a demanding interviewer.",
    "If the student hesitates or gives a slow/incomplete answer, interrupt them with a follow-up.",
    `Student level: ${level} (scale 1–20). Use ONLY vocabulary and grammar appropriate for this level.`,
    `Current turn: ${turnNumber} of 3.`,
    "Keep each prompt UNDER 20 words. Be direct. No small talk.",
  ];

  if (drill) {
    if (drill.target_vocabulary?.length) {
      base.push(`Target vocabulary the student must use: ${drill.target_vocabulary.join(", ")}.`);
    }
    if (drill.target_sentences?.length) {
      base.push(`Target sentences/patterns: ${drill.target_sentences.slice(0, 3).join(" | ")}.`);
    }
    if (drill.roleplay_scenes?.length) {
      base.push(`Roleplay scenario context: "${drill.roleplay_scenes[0]}".`);
    }
    if (drill.grammar_focus) {
      base.push(`Grammar focus: ${drill.grammar_focus}.`);
    }
    if (drill.context) {
      base.push(`Drill context: ${drill.context}.`);
    }
  }

  // Level-specific behavioral modifiers
  if (level <= 3) {
    base.push("Speak slowly and clearly. Use simple present tense. Accept short answers.");
  } else if (level <= 7) {
    base.push("Use mixed tenses. Expect complete sentences. Add mild time pressure.");
  } else if (level <= 12) {
    base.push("Use idioms and phrasal verbs. Interrupt mid-sentence if they pause. Expect fluent responses.");
  } else {
    base.push("Use complex structures, abstract topics, and rapid topic switches. Zero tolerance for hesitation.");
  }

  return base.join(" ");
}
```

### 2.3 — Dynamic turn count (future consideration)

Currently fixed at 3 turns. In the future, higher levels could increase to 5 turns. For now, keep `TOTAL_TURNS = 3` but make it a parameter the API accepts.

---

## Phase 3 — Student Analysis (Enhanced)

### Problem

The current analyze route computes four scores and a `progressToNextLevel` percentage, but:
- Does not identify specific **strengths and weaknesses**
- Does not provide **next steps**
- The LLM scoring prompt is minimal

### Solution

Expand the Gemini analysis prompt to return structured qualitative feedback alongside numeric scores.

### 3.1 — Enhanced LLM analysis prompt

**File:** `src/app/api/v1/pressure-test/analyze/route.ts`

Replace the `evaluateAccuracyAndConfidence` function with a richer prompt:

```typescript
async function evaluateSession(
  turns: Array<{ aiPrompt: string; studentResponseText: string; latencyMs: number }>,
  level: number,
): Promise<{
  accuracy: number;
  confidence: number;
  strengths: string[];
  weaknesses: string[];
  nextSteps: string[];
  turnFeedback: Array<{
    turnNumber: number;
    feedback: string;
    rating: "strong" | "adequate" | "needs_work";
  }>;
}> {
  const prompt = `You are an expert English language assessor for the Eklan Pressure Test.

Student level: ${level}/20.

Evaluate the following pressure-test turns. For each turn you have the AI prompt, the student's spoken response (transcribed), and how long they took to respond in milliseconds.

Turns:
${turns.map((t, i) => `Turn ${i + 1}:
  AI: "${t.aiPrompt}"
  Student: "${t.studentResponseText}"
  Response time: ${t.latencyMs}ms`).join("\n\n")}

Return a JSON object with:
{
  "accuracy": <0-100 sentence accuracy score>,
  "confidence": <0-100 confidence score based on response completeness, hesitation markers, and latency>,
  "strengths": [<2-3 specific things the student did well>],
  "weaknesses": [<2-3 specific areas for improvement>],
  "nextSteps": [<2-3 actionable recommendations>],
  "turnFeedback": [
    { "turnNumber": 1, "feedback": "<one sentence>", "rating": "strong|adequate|needs_work" },
    ...
  ]
}

Be specific. Reference actual words/phrases from the student's responses.
Return ONLY valid JSON. No markdown fences.`;

  // ... Gemini generateContent call with JSON parsing ...
}
```

### 3.2 — Store qualitative feedback

**File:** `src/models/pressure-test-session.ts`

Add to schema:

```typescript
strengths: [{ type: String }],
weaknesses: [{ type: String }],
nextSteps: [{ type: String }],
turnFeedback: [{
  turnNumber: Number,
  feedback: String,
  rating: { type: String, enum: ["strong", "adequate", "needs_work"] },
}],
```

### 3.3 — Return enhanced data to the UI

The analyze API response already returns `result.data` to the client. Expand to include:

```json
{
  "overallResponseSpeed": 1.8,
  "overallAccuracy": 72,
  "overallPronunciation": 68,
  "overallConfidence": 65,
  "progressToNextLevel": 58,
  "level": 4,
  "levelBefore": 4,
  "levelAfter": 4,
  "strengths": ["Good use of target vocabulary", "Natural greeting"],
  "weaknesses": ["Long pause before Turn 2", "Incomplete sentence in Turn 3"],
  "nextSteps": ["Practice restaurant ordering scenarios", "Focus on past tense responses"],
  "turnFeedback": [...]
}
```

### 3.4 — Update `LessonReview.tsx`

Add a section below the metrics to display strengths, weaknesses, and next steps using the new response fields.

---

## Phase 4 — Tutor Review System

### Problem

Tutors have no visibility into their students' pressure test performance. They cannot track progress over time or identify struggling students.

### Solution

Build a tutor-facing API and UI surface.

### 4.1 — New API routes

#### `GET /api/v1/tutor/pressure-test/[studentId]`

**File:** `src/app/api/v1/tutor/pressure-test/[studentId]/route.ts`

Returns an aggregate overview + paginated session list for a specific student.

```typescript
// Auth: withAuth + withRole(["tutor", "admin"])
// Verify tutor has access to this student via TutorAssignment

const sessions = await PressureTestSession.find({ userId: studentId })
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip(offset)
  .lean();

const totalSessions = await PressureTestSession.countDocuments({ userId: studentId });

// Compute longitudinal metrics
const avgSpeed = average(sessions.map(s => s.overallResponseSpeed));
const avgAccuracy = average(sessions.map(s => s.overallAccuracy));
const avgPronunciation = average(sessions.map(s => s.overallPronunciation));
const avgConfidence = average(sessions.map(s => s.overallConfidence));
const currentLevel = sessions[0]?.levelAfter ?? 1;

// Trend: compare last 5 sessions vs previous 5
const recent = sessions.slice(0, 5);
const previous = sessions.slice(5, 10);
const trends = {
  speed: trendDirection(average(recent.map(s => s.overallResponseSpeed)), average(previous.map(s => s.overallResponseSpeed))),
  accuracy: trendDirection(average(recent.map(s => s.overallAccuracy)), average(previous.map(s => s.overallAccuracy))),
  // ...
};

return {
  studentId,
  currentLevel,
  totalSessions,
  averages: { speed: avgSpeed, accuracy: avgAccuracy, pronunciation: avgPronunciation, confidence: avgConfidence },
  trends,
  sessions: sessions.map(s => ({
    sessionId: s._id,
    date: s.createdAt,
    level: s.level,
    levelAfter: s.levelAfter,
    scores: { speed: s.overallResponseSpeed, accuracy: s.overallAccuracy, pronunciation: s.overallPronunciation, confidence: s.overallConfidence },
    progressToNextLevel: s.progressToNextLevel,
  })),
  pagination: { total: totalSessions, limit, offset },
};
```

#### `GET /api/v1/tutor/pressure-test/[studentId]/[sessionId]`

**File:** `src/app/api/v1/tutor/pressure-test/[studentId]/[sessionId]/route.ts`

Returns full session detail including all turns, per-turn feedback, strengths/weaknesses, and next steps.

### 4.2 — Student history API

#### `GET /api/v1/pressure-test/sessions`

**File:** `src/app/api/v1/pressure-test/sessions/route.ts`

Allows students to view their own past sessions:

```typescript
// Auth: withAuth
const sessions = await PressureTestSession.find({ userId: context.userId })
  .sort({ createdAt: -1 })
  .limit(20)
  .lean();
```

### 4.3 — Tutor UI integration

Extend the existing tutor student detail page (`/tutor/students/[id]`) with a "Pressure Test" tab or section that calls the new API. This surfaces:
- Current level + trend arrows
- Average scores with sparkline-style progression
- Clickable session list with date, level, and scores
- Session detail modal with full turn transcripts and per-turn feedback

---

## Phase 5 — Data Sovereignty

### Problem

Audio recordings are base64-encoded, scored by Speechace, then discarded. Transcripts are stored in `PressureTestSession.turns` but audio is lost. For future model fine-tuning, we need to retain:
- Raw audio per turn
- Transcripts (already stored)
- Pronunciation scores per word (not just aggregate)
- Timing data

### Solution

Create a separate collection for raw data archival, stored locally in MongoDB GridFS or as base64 documents.

### 5.1 — New model: `PressureTestRawData`

**File:** `src/models/pressure-test-raw-data.ts`

```typescript
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IRawTurnData {
  turnNumber: number;
  aiPrompt: string;
  studentTranscript: string;
  latencyMs: number;
  audioBase64: string;          // full recording
  audioMimeType: string;        // e.g. "audio/webm"
  audioDurationMs: number;
  pronunciationWordScores: Array<{
    word: string;
    score: number;
    quality: string;            // "correct" | "mispronounced" | "missing"
  }>;
  pronunciationOverallScore: number;
  accuracyScore: number;
  confidenceScore: number;
}

export interface IPressureTestRawData extends Document {
  sessionId: Types.ObjectId;    // links to PressureTestSession
  userId: Types.ObjectId;
  drillId: string | null;
  level: number;
  turns: IRawTurnData[];
  geminiModelUsed: string;      // e.g. "gemini-2.0-flash"
  systemPromptUsed: string;     // full system prompt for reproducibility
  createdAt: Date;
}

const rawTurnSchema = new Schema<IRawTurnData>({
  turnNumber: Number,
  aiPrompt: String,
  studentTranscript: String,
  latencyMs: Number,
  audioBase64: String,
  audioMimeType: { type: String, default: "audio/webm" },
  audioDurationMs: Number,
  pronunciationWordScores: [{
    word: String,
    score: Number,
    quality: String,
  }],
  pronunciationOverallScore: Number,
  accuracyScore: Number,
  confidenceScore: Number,
}, { _id: false });

const pressureTestRawDataSchema = new Schema<IPressureTestRawData>({
  sessionId: { type: Schema.Types.ObjectId, ref: "PressureTestSession", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  drillId: { type: String, default: null },
  level: Number,
  turns: [rawTurnSchema],
  geminiModelUsed: String,
  systemPromptUsed: String,
}, {
  timestamps: true,
  collection: "pressure_test_raw_data",
});

// TTL index: auto-delete after 90 days to manage storage (adjust as needed)
// Remove this index if you want permanent retention
// pressureTestRawDataSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

const PressureTestRawData: Model<IPressureTestRawData> =
  mongoose.models.PressureTestRawData ||
  mongoose.model<IPressureTestRawData>("PressureTestRawData", pressureTestRawDataSchema);

export default PressureTestRawData;
```

### 5.2 — Write raw data during analysis

**File:** `src/app/api/v1/pressure-test/analyze/route.ts`

After creating the `PressureTestSession`, also write the raw data:

```typescript
import PressureTestRawData from "@/models/pressure-test-raw-data";

// After session creation:
await PressureTestRawData.create({
  sessionId: session._id,
  userId: context.userId,
  drillId: validated.drillId ?? null,
  level: validated.level,
  turns: validated.turns.map((turn, i) => ({
    turnNumber: turn.turnNumber,
    aiPrompt: turn.aiPrompt,
    studentTranscript: turn.studentResponseText,
    latencyMs: turn.latencyMs,
    audioBase64: turn.audioBase64,
    audioMimeType: "audio/webm",
    audioDurationMs: 0, // TODO: extract from audio metadata
    pronunciationWordScores: pronunciationResults[i]?.wordScores ?? [],
    pronunciationOverallScore: pronunciationResults[i]?.overallScore ?? 0,
    accuracyScore: turnAccuracyScores[i] ?? 0,
    confidenceScore: turnConfidenceScores[i] ?? 0,
  })),
  geminiModelUsed: config.GEMINI_CHAT_MODEL,
  systemPromptUsed: systemPromptSnapshot,
});
```

### 5.3 — Storage considerations

| Approach | Pros | Cons |
|----------|------|------|
| **Base64 in MongoDB document** (current plan) | Simple; single query retrieval; works with existing stack | 16 MB BSON limit; 5 MB audio × 3 turns = ~15 MB encoded — tight |
| **GridFS** | No size limit; native MongoDB; streaming reads | More complex queries; separate bucket management |
| **Object storage (S3/GCS) + URL in document** | Cheapest at scale; unlimited size | External dependency; network latency; needs signed URLs |

**Recommendation for now:** Base64 in document with the existing 5 MB per-turn guard (15 MB total well under 16 MB BSON limit). Add a `maxDuration = 300` on the route. When storage grows past ~50 GB, migrate to GridFS or object storage.

### 5.4 — Future fine-tuning pipeline (out of scope, noted for reference)

```
pressure_test_raw_data (MongoDB)
       │
       ▼
   Export script (runs nightly or on-demand)
       │
       ▼
   JSONL training file:
   { "prompt": systemPrompt + aiPrompt, "response": studentTranscript, "metadata": { level, scores, latency } }
       │
       ▼
   Gemini / Vertex AI fine-tuning job → "Eklan-flavored" model
```

---

## Phase 6 — Implementation Sequence

Each phase is independently deployable. Dependencies flow downward.

### Sprint 1 (Backend Core)

| # | Task | Files | Depends on |
|---|------|-------|-----------|
| 1.1 | Add `pressureTestLevel` to User schema | `src/models/user.ts` | — |
| 1.2 | Update `/pressure-test/chat` with drill-aware prompt | `src/app/api/v1/pressure-test/chat/route.ts` | — |
| 1.3 | Enhanced `/pressure-test/analyze` with qualitative feedback + level progression | `src/app/api/v1/pressure-test/analyze/route.ts` | 1.1 |
| 1.4 | Expand `PressureTestSession` schema (drillId, levelBefore/After, strengths, weaknesses, nextSteps, turnFeedback) | `src/models/pressure-test-session.ts` | — |
| 1.5 | Wire dynamic level from user profile in UI | `src/components/ai/PressureTestDrill.tsx` | 1.1 |

### Sprint 2 (Data & History)

| # | Task | Files | Depends on |
|---|------|-------|-----------|
| 2.1 | Create `PressureTestRawData` model | `src/models/pressure-test-raw-data.ts` | — |
| 2.2 | Write raw data in analyze route | `src/app/api/v1/pressure-test/analyze/route.ts` | 2.1, 1.3 |
| 2.3 | Student session history API | `src/app/api/v1/pressure-test/sessions/route.ts` | 1.4 |
| 2.4 | Update `LessonReview.tsx` with strengths/weaknesses/nextSteps | `src/components/ai/LessonReview.tsx` | 1.3 |

### Sprint 3 (Tutor Review)

| # | Task | Files | Depends on |
|---|------|-------|-----------|
| 3.1 | Tutor student overview API | `src/app/api/v1/tutor/pressure-test/[studentId]/route.ts` | 1.4 |
| 3.2 | Tutor session detail API | `src/app/api/v1/tutor/pressure-test/[studentId]/[sessionId]/route.ts` | 1.4 |
| 3.3 | Tutor UI — pressure test tab on student detail page | `src/app/(tutor)/tutor/students/[id]/page.tsx` | 3.1, 3.2 |

---

## Gemini AI Configuration

### Model selection

| Use case | Model | Why |
|----------|-------|-----|
| **Pressure test chat** (streaming roleplay) | `gemini-2.0-flash` | Fast response, low latency, good for conversational roleplay |
| **Session analysis** (scoring + qualitative feedback) | `gemini-2.0-flash` | Structured JSON output, cost-effective for batch evaluation |
| **Transcription** | `gemini-2.0-flash` | Already used via `/api/v1/ai/transcribe` |

### Prompt strategy by level

| Level range | Vocabulary | Grammar | Pressure behavior |
|------------|------------|---------|-------------------|
| 1–3 | Basic (~500 words), concrete nouns/verbs | Simple present/past, yes/no questions | Patient but firm; repeat if no answer in 3s; accept 1–3 word answers |
| 4–7 | Intermediate (~1500 words), common idioms | Mixed tenses, conditionals, comparatives | Moderate pressure; expect full sentences; mild interruption on 2s pause |
| 8–12 | Upper-intermediate, phrasal verbs, collocations | Complex sentences, passive voice, reported speech | High pressure; topic switches mid-conversation; interrupt on 1.5s pause |
| 13–17 | Advanced, abstract vocabulary, nuance | Subjunctive, inversion, discourse markers | Intense; rapid-fire follow-ups; challenges opinions; expects near-native fluency |
| 18–20 | Near-native, professional/academic register | All structures; focus on register appropriateness | Interview-level intensity; expects 1s responses; penalizes any hesitation |

### Token limits

```typescript
const LEVEL_TOKEN_LIMITS: Record<string, number> = {
  "1-3": 60,      // short, simple prompts
  "4-7": 120,     // moderate length
  "8-12": 180,    // more complex scenarios
  "13-20": 240,   // full scenario setups
};
```

---

## Key Design Decisions

### 1. Why text streaming instead of Live API for pressure test?

The Free Talk uses Gemini's Live API with audio in/out via WebSocket. The Pressure Test intentionally uses **text-only streaming** because:
- Student audio goes through **Speechace** for pronunciation scoring (not possible with Live audio out)
- We need **per-turn latency measurement** (audio → record → transcribe → stream), which the Live API's continuous stream obscures
- The 3-turn structure is discrete, not continuous conversation
- Text streaming is simpler, cheaper, and more reliable

### 2. Why 3 turns?

Short sessions (3 turns) align with the "pressure" concept — intense, focused bursts. This also:
- Keeps audio payload under the 16 MB BSON limit for raw data storage
- Matches the UI's progress bar (1/3, 2/3, 3/3)
- Prevents student fatigue while maintaining urgency

### 3. Level progression: weighted blend

```
progressToNextLevel = accuracy × 0.4
                    + pronunciation × 0.3
                    + confidence × 0.2
                    + speedScore × 0.1

speedScore = max(0, 100 − responseSeconds × 22)
```

Speed is weighted lowest because pronunciation and accuracy are harder to improve and more indicative of true fluency. The 22× multiplier means:
- 0s → 100 (perfect)
- 2s → 56 (acceptable)
- 4.5s → 0 (too slow)

### 4. Tutor access control

Tutors can only view pressure test data for students assigned to them via `TutorAssignment`. The API routes verify this relationship before returning data.

---

## API Contracts

### `POST /api/v1/pressure-test/chat`

**Request:**
```json
{
  "messages": [{ "role": "user|model", "content": "string" }],
  "level": 4,
  "turnNumber": 2,
  "drillId": "abc123",
  "temperature": 0.7,
  "maxTokens": 240
}
```

**Response:** SSE stream
```
data: {"type":"text","data":"What would you"}
data: {"type":"text","data":" say to your boss?"}
data: {"type":"done","data":null}
```

### `POST /api/v1/pressure-test/analyze`

**Request:**
```json
{
  "level": 4,
  "drillId": "abc123",
  "turns": [
    {
      "turnNumber": 1,
      "aiPrompt": "You're late for work. What do you tell your boss?",
      "studentResponseText": "Sorry I am late, the train was delayed",
      "latencyMs": 1800,
      "audioBase64": "base64..."
    }
  ]
}
```

**Response:**
```json
{
  "data": {
    "overallResponseSpeed": 1.8,
    "overallAccuracy": 72,
    "overallPronunciation": 68,
    "overallConfidence": 65,
    "progressToNextLevel": 58,
    "level": 4,
    "levelBefore": 4,
    "levelAfter": 4,
    "strengths": ["Good use of past tense", "Natural apology structure"],
    "weaknesses": ["Slow response on Turn 2", "Mispronounced 'delayed'"],
    "nextSteps": ["Practice workplace excuse scenarios", "Focus on /dɪˈleɪd/ pronunciation"],
    "turnFeedback": [
      { "turnNumber": 1, "feedback": "Good response but took 1.8s", "rating": "adequate" }
    ]
  }
}
```

### `GET /api/v1/pressure-test/sessions`

**Response:**
```json
{
  "data": {
    "sessions": [
      {
        "sessionId": "...",
        "date": "2026-04-16T10:00:00Z",
        "level": 4,
        "levelAfter": 5,
        "drillId": "abc123",
        "scores": { "speed": 1.8, "accuracy": 72, "pronunciation": 68, "confidence": 65 },
        "progressToNextLevel": 78
      }
    ]
  }
}
```

### `GET /api/v1/tutor/pressure-test/[studentId]`

**Response:**
```json
{
  "data": {
    "studentId": "...",
    "currentLevel": 5,
    "totalSessions": 23,
    "averages": { "speed": 2.1, "accuracy": 68, "pronunciation": 71, "confidence": 62 },
    "trends": { "speed": "improving", "accuracy": "stable", "pronunciation": "improving", "confidence": "declining" },
    "sessions": [ "..." ],
    "pagination": { "total": 23, "limit": 20, "offset": 0 }
  }
}
```
