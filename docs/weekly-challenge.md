# Weekly Challenge — Weakness Detection and Challenge Generation

This document describes the weekly challenge feature: how the system analyses a learner's recent drill history to detect weaknesses, generates a personalised challenge set via Gemini, persists it to MongoDB, and serves it through a REST API.

---

## 1. Overview

Once a week the system looks back at everything a learner has practised over the past seven days and asks: *where are they struggling?* It produces a **`WeaknessProfile`** — a ranked list of weakness signals with evidence — and from that profile generates a **`WeeklyChallenge`**: a sequenced set of drill items designed to address the top weaknesses.

Both stages are complete and the API is live at `GET /api/v1/learner/weekly-challenge`.

1. **Weakness aggregation** (complete) — reads `DrillAttempt`, `PronunciationAttempt`, and `FreeTalkAttempt` documents, extracts signals per drill type, and returns a `WeaknessProfile`.
2. **Challenge generation** (complete) — passes the `WeaknessProfile` to Gemini, which produces structured drill content for each weakness, persists the result to MongoDB, and returns a cached document on subsequent requests.

---

## 2. Data flow

```
MongoDB
  ├── DrillAttempt         (completedAt within 7-day window)
  ├── PronunciationAttempt (createdAt within 7-day window)
  └── FreeTalkAttempt      (createdAt within 7-day window)
          │
          ▼
  aggregateWeaknesses()          [weakness-aggregator.ts]
          │
          │  groups DrillAttempts by drill type
          │  runs per-type signal extractors
          │  sorts all signals by severity desc
          │  filters severity > 0 → topWeaknesses
          │
          ▼
  WeaknessProfile
    ├── weaknesses[]       all signals, sorted by severity (includes 0-severity)
    └── topWeaknesses[]    top 3 signals with severity > 0
          │
          ▼
  Gemini challenge generation
          │
          ▼
  WeeklyChallenge
    └── content.drillSequence[]   one ChallengeDrillItem per weakness
```

The 7-day window is `[weekStartDate, weekStartDate + 7 days)`. The caller supplies `weekStartDate`; `aggregateWeaknesses` derives `weekEndDate` internally.

---

## 3. Files

| File | Purpose |
|------|---------|
| `src/domain/challenges/types.ts` | TypeScript interfaces: `WeaknessSignal`, `WeaknessProfile`, `ChallengeDrillItem`, `WeeklyChallenge`; plus `PronunciationGeneratedContent`, `FillBlankGeneratedContent`, `KeyPhrasesGeneratedContent`, `RoleplayGeneratedContent` — `generatedContent` is a discriminated union of these four |
| `src/domain/challenges/weakness-aggregator.ts` | `aggregateWeaknesses(learnerId, weekStartDate)` — queries `DrillAttempt`, `PronunciationAttempt`, and `FreeTalkAttempt` in parallel, extracts per-type signals, returns `WeaknessProfile` |
| `src/domain/challenges/challenge-generator.ts` | `generateWeeklyChallenge(profile)` — calls Gemini with per-type `generatedContent` schemas and hard constraints enforced in the prompt |
| `src/models/weekly-challenge.ts` | Mongoose schema for `WeeklyChallenge`; compound unique index on `(learnerId, weekStartDate)` — one document per learner per week |
| `src/domain/challenges/challenge.repository.ts` | `ChallengeRepository` — `findByLearnerAndWeek`, `upsert`, `updateStatus` |
| `src/domain/challenges/challenge.service.ts` | `ChallengeService.getOrGenerateChallenge` — orchestrates aggregator + generator + repository; returns cached document immediately if `status === 'ready'` |
| `src/app/api/v1/learner/weekly-challenge/route.ts` | `GET /api/v1/learner/weekly-challenge` — Zod-validated `weekStartDate` query param; defaults to most recent Monday |
| `src/domain/challenges/test-aggregator.ts` | Dev script for running the aggregator against the live database and inspecting raw output |
| `src/domain/challenges/test-generator.ts` | Dev script for testing end-to-end: aggregation → Gemini generation |
| `src/domain/challenges/test-service.ts` | Dev script for testing the full service layer (aggregation → generation → persistence) without HTTP |

---

## 4. TypeScript interfaces

### `WeaknessSignal`

```ts
interface WeaknessSignal {
  drillType: string;
  category: 'pronunciation' | 'fluency' | 'vocabulary' | 'grammar';
  severity: number;     // 0–1 (higher = worse)
  evidence: string[];
  label: string;
}
```

| Field | Notes |
|-------|-------|
| `drillType` | The drill type the signal came from (e.g. `'pronunciation'`, `'vocabulary'`, `'roleplay'`) |
| `category` | Broad skill area — used to group signals and pick appropriate challenge drill types |
| `severity` | `1 - score/100`, clamped to `[0, 1]`. A score of 60 → severity 0.4; a score of 40 → severity 0.6 |
| `evidence` | Human-readable strings shown in debug output and eventually surfaced to the learner or tutor |
| `label` | Short display label for the weakness (e.g. `'Fluency'`, `'Vocabulary pronunciation'`) |

---

### `WeaknessProfile`

```ts
interface WeaknessProfile {
  learnerId: Types.ObjectId;
  weekStartDate: Date;
  weaknesses: WeaknessSignal[];
  topWeaknesses: WeaknessSignal[];   // top 3
  generatedAt: Date;
}
```

| Field | Notes |
|-------|-------|
| `learnerId` | The learner this profile belongs to |
| `weekStartDate` | Start of the 7-day window that was analysed |
| `weaknesses` | All signals across all drill types, sorted by `severity` descending |
| `topWeaknesses` | First three entries from `weaknesses` — what challenge generation will act on |
| `generatedAt` | Timestamp from when `aggregateWeaknesses` completed |

---

### `WeeklyChallenge`

```ts
interface WeeklyChallenge {
  learnerId: Types.ObjectId;
  weekStartDate: Date;
  weaknessProfile: WeaknessProfile;
  challengeType: 'structured_drill_sequence';
  content: {
    drillSequence: ChallengeDrillItem[];
    totalEstimatedMinutes: number;
    summaryMessage: string;
  };
  status: 'pending' | 'generating' | 'ready' | 'failed';
  generatedAt?: Date;
  createdAt: Date;
}
```

| Field | Notes |
|-------|-------|
| `weaknessProfile` | The `WeaknessProfile` snapshot that drove generation — kept for auditability |
| `challengeType` | Fixed at `'structured_drill_sequence'` for now; reserved for future variants |
| `content.drillSequence` | One `ChallengeDrillItem` per weakness signal; each contains Gemini-generated instructions and drill content |
| `content.totalEstimatedMinutes` | Sum of `estimatedMinutes` across all items |
| `content.summaryMessage` | Short plain-English summary, e.g. `"This week focus on: fluency, phoneme /θ/, vocabulary"` |
| `status` | Lifecycle state — `pending` on creation, `generating` while Gemini runs, `ready` on success, `failed` on error |
| `generatedAt` | Set only when `status === 'ready'` |

---

### `ChallengeDrillItem`

```ts
interface ChallengeDrillItem {
  drillType: 'pronunciation' | 'fill_blank' | 'key_phrases' | 'roleplay';
  targetWeakness: WeaknessSignal;
  instructions: string;
  generatedContent:
    | PronunciationGeneratedContent
    | FillBlankGeneratedContent
    | KeyPhrasesGeneratedContent
    | RoleplayGeneratedContent;
  estimatedMinutes: number;
}
```

| Field | Notes |
|-------|-------|
| `drillType` | One of the 4 supported challenge drill types; Gemini picks based on `targetWeakness.category` (see section 9) |
| `targetWeakness` | The signal this item is designed to address |
| `instructions` | Gemini-generated description of what the learner should focus on |
| `generatedContent` | Discriminated union of 4 typed interfaces — shape depends on `drillType` (see section 9) |
| `estimatedMinutes` | Gemini estimate of how long this item will take |

---

## 5. How to run the test script

The test script runs `aggregateWeaknesses` against the live database and prints the `WeaknessProfile` as JSON, with debug counters above it.

```bash
npx tsx src/domain/challenges/test-aggregator.ts
```

Requires a `.env` file with a valid `MONGODB_URI`. The script is hardcoded to learner ID `6a0716af6a7703bea04ca6c2` — edit `test-aggregator.ts` to change it.

**Expected output structure:**

```
learnerId         : 6a0716af6a7703bea04ca6c2
weekStartDate     : <ISO date>
weekEndDate       : <ISO date>
---
[debug] total completed attempts for learner : <n>
[debug] earliest completedAt : <ISO date>
[debug] latest completedAt   : <ISO date>
[debug] attempts within 7-day window        : <n>
[debug] raw attempts: [ ... ]
---
[debug] linked PronunciationAttempts (with drillAttemptId): <n>
{
  "learnerId": "...",
  "weekStartDate": "...",
  "weaknesses": [ ... ],
  "topWeaknesses": [ ... ],
  "generatedAt": "..."
}
```

---

## 6. generatedContent schemas and constraints

`ChallengeDrillItem.generatedContent` is a discriminated union typed to the drill type. Gemini is instructed to use these exact shapes; the hard constraints are enforced in the prompt.

### `pronunciation`

```ts
{
  pronunciation_items: Array<{
    word: string;
    sentence: string;
    sound?: string;        // IPA phoneme, e.g. "/θ/"
    wordAudioUrl?: string;
    sentenceAudioUrl?: string;
  }>;
}
```

### `fill_blank`

```ts
{
  fill_blank_items: Array<{
    sentence: string;      // contains ___ for each blank
    blanks: Array<{
      position: number;    // 0-based index
      correctAnswer: string;
      options: string[];
      hint?: string;
    }>;
    translation?: string;
    audioUrl?: string;
  }>;
}
```

### `key_phrases`

```ts
{
  key_phrase_items: Array<{
    prompt: string;
    options: string[];
    correctAnswer: string;      // must exactly match one element of options[]
    respondentName?: string;
    promptAudioUrl?: string;
  }>;
}
```

### `roleplay`

```ts
{
  student_character_name: string;
  ai_character_names: string[];
  context?: string;
  drill_intro?: string;
  roleplay_scenes: Array<{
    scene_name?: string;
    context?: string;
    dialogue: Array<{
      speaker: string;    // "student" or "ai_0", "ai_1" — never a character name
      text: string;
      translation?: string;
      audioUrl?: string;
    }>;
  }>;
}
```

### Hard constraints

| Drill type | Constraint |
|------------|-----------|
| `fill_blank` | `sentence` must contain exactly as many `___` as entries in `blanks[]` |
| `key_phrases` | `correctAnswer` must be a string that exactly matches one element of `options[]` |
| `roleplay` | `speaker` must be `"student"` or `"ai_<n>"` where `n` is a 0-based index into `ai_character_names[]` — never the character's name |
| `pronunciation` | `sound` should be an IPA phoneme (e.g. `"/θ/"`) not a plain description |

### Category → drill type mapping

| Weakness category | Chosen drill type |
|-------------------|------------------|
| `pronunciation` | `pronunciation` or `key_phrases` |
| `fluency` | `roleplay` |
| `vocabulary` | `fill_blank` or `key_phrases` |
| `grammar` | `fill_blank` |

---

## 7. Known limitations

**Drill types that produce no weakness signal**

`sentence`, `summary`, and `listening` drill attempts are fetched as part of the `DrillAttempt` query but no signal extractor exists for them. They are silently skipped in `inferDrillType` / the `byType` grouping. If a learner only practised these types in the window, `weaknesses` will be empty.

**Backfill script loops on orphaned documents**

The backfill script loops indefinitely on orphaned `DrillAttempt` documents (those where no matching `Drill` document exists, so `drillType` is set to `null`). On each iteration the query filter matches them again since `null` satisfies the `$or` condition. The script needs an explicit exit condition when all remaining documents resolve to `null`.

**`PronunciationAttempt` has no link to `DrillAttempt`**

`PronunciationAttempt` documents do not carry a `drillAttemptId` field in the database. The aggregator queries them by `learnerId` + date window only. This means pronunciation signals reflect all pronunciation activity in the window, not just activity tied to a specific drill attempt. Cross-referencing the two collections is not currently possible without a schema change.

**FreeTalk signals with severity 0 are excluded from topWeaknesses**

A `FreeTalkAttempt` where every graded behaviour is `'full'` produces a signal with `severity: 0`. These are retained in `weaknesses[]` for auditability but filtered out of `topWeaknesses[]`, so they will not drive challenge generation.

**Only 4 drill types supported for challenge generation**

`generateWeeklyChallenge` only produces content for `pronunciation`, `fill_blank`, `key_phrases`, and `roleplay`. Weaknesses from other drill types (e.g. `grammar`, `vocabulary`, `matching`) will be detected and included in `WeaknessProfile` but Gemini is not yet instructed on how to generate content for them.

---

## 8. What's coming next

The backend pipeline is complete end-to-end. Remaining work:

1. **Frontend integration** — UI surface in the My Practice section that fetches `GET /api/v1/learner/weekly-challenge`, renders the `drillSequence`, and tracks completion per item.
2. **Full integration testing in staging** — run against real learner data to verify the Gemini prompt produces correctly shaped `generatedContent` across all four drill types.
3. **Error handling hardening** — surface `status: 'failed'` gracefully in the UI; consider a retry mechanism on the service layer for transient Gemini failures.
4. **Latency measurement** — instrument `getOrGenerateChallenge` to record aggregation time, Gemini response time, and total wall time; establish a p95 baseline before connecting the frontend.

---

## 9. Sample output

Real output from 2026-06-04 against learner `6a0716af6a7703bea04ca6c2`. Note the `free_talk` signal in `weaknesses[]` with `severity: 0` — it is present but correctly excluded from `topWeaknesses`.

**WeaknessProfile**

```json
{
  "learnerId": "6a0716af6a7703bea04ca6c2",
  "weekStartDate": "2026-05-27T23:00:00.000Z",
  "weaknesses": [
    {
      "drillType": "pronunciation",
      "category": "pronunciation",
      "severity": 0.33333333333333326,
      "evidence": [
        "Average pronunciation score: 66.7",
        "Weak phonemes: t, r, n, v, er"
      ],
      "label": "Pronunciation — phonemes: t, r, n, v, er"
    },
    {
      "drillType": "pronunciation",
      "category": "fluency",
      "severity": 0.33333333333333326,
      "evidence": [
        "Average fluency score: 66.7"
      ],
      "label": "Fluency"
    },
    {
      "drillType": "free_talk",
      "category": "fluency",
      "severity": 0,
      "evidence": [
        "Responds naturally in conversation",
        "Maintains conversational flow",
        "Uses clear and understandable communication"
      ],
      "label": "Clinical communication — small_talk_colleague"
    }
  ],
  "topWeaknesses": [
    {
      "drillType": "pronunciation",
      "category": "pronunciation",
      "severity": 0.33333333333333326,
      "evidence": [
        "Average pronunciation score: 66.7",
        "Weak phonemes: t, r, n, v, er"
      ],
      "label": "Pronunciation — phonemes: t, r, n, v, er"
    },
    {
      "drillType": "pronunciation",
      "category": "fluency",
      "severity": 0.33333333333333326,
      "evidence": [
        "Average fluency score: 66.7"
      ],
      "label": "Fluency"
    }
  ],
  "generatedAt": "2026-06-04T19:45:48.291Z"
}
```

**WeeklyChallenge content**

```json
{
  "drillSequence": [
    {
      "drillType": "pronunciation",
      "targetWeakness": {
        "drillType": "pronunciation",
        "category": "pronunciation",
        "severity": 0.33333333333333326,
        "evidence": [
          "Average pronunciation score: 66.7",
          "Weak phonemes: t, r, n, v, er"
        ],
        "label": "Pronunciation — phonemes: t, r, n, v, er"
      },
      "instructions": "Focus on clear pronunciation of the phonemes /t/, /r/, /n/, /v/, and the 'er' sound. Pay attention to tongue and lip placement for each sound.",
      "generatedContent": {
        "pronunciation_items": [
          {
            "word": "Tachycardia",
            "sentence": "The patient presents with a rapid heart rate, known as tachycardia.",
            "sound": "/t/"
          },
          {
            "word": "Respiratory",
            "sentence": "We need to assess the patient's respiratory rate and effort.",
            "sound": "/r/"
          },
          {
            "word": "Nausea",
            "sentence": "The patient reports feeling nauseous and has not kept down fluids.",
            "sound": "/n/"
          },
          {
            "word": "Vital signs",
            "sentence": "Please take the patient's vital signs, including temperature, pulse, respiration, and blood pressure.",
            "sound": "/v/"
          },
          {
            "word": "Fever",
            "sentence": "The patient's temperature is elevated, indicating a fever.",
            "sound": "/ər/"
          }
        ]
      },
      "estimatedMinutes": 5
    },
    {
      "drillType": "roleplay",
      "targetWeakness": {
        "drillType": "pronunciation",
        "category": "fluency",
        "severity": 0.33333333333333326,
        "evidence": [
          "Average fluency score: 66.7"
        ],
        "label": "Fluency"
      },
      "instructions": "Practice speaking at a steady pace, using natural pauses. Focus on connecting your thoughts smoothly and reducing hesitations.",
      "generatedContent": {
        "student_character_name": "Nurse",
        "ai_character_names": ["Patient"],
        "context": "You are a nurse checking in on a patient who has just had surgery. The patient is recovering and you need to assess their pain level and comfort.",
        "roleplay_scenes": [
          {
            "scene_name": "Post-operative Check-in",
            "dialogue": [
              { "speaker": "student", "text": "Good morning, Mr. Smith. I'm here to check on you after your procedure. How are you feeling today?" },
              { "speaker": "ai_0",   "text": "Morning, nurse. I'm a bit sore, but I think the pain medication is starting to work." },
              { "speaker": "student", "text": "That's good to hear. Can you describe the pain for me? On a scale of 0 to 10, with 10 being the worst pain imaginable, what would you rate it right now?" },
              { "speaker": "ai_0",   "text": "I'd say it's around a 4 or 5. It's mostly a dull ache." },
              { "speaker": "student", "text": "Okay, a 4 or 5. And where exactly is the pain located?" },
              { "speaker": "ai_0",   "text": "It's right here, in my abdomen, where they made the incision." },
              { "speaker": "student", "text": "Thank you for that information. I'll make a note of it. Are you experiencing any other discomfort, like nausea or dizziness?" },
              { "speaker": "ai_0",   "text": "No, not really. Just the soreness." },
              { "speaker": "student", "text": "Alright. I'll let the doctor know your current pain level. We can adjust your medication if needed. Is there anything else I can get for you at this moment?" }
            ]
          }
        ]
      },
      "estimatedMinutes": 7
    }
  ],
  "totalEstimatedMinutes": 12,
  "summaryMessage": "This week focus on: pronunciation of phonemes t, r, n, v, er, and fluency."
}
```
