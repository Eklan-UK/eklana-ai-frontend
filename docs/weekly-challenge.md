# Weekly Challenge — Weakness Detection and Challenge Generation

This document describes the weekly challenge feature: how the system analyses a learner's recent drill history to detect weaknesses, and how that profile will be used to generate a personalised challenge set for the coming week.

---

## 1. Overview

Once a week the system looks back at everything a learner has practised over the past seven days and asks: *where are they struggling?* It produces a **`WeaknessProfile`** — a ranked list of weakness signals with evidence — and from that profile it will generate a **`WeeklyChallenge`**: a sequenced set of drill items designed to address the top weaknesses.

The feature has two stages:

1. **Weakness aggregation** (complete) — reads `DrillAttempt` and `PronunciationAttempt` documents, extracts signals per drill type, and returns a `WeaknessProfile`.
2. **Challenge generation** (complete) — passes the `WeaknessProfile` to Gemini, which produces structured drill content for each weakness.

---

## 2. Data flow

```
MongoDB
  ├── DrillAttempt      (completedAt within 7-day window)
  └── PronunciationAttempt  (createdAt within 7-day window)
          │
          ▼
  aggregateWeaknesses()          [weakness-aggregator.ts]
          │
          │  groups attempts by drill type
          │  runs per-type signal extractors
          │  sorts signals by severity desc
          │
          ▼
  WeaknessProfile
    ├── weaknesses[]       all signals, sorted by severity
    └── topWeaknesses[]    top 3 signals
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
| `src/domain/challenges/types.ts` | TypeScript interfaces: `WeaknessSignal`, `WeaknessProfile`, `ChallengeDrillItem`, `WeeklyChallenge` |
| `src/domain/challenges/weakness-aggregator.ts` | `aggregateWeaknesses(learnerId, weekStartDate)` — queries MongoDB, extracts per-type signals, returns `WeaknessProfile` |
| `src/domain/challenges/challenge-generator.ts` | `generateWeeklyChallenge(profile)` — calls Gemini to generate a structured drill sequence from a `WeaknessProfile` |
| `src/domain/challenges/test-aggregator.ts` | Dev script for running the aggregator against the live database and inspecting raw output |
| `src/domain/challenges/test-generator.ts` | Dev script for testing end-to-end: aggregation → Gemini generation |

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
  drillType: string;
  targetWeakness: WeaknessSignal;
  instructions: string;
  generatedContent: Record<string, unknown>;
  estimatedMinutes: number;
}
```

| Field | Notes |
|-------|-------|
| `drillType` | One of the 12 drill types; chosen by Gemini to match `targetWeakness.category` |
| `targetWeakness` | The signal this item is designed to address |
| `instructions` | Gemini-generated description of what the learner should focus on |
| `generatedContent` | Gemini-generated drill content matching the schema of an existing drill type |
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

## 6. Known limitations

**Drill types that produce no weakness signal**

`sentence`, `summary`, and `listening` drill attempts are fetched as part of the `DrillAttempt` query but no signal extractor exists for them. They are silently skipped in `inferDrillType` / the `byType` grouping. If a learner only practised these types in the window, `weaknesses` will be empty.

**Backfill script loops on orphaned documents**

The backfill script loops indefinitely on orphaned `DrillAttempt` documents (those where no matching `Drill` document exists, so `drillType` is set to `null`). On each iteration the query filter matches them again since `null` satisfies the `$or` condition. The script needs an explicit exit condition when all remaining documents resolve to `null`.

**`PronunciationAttempt` has no link to `DrillAttempt`**

`PronunciationAttempt` documents do not carry a `drillAttemptId` field in the database. The aggregator queries them by `learnerId` + date window only. This means pronunciation signals reflect all pronunciation activity in the window, not just activity tied to a specific drill attempt. Cross-referencing the two collections is not currently possible without a schema change.

---

## 7. What's coming next

Weakness aggregation and Gemini challenge generation are both complete. The remaining steps to make this feature live are:

1. **Mongoose model** — a `WeeklyChallenge` collection to persist generated challenges, keyed by `(learnerId, weekStartDate)`.
2. **API route** — a learner-facing endpoint (e.g. `GET /api/v1/learner/weekly-challenge`) that runs aggregation + generation on demand (or returns a cached document if one already exists for the current week).
3. **Frontend integration** — a UI surface on the learner dashboard or My Plan screen that displays the weekly challenge drill sequence and tracks completion.

---

## 8. Sample output

Real output from 2026-06-04 against learner `6a0716af6a7703bea04ca6c2`.

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
  "generatedAt": "2026-06-04T14:38:15.356Z"
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
      "instructions": "Practice saying the following medical terms clearly, paying close attention to the 't', 'r', 'n', 'v', and 'er' sounds. Repeat each word after the audio.",
      "generatedContent": {
        "audio_content": [
          { "text": "patient",      "audio_file": "patient.mp3" },
          { "text": "transfer",     "audio_file": "transfer.mp3" },
          { "text": "nutrition",    "audio_file": "nutrition.mp3" },
          { "text": "vital signs",  "audio_file": "vital_signs.mp3" },
          { "text": "fever",        "audio_file": "fever.mp3" },
          { "text": "intravenous",  "audio_file": "intravenous.mp3" },
          { "text": "respiratory",  "audio_file": "respiratory.mp3" },
          { "text": "monitoring",   "audio_file": "monitoring.mp3" },
          { "text": "ventilation",  "audio_file": "ventilation.mp3" },
          { "text": "temperature",  "audio_file": "temperature.mp3" }
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
      "instructions": "You are a nurse speaking with a patient about their upcoming procedure. Speak clearly and at a natural pace. The patient will ask clarifying questions. Respond calmly and provide reassurance.",
      "generatedContent": {
        "scenario": "You are Nurse Sarah. A patient, Mr. Chen, is anxious about an upcoming MRI scan. He has a fear of enclosed spaces.",
        "dialogue": [
          { "speaker": "Nurse Sarah", "line": "Good morning, Mr. Chen. I'm Nurse Sarah, and I'll be talking with you today about your upcoming MRI scan." },
          { "speaker": "Mr. Chen",    "line": "Oh, the MRI... I'm a bit worried about that. I don't like being in small spaces." },
          { "speaker": "Nurse Sarah", "line": "I understand your concern, Mr. Chen. It's quite common for patients to feel a bit apprehensive. Let me explain what will happen." },
          { "speaker": "Mr. Chen",    "line": "Will I be completely closed in? It sounds very tight." },
          { "speaker": "Nurse Sarah", "line": "The MRI machine is a tube, but it's not as narrow as it may seem. We can also offer you some strategies to help you feel more comfortable. We have music you can listen to, and you'll be able to communicate with the technician at all times." },
          { "speaker": "Mr. Chen",    "line": "So, I can talk to them if I get scared?" },
          { "speaker": "Nurse Sarah", "line": "Absolutely. There's a microphone, and you'll have a call button. If at any point you feel overwhelmed, you can let the technician know, and we can pause the scan. We want you to feel as safe and comfortable as possible." },
          { "speaker": "Mr. Chen",    "line": "That's... a little reassuring. Will it take a long time?" },
          { "speaker": "Nurse Sarah", "line": "The actual scanning time varies depending on what we are looking at, but typically it's between 30 to 60 minutes. We'll make sure you're prepared before we begin." }
        ]
      },
      "estimatedMinutes": 7
    }
  ],
  "totalEstimatedMinutes": 12,
  "summaryMessage": "This week, focus on: pronunciation of 't', 'r', 'n', 'v', 'er' sounds and improving overall fluency in patient communication."
}
```
