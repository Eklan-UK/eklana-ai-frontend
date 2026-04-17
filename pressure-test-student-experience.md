# Pressure Test — The Student Experience

## What the Pressure Test Is

The Pressure Test is a timed, spoken English exercise designed to train the student's brain to **stop translating internally** and respond in English within 1–2 seconds. It simulates a real-world conversation under pressure — like a workplace interaction, a customer service call, or an interview — where hesitation is immediately noticed.

Each session is exactly 3 turns:
- The AI sets a scenario and asks a direct question.
- The student records their spoken response.
- The AI follows up based on what the student said.
- After turn 3, the session is scored automatically.

---

## Step-by-Step: What the Student Experiences

### 1. Drill Selection Page (`/account/practice/ai/pressure-test`)

When the student opens the Pressure Test, they see:

- **Their current level** (shown as a badge, e.g. "Level 4") once they have at least one session completed. Their average response speed is shown next to it.
- **Practice tab** — a list of up to 3 scenario drills they have been assigned. Each card shows the drill title, estimated time (5–7 minutes), and whether it is unlocked.
  - A drill is **unlocked** only if the student has already completed it in Free Talk (status = "completed").
  - Locked drills show a padlock icon and cannot be tapped.
- **History tab** — a list of all their past sessions, expandable to see scores and feedback.

**Why drills are the entry point:** The Pressure Test is not a generic conversation. It uses the roleplay context, vocabulary, and grammar targets from a drill the student already knows, so the pressure comes from speed — not from confusion about the topic.

---

### 2. Opening the Session (`/account/practice/ai/pressure-test/chat?drillId=...`)

When the student taps an unlocked drill:

- The `PressureTestDrill` component mounts.
- It silently fetches the student's `pressureTestLevel` from their profile. This is the difficulty setting for the entire session — the student never sees or changes it directly.
- The component shows the drill title, a progress bar (`1 of 3`), and a greeting message from the AI: "Hello [First Name] 👋 The pressure test is to help you respond naturally in day-to-day conversation. Let's get started."
- Simultaneously, the component makes its first call to the chat API with a hidden `"begin"` message. The AI generates Turn 1 — the opening scenario — and it streams in character by character as if the AI is typing.
- A text-to-speech voice reads both the greeting and the scenario aloud so the student can listen without reading if they prefer.

**What the AI says in Turn 1 (example):**
> "I'm your manager and you were 20 minutes late to the morning briefing. Your colleagues had to wait. Why were you late?"

The AI always sets the full scene in Turn 1 — who it is, the situation, what happened — and ends with a direct question. It keeps this under 50 words so it is easy to absorb quickly.

---

### 3. Recording a Response

After the AI finishes typing (and speaking), the student sees a microphone button at the bottom of the screen.

**Tap to record:**
- The microphone activates and a live waveform appears, visualising the audio level in real time.
- A timer counts up so the student knows how long they have been speaking.
- The system simultaneously runs the Web Speech API in the background to begin capturing a transcript without any server calls.

**Tap to stop:**
- The recording stops.
- A preview row appears with a play button, the duration, and a trash icon.
- The student can play back their recording to hear how they sounded.
- If they are not happy with it, they tap the trash icon and re-record.

**Tap the send button:**
- The component transcribes the audio (Web Speech API result first, then server-side fallback if empty).
- The student's transcribed text appears as a chat bubble on the right side of the screen.
- The system captures `latencyMs` — the number of milliseconds between when the AI finished its message and when the student started recording. This is used in scoring.

---

### 4. Turns 2 and 3

After the student submits their first response:

- The AI's follow-up streams in immediately, reacting to what the student said.
- At higher levels, the AI may challenge the student's answer, ask a harder follow-up question, or switch the topic.
- The progress bar advances (`2 of 3`, then `3 of 3`).
- The student records and submits again.

The 3-turn structure is intentional:
- **Short enough** that it feels manageable and urgent, not exhausting.
- **Long enough** to capture a real conversation arc.
- **Bounded** so the audio payload stays within storage limits.

---

### 5. The Analyzing Screen

After Turn 3 is submitted, the screen transitions to a full-screen overlay:

```
👏
Nice work!
You just completed a Pressure Test

[Eklan logo pulsing]
Analyzing your responses...
```

Behind the scenes, the following happens in parallel:
1. Speechace scores pronunciation for each turn's audio.
2. Gemini reads all three turns together and evaluates accuracy, confidence, and qualitative feedback.
3. The level progression engine decides whether the student moves up or down.
4. The session is saved to the database.

This typically takes 5–15 seconds depending on audio length and API latency.

---

### 6. The Lesson Review

Once analysis completes, the `LessonReview` overlay slides up from the bottom of the screen. It shows:

#### Metric cards

| Metric | What it measures | Shown as |
|--------|-----------------|----------|
| **Response Speed** | Average time between AI finishing and student starting to record | Seconds (e.g. "1.8s") + label ("Strong speed") |
| **Sentence Accuracy** | Gemini evaluation of grammar, relevance, and completeness | Percentage + label ("Strong", "Growing", etc.) |
| **Pronunciation** | Speechace word-level scoring, averaged across turns | Percentage + label |
| **Confidence** | Gemini evaluation of fluency, decisiveness, and low hesitation | Percentage + label |

#### Level card

Shows the student's current level and a progress bar toward the next level. If the level changed during this session, a badge appears:
- **"Level Up! 4 → 5"** (green badge with trophy icon) if the student scored ≥75 on the composite.
- **"Level 4 → 3"** (amber badge) if they scored ≤25.

#### Qualitative feedback

Three collapsible sections with specific, personalised feedback from Gemini:

- **What went well** (green) — 2–3 things the student actually did correctly, referencing their real words.
- **Needs work** (amber) — 2–3 specific areas for improvement.
- **Next steps** (blue) — 2–3 actionable practice recommendations, e.g. "Practice restaurant ordering scenarios" or "Focus on the /dɪˈleɪd/ phoneme."

#### Action buttons

- **Practice Weak Areas** — navigates back to the Pressure Test selection page, History tab open, so the student can immediately review their feedback and choose what to work on next.
- **Done for Today** — returns to the main practice page.

---

### 7. History Tab

The student can return to the Pressure Test page at any time and view the History tab to see all past sessions. Each row shows:

- Date
- Level badge at the time of the session
- Key scores inline: response speed, accuracy, pronunciation
- A level change badge if the level shifted

Tapping a row expands it to show:
- Full score chips for all four metrics
- Progress bar toward the next level
- What went well (strengths)
- Next steps

This allows students to track their improvement over time and revisit feedback from earlier sessions.

---

## How the Level System Affects the Student

The student's level (1–20) is invisible during the session but affects everything:

| Level range | What the student experiences |
|-------------|------------------------------|
| 1–3 | AI speaks slowly and clearly. Short answers are accepted. If the student doesn't respond within 3 seconds, the AI repeats the question gently. |
| 4–7 | AI expects full sentences. A 2-second pause triggers a follow-up question. |
| 8–12 | AI uses idioms and phrasal verbs. Interruptions happen mid-sentence. One-word answers are not accepted. |
| 13–17 | AI switches topics abruptly, uses abstract vocabulary, and challenges opinions immediately. |
| 18–20 | Near-native intensity. The AI expects a response within 1 second and penalises filler words like "um" or "uh." |

The student never has to manually adjust their level. The system automatically moves them up when they perform well and down when they struggle — ensuring the pressure is always calibrated to their actual ability.

---

## What "Pressure" Means in Practice

The core design principle of the Pressure Test is that **discomfort is the point**. The AI is not trying to be helpful or forgiving — it is simulating a real conversational partner who expects a timely, coherent response.

Key design choices that create this effect:
- **Latency is measured** — the moment the AI finishes, a clock starts. Every second of hesitation reduces the speed score.
- **The AI reads the scene aloud** via text-to-speech — the student cannot skip ahead or read at their own pace.
- **Turn count is fixed at 3** — there is no "just one more try." The student must commit to their answer.
- **The recording is visible** — the student can hear themselves before submitting, but they cannot hide from the fact that they said what they said.
- **Feedback is specific** — Gemini references the student's actual words, not generic advice. "You paused 3 seconds before Turn 2" is more useful than "work on fluency."

The goal is that after enough sessions, the student's brain learns to bypass the translation step and respond instinctively — which is what natural English fluency looks like.
