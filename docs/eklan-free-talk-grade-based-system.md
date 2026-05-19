# Eklan Free Talk — Grade-Based System Implementation

## Overview

This document specifies the redesign of Eklan Free Talk from a multi-turn conversational roleplay into a single-response grading system.

**Before:** AI streams a conversational greeting → student has a back-and-forth dialogue → scenario ends after 5+ turns.

**After:** Student receives the full situation + hint upfront → clicks "Got it" → submits one response (voice or text) → AI grades the response against a rubric and returns a structured result.

---

## 1. New UX Flow

```
Page loads
  │
  ▼
GET /greeting → returns scenario data (title, situation, hint, usefulPhrases)
  │
  ▼
Situation Card shown (full-screen/prominent)
  ├── Scenario title
  ├── Full situation text
  ├── Hint (what the student should cover)
  ├── Useful phrases (collapsible)
  └── [Got it] button
  │
  ▼ (user clicks "Got it")
  │
Input enabled (Hold to speak / Type)
  │
  ▼
Student submits ONE response
  │
  ▼
"Grading your response…" loading state (POST /free-talk)
  │
  ▼
Grade Result Screen
  ├── Overall score (e.g. 71%)
  ├── Competency level badge (e.g. "Developing Communicator")
  ├── Behaviour checklist (7 rows: ✓ / ~ / ✗ + points)
  ├── Narrative feedback (streamed)
  └── [Try another scenario] button
```

---

## 2. Competency Scale

| Score     | Competency Level              |
|-----------|-------------------------------|
| 90–100%   | Advanced Clinical Communicator |
| 80–89%    | Safe & Effective Communicator  |
| 70–79%    | Developing Communicator        |
| 60–69%    | Need Improvement               |
| Below 60% | Unsafe Communication Risk      |

---

## 3. API Contract Changes

### 3a. `GET /api/v1/ai/free-talk/greeting` — Simplified to JSON

**Before:** Calls the Live API, streams conversational scenario introduction as SSE with audio.

**After:** Picks the next scenario (round-robin), returns plain JSON immediately. No Live API call.

**Response shape:**
```json
{
  "success": true,
  "scenario": {
    "title": "Sudden Oxygen Drop",
    "situation": "Mr. Miller's oxygen saturation suddenly drops from 96% to 82%...",
    "hint": "Calm the patient. Explain what is happening. Call for help if necessary.",
    "usefulPhrases": ["Stay calm.", "Your oxygen level is dropping.", "..."],
    "scenarioType": "icu_emergency"
  }
}
```

**scenarioType values** (maps to grading rubric):
- `icu_emergency` — ICU Emergency / Critical Situation
- `admission` — Admission / Introduction
- `small_talk_patient` — Small Talk with Patient
- `handover` — Nurse-to-Nurse Handover
- `decline_request` — Declining a Request
- `phone_doctor` — Phone Communication with Doctor
- `small_talk_colleague` — Small Talk with Colleague

All existing scenarios in `FREE_TALK_SCENARIOS` are `icu_emergency`.

---

### 3b. `POST /api/v1/ai/free-talk` — Grading Mode

**Before:** Multi-turn continuation, streams AI conversational reply + audio.

**After:** Single-shot grading. Receives one student response, evaluates it, streams narrative feedback text + ends with a `metadata` chunk containing the structured grade.

**Request body:**
```json
{
  "userResponse": "Mr. Miller, please stay calm...",
  "scenarioTitle": "Sudden Oxygen Drop"
}
```

**SSE stream output:**
- `text` chunks — streamed narrative feedback (same SSE format as today)
- `metadata` chunk — structured grade result

**Metadata shape:**
```json
{
  "type": "metadata",
  "data": {
    "fullText": "...",
    "grade": {
      "overallScore": 71,
      "competencyLevel": "Developing Communicator",
      "behaviours": [
        {
          "id": 1,
          "name": "Recognizes patient deterioration quickly",
          "result": "full",
          "score": 1.0
        },
        {
          "id": 2,
          "name": "Provides immediate appropriate intervention",
          "result": "partial",
          "score": 0.5
        },
        {
          "id": 3,
          "name": "Uses calm and reassuring communication",
          "result": "full",
          "score": 1.0
        },
        {
          "id": 4,
          "name": "Gives clear patient instructions",
          "result": "none",
          "score": 0
        },
        {
          "id": 5,
          "name": "Escalates appropriately and promptly",
          "result": "partial",
          "score": 0.5
        },
        {
          "id": 6,
          "name": "Uses professional ICU terminology",
          "result": "full",
          "score": 1.0
        },
        {
          "id": 7,
          "name": "Maintains organized and safe communication",
          "result": "full",
          "score": 1.0
        }
      ],
      "rawScore": 5.0,
      "maxScore": 7
    }
  }
}
```

Score formula: `overallScore = (rawScore / 7) * 100`

---

## 4. Grading Rubric by Scenario Type

All behaviours are scored: `full` (1pt) / `partial` (0.5pt) / `none` (0pt).

### ICU Emergency / Critical Situation (`icu_emergency`)

| # | Observable Behaviour | What AI Evaluates |
|---|---------------------|-------------------|
| 1 | Recognizes patient deterioration quickly | Identifies emergency signs (low SpO2, chest pain, respiratory distress, hypotension, confusion) without delay |
| 2 | Provides immediate appropriate intervention | Initiates correct first actions (increase O2, monitor vitals, position patient, assess symptoms) |
| 3 | Uses calm and reassuring communication | Speaks calmly, reduces patient anxiety, maintains emotional control |
| 4 | Gives clear patient instructions | Short, direct instructions: "Take slow deep breaths", "Please stay still" |
| 5 | Escalates appropriately and promptly | Calls doctor, RT, rapid response team without unnecessary delay |
| 6 | Uses professional ICU terminology | Correctly uses: oxygen saturation, blood pressure, respiratory distress, etc. |
| 7 | Maintains organized and safe communication | Clear under pressure, prioritizes safety, avoids panic |

*(Rubrics for the remaining 6 scenario types are defined in `Eklan_free_talk_&_pressure_test_grading_system.md` and will be added to the scenario data as more scenario types are introduced.)*

---

## 5. Backend Changes

### 5a. `src/app/api/v1/ai/free-talk/greeting/route.ts`

- Remove: Live API stream call + SSE response
- Add: Pick scenario → return JSON response
- Keep: `withPremium` guard, DB user lookup (for future personalization)

### 5b. `src/app/api/v1/ai/free-talk/route.ts`

- Remove: `conversationHistory`, `activeScenarioTitle` from request (no longer needed)
- Add: `userResponse` + `scenarioTitle` to request body
- Remove: call to `generateFreeTalkResponseStream`
- Add: call to new `generateFreeTalkGradingStream(userResponse, scenario, userName)`
- Keep: SSE response headers, `withPremium` guard

### 5c. `src/services/gemini.service.ts`

**Remove / retire:**
- `buildFreeTalkGreetingPrompt` — no longer called
- `buildFreeTalkContinuationPrompt` — no longer called
- `isNewScenarioIntroTurn` — no longer needed
- `generateFreeTalkGreetingStream` — replaced by JSON endpoint
- `generateFreeTalkResponseStream` — replaced by grading stream
- `wrapWithFreeTalkMetadata` — reuse for grading stream

**Add:**
- `GRADING_RUBRICS` — map of `scenarioType → behaviours[]`
- `buildFreeTalkGradingPrompt(scenario, userResponse, userName)` — see §6
- `generateFreeTalkGradingStream(userResponse, scenario, userName)` — uses **text API** (not Live API), streams narrative + structured JSON grade

**Note:** The grading response uses the standard Gemini text/chat model (not the Live API), since grading is a structured evaluation task, not real-time audio roleplay.

---

## 6. Grading Prompt

```
You are Eklan, an ICU clinical communication evaluator.

Scenario: {scenario.title}
Situation: {scenario.situation}

The student responded with:
"{userResponse}"

Evaluate this response against the 7 clinical communication behaviours below.
For each behaviour, output a rating:
- "full"    → clearly and confidently demonstrated (1 point)
- "partial" → mentioned or implied but incomplete/weak (0.5 points)  
- "none"    → absent, incorrect, or unsafe (0 points)

Behaviours:
{behaviours.map((b, i) => `${i+1}. ${b.name}: ${b.description}`).join('\n')}

After evaluating, write 2–4 sentences of warm, constructive narrative feedback:
- Acknowledge what the student did well.
- Point out what was missing or could be improved.
- Keep the tone supportive and educational.

Then output the word GRADE_JSON followed immediately by a valid JSON object on a new line:
{
  "behaviours": [
    { "id": 1, "result": "full"|"partial"|"none" },
    ...
  ]
}

Respond in English only.
```

The `wrapWithFreeTalkMetadata` transform strips `GRADE_JSON {...}` from the text stream and places the parsed data in the `metadata` chunk.

---

## 7. Frontend Changes

### 7a. `src/app/(student)/account/practice/free-talk/page.tsx`

**State changes (remove):**
- `rows` (chat list) — replaced by situation card + result view
- `conversationHistory`, `activeScenarioTitle` refs
- `showContinueModal`, `pendingNextTitle/Hint/Phrases`
- `streamingAudio`, `isThinking` (replaced by `isGrading`)

**State additions:**
- `scenario: FreeTalkScenario | null` — loaded from GET /greeting
- `phase: "loading" | "ready" | "responding" | "grading" | "result"` — drives the UI
- `gradeResult: GradeResult | null` — structured grade from metadata

**Component flow by phase:**
- `loading` — "Preparing your scenario…" spinner
- `ready` — full Situation Card (title, situation, hint, useful phrases, "Got it" CTA). User has NOT yet seen the input.
- `responding` — input bar visible (hold-to-speak / type). Situation card collapses to a small banner at top showing just the scenario title.
- `grading` — "Grading your response…" with animated indicator
- `result` — GradeResultCard component + "Try another scenario" button

**Voice flow in responding phase:**
- Hold-to-speak: transcribe via `/api/v1/ai/transcribe` → auto-submit (no manual send needed)
- Text: type + send → submit

**Try another scenario:**
- Calls `GET /greeting` again (new scenario picked server-side)
- Resets to `phase = "ready"` with new scenario

### 7b. New sub-components (inline in page or separate files)

**`SituationCard`** — displays scenario title, situation text, hint, useful phrases list, "Got it" button.

**`GradeResultCard`** — displays:
- Circular/ring score indicator showing percentage
- Competency level badge (color-coded by tier)
- 7-row behaviour checklist (icon + name + partial indicator)
- Narrative feedback (rendered with `MarkdownText`)
- "Try another scenario" primary button

### 7c. `src/services/ai.service.ts`

**Remove:**
- `streamFreeTalkGreeting` (was SSE; now GET /greeting is plain JSON)
- `streamFreeTalkMessage`

**Add:**
- `fetchFreeTalkScenario(): Promise<FreeTalkScenario>` — GET /greeting, returns JSON
- `streamFreeTalkGrading(options: { userResponse, scenarioTitle, signal }, onChunk)` — POST /free-talk, SSE stream

---

## 8. Scenario Data Update

Add `scenarioType` field to `FreeTalkScenario` interface and to each scenario entry in `FREE_TALK_SCENARIOS`. All current scenarios are `icu_emergency`.

```ts
interface FreeTalkScenario {
  title: string;
  situation: string;
  hint: string;
  usefulPhrases: string[];
  scenarioType: 'icu_emergency' | 'admission' | 'small_talk_patient' | 'handover' | 'decline_request' | 'phone_doctor' | 'small_talk_colleague';
}
```

---

## 9. Files Changed

| File | Change |
|------|--------|
| `src/app/api/v1/ai/free-talk/greeting/route.ts` | Return JSON scenario data; remove SSE/Live API |
| `src/app/api/v1/ai/free-talk/route.ts` | Accept `userResponse` + `scenarioTitle`; call grading stream |
| `src/services/gemini.service.ts` | Add `GRADING_RUBRICS`, `buildFreeTalkGradingPrompt`, `generateFreeTalkGradingStream`; retire old free-talk functions |
| `src/app/(student)/account/practice/free-talk/page.tsx` | Full rewrite — phase-based UI, situation card, grade result |
| `src/services/ai.service.ts` | Replace free-talk methods with `fetchFreeTalkScenario` + `streamFreeTalkGrading` |

---

## 10. What Does NOT Change

- Pro subscription gate (`learnerHasProAccess` + redirect to subscriptions)
- `withPremium` middleware on both routes
- `transcribeAudio` / `/api/v1/ai/transcribe` endpoint (voice → text still needed)
- SSE stream format (`data: { type, data }\n\n`)
- `_processSSEStream` in `ai.service.ts`
- `MarkdownText` component
- `AudioStreamPlayer` is no longer needed for Free Talk (no TTS in grading mode)
- Leave session modal behaviour
