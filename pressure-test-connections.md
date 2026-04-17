# Pressure Test — How Everything Connects

## The Three Participants

| Role | What they do |
|------|-------------|
| **Student** | Takes the pressure test — records spoken responses, receives real-time AI prompts, gets scored |
| **Tutor** | Reviews student performance — sees aggregate stats, session history, per-turn feedback |
| **Admin** | Has access to everything tutors can see, plus raw data export for training pipelines |

---

## End-to-End Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           STUDENT                                    │
│                                                                      │
│  1. Opens /account/practice/ai/pressure-test                        │
│     └── sees their assigned scenario drills                         │
│     └── sees level badge + average speed if they have history       │
│                                                                      │
│  2. Selects a completed drill → navigates to /chat?drillId=...      │
│     └── PressureTestDrill.tsx loads                                 │
│     └── fetches their pressureTestLevel from /api/v1/users/current  │
│                                                                      │
│  3. AI streams the opening scenario (Turn 1)                        │
│     └── POST /api/v1/pressure-test/chat → Gemini SSE               │
│     └── system prompt includes the drill's roleplay context         │
│                                                                      │
│  4. Student records their spoken response                           │
│     └── MediaRecorder captures audio/webm                          │
│     └── Web Speech API transcribes in parallel                      │
│     └── Latency (ms since AI finished) is captured                 │
│                                                                      │
│  5. Student submits → Turn 2 AI reply streams                       │
│     └── POST /api/v1/pressure-test/chat (with history)             │
│                                                                      │
│  6. After Turn 3 is submitted → analyze route fires                 │
│     └── POST /api/v1/pressure-test/analyze                         │
│           ├── Speechace scores pronunciation per word               │
│           ├── Gemini scores accuracy + confidence                   │
│           ├── Level progression engine runs                         │
│           ├── PressureTestSession saved to MongoDB                  │
│           └── PressureTestRawData saved (audio + full detail)       │
│                                                                      │
│  7. LessonReview overlay shows:                                     │
│     └── Speed, accuracy, pronunciation, confidence scores          │
│     └── Level badge (Level Up / Level Down if changed)             │
│     └── Strengths, weaknesses, next steps                          │
│     └── Progress bar toward next level                             │
│                                                                      │
│  8. Student can view all past sessions on the History tab           │
│     └── GET /api/v1/pressure-test/sessions                         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                            TUTOR                                     │
│                                                                      │
│  1. Opens /tutor/students/[id]                                      │
│     └── Pressure Test tab shows student overview                   │
│                                                                      │
│  2. Sees aggregate stats                                            │
│     └── GET /api/v1/tutor/pressure-test/[studentId]                │
│           ├── currentLevel                                          │
│           ├── totalSessions                                         │
│           ├── averages (speed, accuracy, pronunciation, confidence)  │
│           ├── trends (improving / stable / declining per metric)    │
│           └── paginated session list                                │
│                                                                      │
│  3. Clicks a session for full detail                                │
│     └── GET /api/v1/tutor/pressure-test/[studentId]/[sessionId]    │
│           ├── all turn transcripts (AI prompt + student response)   │
│           ├── per-turn rating (strong / adequate / needs_work)      │
│           ├── per-turn feedback sentence                            │
│           └── strengths, weaknesses, next steps                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                            ADMIN                                     │
│                                                                      │
│  1. Can access all tutor routes (role check allows admin)          │
│  2. POST /api/v1/admin/pressure-test/export                        │
│     └── exports raw session data for model fine-tuning pipelines   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## How the Drill Connects to the Session

The pressure test is not a generic conversation — it is anchored to a specific drill the student already completed during Free Talk. This linkage flows through the entire system:

```
Drill (MongoDB)
  ├── roleplay_scenes   ─────┐
  ├── target_sentences  ─────┼──► buildSystemPrompt() ──► Gemini system instruction
  ├── target_vocabulary ─────┤       (chat/route.ts)
  ├── grammar_focus     ─────┘
  └── _id ─────────────────────────► drillId stored on PressureTestSession + RawData
```

**On the student side:** The drill selection page only shows scenario-type drills with `status === "completed"`. Incomplete or non-scenario drills are shown as locked.

**On the AI side:** When the drill is loaded, the system prompt gets enriched with the drill's specific content. If the drill fetch fails, the chat route falls back to a generic scenario using only the level behavior.

**On the data side:** `drillId` is indexed on `pressure_test_sessions` and `pressure_test_raw_data`, allowing future queries like "show all sessions for drill X" or "average score per drill."

---

## How Evaluation Works

### Step 1 — Pronunciation (Speechace)

Each turn's audio and transcript are sent to Speechace independently (fan-out with `Promise.allSettled`). Speechace returns:
- An overall `text_score` for the turn (0–100)
- Word-level scores with quality tags: `correct`, `mispronounced`, `missing`

If Speechace fails for a turn, that turn scores 0 for pronunciation and the rest of the session continues.

### Step 2 — Qualitative Evaluation (Gemini)

All three turns are sent together in one Gemini prompt that includes:
- The AI prompt text for each turn
- The student's transcribed response for each turn
- Response latency in milliseconds

Gemini returns structured JSON:
```json
{
  "accuracy": 72,
  "confidence": 65,
  "strengths": ["used correct past tense", "natural apology phrasing"],
  "weaknesses": ["long pause before Turn 2", "incomplete sentence in Turn 3"],
  "nextSteps": ["practice workplace scenarios", "focus on /dɪˈleɪd/ pronunciation"],
  "turnFeedback": [
    { "turnNumber": 1, "feedback": "Clear and direct.", "rating": "strong" },
    { "turnNumber": 2, "feedback": "Hesitated 3 seconds before responding.", "rating": "needs_work" },
    { "turnNumber": 3, "feedback": "Good attempt but sentence was incomplete.", "rating": "adequate" }
  ]
}
```

If the Gemini evaluation fails, the system falls back to neutral scores (50/50) with generic feedback so the session still completes.

### Step 3 — Composite Score + Level Decision

```
progressToNextLevel = accuracy×0.40 + pronunciation×0.30 + confidence×0.20 + speedScore×0.10

speedScore = max(0, 100 − responseSpeedSeconds × 22)
```

| Result | Condition |
|--------|-----------|
| Level Up (+1, max 20) | progressToNextLevel ≥ 75 |
| Level Down (−1, min 1) | progressToNextLevel ≤ 25 |
| No change | 26–74 |

---

## How the Level System Connects Everything

The `pressureTestLevel` field on the User model is the central thread that connects sessions over time:

```
User.pressureTestLevel
        │
        ├──► Read on session start (PressureTestDrill.tsx → /api/v1/users/current)
        │         └── determines AI difficulty, vocabulary range, interruption behavior
        │
        ├──► Read at analysis time (analyze/route.ts → User.findById)
        │         └── stored as levelBefore on the session document
        │
        ├──► Updated after analysis (User.findByIdAndUpdate)
        │         └── only writes if level actually changed
        │
        └──► Stored as levelAfter on the session document
                  └── tutors and students can see the full level history per session
```

---

## How the Tutor Sees Student Progress

Tutors only see data for students **assigned to them** via `TutorAssignment`. The route verifies this relationship before returning any data — a tutor cannot query an unassigned student.

What a tutor can see:

| View | Data |
|------|------|
| Student overview | Current level, total sessions, average scores across all sessions, trend direction per metric (last 5 vs previous 5) |
| Session list | Date, level at time of session, all four scores, whether level changed |
| Session detail | Full turn-by-turn transcript, per-turn feedback and rating, strengths/weaknesses/next steps |

Tutors **cannot** see the raw audio — that lives only in `pressure_test_raw_data`, which is an admin-only collection for data sovereignty purposes.

---

## Data Sovereignty Pipeline

Every completed session writes two documents:

| Document | Purpose | Who accesses it |
|----------|---------|-----------------|
| `PressureTestSession` | Scored results for student + tutor review | Student, Tutor, Admin |
| `PressureTestRawData` | Full audio + word-level scores + system prompt snapshot | Admin only (future fine-tuning) |

The raw data document includes `geminiModelUsed` and `systemPromptUsed` so that future fine-tuning jobs know exactly what context the model was operating under when it generated each prompt.

**Future pipeline (not yet active):**
```
pressure_test_raw_data
        │
        ▼
   Export script (nightly or on-demand via admin route)
        │
        ▼
   JSONL training file: { prompt, response, metadata }
        │
        ▼
   Gemini / Vertex AI fine-tuning → Eklan-flavoured model
```

---

## Why Text Streaming Instead of Live API

The Free Talk feature uses Gemini's Live API with bidirectional audio. The Pressure Test intentionally uses text-only SSE streaming for three reasons:

1. **Speechace integration** — Pronunciation scoring requires sending the audio to Speechace. This is not possible in a Live API audio-out flow where Gemini generates speech directly.
2. **Per-turn latency measurement** — The system measures how long the student takes to respond after the AI finishes. The discrete turn structure (AI done → student records → submit) makes this precise. A continuous Live stream would obscure this.
3. **3-turn structure** — Each session is exactly 3 turns: a defined beginning and end. SSE fits this naturally; the Live API's persistent connection is designed for open-ended conversation.
