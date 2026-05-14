# Pronunciation Drill — Formation, Flow, and Calculations

This document describes the **pronunciation** drill type (`type: "pronunciation"`): how content is defined, what the learner does step by step, how Speechace is used, what is stored on completion, and how it ties into analytics and streaks.

---

## 1. Purpose

The pronunciation drill is a **speaking / listening** exercise. For each **item**, the learner:

1. Practices a **target word** (and optional **sound focus** label from the author).
2. After passing a pronunciation threshold on the word, practices a **full sentence** that uses that word in context.

Unlike **vocabulary** drills (which use `target_sentences` and may include translations and sentence-from-book context), the pronunciation drill uses a dedicated array **`pronunciation_items`** with explicit **`sound`**, **`word`**, and **`sentence`** fields per row.

---

## 2. How the drill is formed (authoring and schema)

### 2.1 Drill document fields

On the `Drill` model (`src/models/drill.ts`), pronunciation drills use:

- `type: "pronunciation"`.
- `pronunciation_items`: array of items (`PronunciationItemSchema`).

Each item supports:

| Field | Schema / API | Role |
|--------|----------------|------|
| `sound` | String (API: **required** non-empty on create) | **Pedagogical label** (e.g. phoneme, “/θ/”, “silent b”). Shown in the UI as “Sound focus: …” when non-empty. |
| `word` | String (required on create) | Text used for the **Word** step: display, TTS reference, Speechace reference, bookmarks. |
| `sentence` | String (required on create) | Full sentence for the **Sentence** step. |
| `soundAudioUrl` | Optional | Pre-generated TTS URL for the sound (stored on drill; **not** wired to the learner `TTSButton` in `PronunciationDrill.tsx` today). |
| `wordAudioUrl` | Optional | Pre-generated TTS for the **word** step. |
| `sentenceAudioUrl` | Optional | Pre-generated TTS for the **sentence** step. |

### 2.2 API validation when creating a drill

`POST /api/v1/drills` uses Zod (`src/app/api/v1/drills/route.ts`):

- If `type === "pronunciation"`, **`pronunciation_items` must exist and have length ≥ 1**.
- Each item must have **`sound`**, **`word`**, and **`sentence`** all **trimmed and at least one character** (`pronunciationItemSchema`).

So authors **must** fill all three strings for the API to accept the drill. (The learner app only **scores** `word` and `sentence`; `sound` is contextual text.)

### 2.3 Assignments

Learners practice via a **DrillAssignment**; the practice UI receives `drill` JSON and `assignmentId` for the final **`POST /api/v1/drills/:drillId/complete`** call.

---

## 3. How the drill is supposed to go (learner UX)

Implementation: **`src/components/drills/PronunciationDrill.tsx`**, selected from **`DrillPracticeInterface`** when `drill.type === "pronunciation"`.

### 3.1 Item list

```ts
items = drill.pronunciation_items || []
```

Progress shows **current item index + 1** vs **`items.length`**.

If there are no items, the UI shows: **“No pronunciation items found in this drill.”**

### 3.2 Two screens per item (same pattern as vocabulary)

For each item index, the learner alternates:

- **`word`** — “Pronounce the Word”
- **`sentence`** — “Pronounce the Sentence” (locked until the word step passes)

**Sound focus (display only):**  
If `currentItem.sound` is non-empty after trim, a line appears: **“Sound focus: {sound}”**. This does **not** change the string sent to Speechace on the word step (see §4.1).

### 3.3 Listen → record → analyze

1. **Listen:** `TTSButton` uses **`currentText`**:
   - Word screen: `currentWord = item.word.trim()` (or empty string if missing — empty would be a bad drill).
   - Sentence screen: `item.sentence.trim()`.
   - Optional `audioUrl`: `wordAudioUrl` on word screen, `sentenceAudioUrl` on sentence screen. **`soundAudioUrl` is not passed** to this button in the current component.

2. **Record:** Same floating mic dock as vocabulary: **WebM/Opus**, **120 s** max, timer ring, preview bar, discard, submit for analysis.

3. **Speechace:** Client calls **`speechaceService.scorePronunciation(referenceText, audioBlob)`** → internal **`POST /api/v1/speechace/score`** with the learner’s session.

4. **Pass threshold:** **`PASS_THRESHOLD = 65`** (hardcoded).  
   `passed = (textScore.speechace_score.pronunciation >= 65)`.

5. **Feedback:** Toast on pass/fail; **`DrillLineReviewAccordion`** shows the latest `TextScore` breakdown for the current turn.

6. **Standalone pronunciation log:** After a successful Speechace parse, the client calls **`pronunciationAPI.createDrillAttempt`** → **`POST /api/v1/pronunciations/drill-attempt`** with `drillType: 'pronunciation'`, `text` (same reference as scoring), `audioBase64`, `drillId`, `passingThreshold: 65`.  
   The server (`PronunciationService.createDrillPronunciationAttempt`) uploads audio to Cloudinary, runs Speechace again server-side, and stores a **`PronunciationAttempt`** row for analytics. Failures here are **logged only** — they do not block the drill UI.

### 3.4 Transcript (pronunciation-specific UX)

On each successful analysis, the client appends/updates **`sessionTranscripts`**: expected string + **`transcriptFromTextScore(textScore)`** (joins `word_score_list[].word` or falls back to `textScore.text`). This is shown on the **completion screen** under **“What we heard from your recordings”** so the learner can compare target vs recognized words.

### 3.5 Navigation

- **Continue to Sentence:** requires `wordPassed`.
- **Next item / Complete drill:** requires **both** `wordPassed` and `sentencePassed`.
- **Back to Word** from sentence step (clears current score/recording).
- **Previous item** when `currentIndex > 0` and on word screen.

### 3.6 Review performance → submit

After the last item passes both steps, **`showReview`** opens **`DrillPerformanceReview`** (same “item-by-item” pattern as vocabulary: `sessionReviewAnalytics` grouped by `sceneIndex` = item index, `turnIndex` 0 = word, 1 = sentence).

- **Done** → **`handleSubmit`** (§5).
- **Practice again** → resets all indices, progress, analytics, transcripts, recordings.

### 3.7 Completion screen

`DrillCompletionScreen` with `drillType="pronunciation"` and optional **transcript summary** card from `sessionTranscripts`.

---

## 4. What Speechace receives (reference text)

| Screen | `textToAnalyze` sent to Speechace |
|--------|-----------------------------------|
| Word | `currentItem.word.trim()` (or `""` if missing) |
| Sentence | `currentItem.sentence.trim()` (or `""` if missing) |

The **`sound`** field is **not** used as the reference transcript for scoring. Authors should put the **actual grapheme/word** learners must say in **`word`**, and use **`sound`** only as a teaching label (phoneme, tip, etc.).

---

## 5. What is calculated (scores and payloads)

### 5.1 Overall drill `score` (submitted to complete API)

Same formula as **vocabulary**:

```text
totalItems = pronunciation_items.length
passedItems = count(progress entries where wordPassed && sentencePassed)
score = round((passedItems / totalItems) * 100)
```

So the **stored drill score** is the **percentage of items fully completed** (word + sentence each reached ≥ 65% at least once), **not** the average Speechace percentage across all tries.

### 5.2 `pronunciationResults.wordScores` (per item, on `DrillAttempt`)

For each `pronunciation_items[index]`:

| Field | Meaning |
|--------|---------|
| `word` | `row.word.trim()` or fallback `` `Item ${index + 1}` `` if word empty |
| `score` | If both word and sentence passed: `round((wordScore + sentenceScore) / 2)`; else **0** |
| `attempts` | Always **1** in current client (not incremented per retry) |
| `pronunciationScore` | Same as `score` (duplicate for consumers that read `pronunciationScore`) |

These are written under **`pronunciationResults`**, **not** `vocabularyResults`.

### 5.3 `timeSpent`

Seconds from component mount to submit: `floor((Date.now() - startTime) / 1000)`.

### 5.4 `performanceReviewSnapshot`

Same structure as vocabulary: `version: 1`, `ui: "drillPerformance"`, `avgScore`, `statsLine`, `passThreshold: 65`, `groups` (serialized review groups for replay in admin/tutor tooling).

### 5.5 Review aggregates (client-only until submit)

- **`reviewAvgScore`:** mean of all `sessionReviewAnalytics[].score` if present; else mean of `(wordScore + sentenceScore) / 2` for items with both scores.
- **`reviewStatsLine`:** e.g. `X of N items passed · M scored attempts`.

---

## 6. Backend: completing the drill

**`POST /api/v1/drills/:drillId/complete`** accepts optional **`pronunciationResults`** with the same `wordScores` shape as in the Zod schema (`complete/route.ts`).

**`DrillService.completeDrill`** persists the attempt, marks the assignment **completed**, notifies the tutor, and the route triggers (fire-and-forget):

- `computeConfidenceMetrics(learnerId)`
- `computePronunciationMetrics(learnerId)`

### 6.1 Pronunciation profile aggregation

`computePronunciationMetrics` (`src/domain/pronunciation/pronunciation.service.ts`) loads attempts that have **`vocabularyResults.wordScores`**, **`pronunciationResults.wordScores`**, or **`roleplayResults.sceneScores`**. For each pronunciation drill row it uses `pronunciationScore ?? score` when **> 0** to build a rolling **overall pronunciation** metric stored on the learner pronunciation document (history, etc.).

So pronunciation drill completions **feed the same “overall pronunciation” pipeline** as vocabulary and roleplay, via **`pronunciationResults`**.

### 6.2 Streak

In `complete/route.ts`, if `score >= 70` and role is `user`, **`StreakService.recordActivityDay`** runs with that score. Passing **all** items yields **100**; partial completion yields a lower percentage and may fall below 70.

---

## 7. Comparison: pronunciation vs vocabulary drill

| Aspect | Pronunciation | Vocabulary |
|--------|----------------|------------|
| Content array | `pronunciation_items` | `target_sentences` |
| Word step reference | `item.word` | `word` or first token of `text` |
| Sentence step reference | `item.sentence` | `item.text` |
| Translations in UI | No built-in word/sentence translation fields on items | `wordTranslation`, `translation` |
| Sound label | Optional `sound` line above word | N/A |
| Complete payload field | `pronunciationResults` | `vocabularyResults` |
| Analytics / profile | `pronunciationResults.wordScores` | `vocabularyResults.wordScores` |

The **interaction pattern** (two-step lock, 65% threshold, recording dock, Speechace, drill-attempt logging, performance review, completion formula) is intentionally parallel.

---

## 8. Edge cases and implementation notes

- **Empty `word` or `sentence` on an item:** Should not happen for API-created drills; if present, Speechace gets `""` and the UX degrades.
- **`sound` only:** Still need real **`word`** text for scoring and TTS; API forbids empty `word` on create.
- **`soundAudioUrl`:** Stored but not used by the current learner `TTSButton` wiring; authors relying on pre-generated sound clips would need a UI change to expose it.
- **Double Speechace work:** The browser calls Speechace for immediate UI; **`createDrillAttempt`** runs Speechace again on the server for the pronunciation-attempt record — small cost/consistency tradeoff.
- **`attempts: 1`:** Same as vocabulary; retry count is better reflected in `performanceReviewSnapshot` / analytics rows (`attempts` per turn in session review state).

---

## 9. File map

| Concern | Location |
|---------|----------|
| Drill schema (`pronunciation_items`) | `src/models/drill.ts` |
| Create-drill Zod | `src/app/api/v1/drills/route.ts` |
| Learner UI | `src/components/drills/PronunciationDrill.tsx` |
| Router | `src/components/drills/DrillPracticeInterface.tsx` |
| Transcript helper | `src/components/drills/shared/speechaceTranscript.ts` |
| Client Speechace wrapper | `src/services/speechace.service.ts` |
| Complete API | `src/app/api/v1/drills/[drillId]/complete/route.ts` |
| Attempt schema | `src/models/drill-attempt.ts` (`pronunciationResults`) |
| Standalone drill pronunciation attempts | `src/app/api/v1/pronunciations/drill-attempt/route.ts`, `src/domain/pronunciations/pronunciation.service.ts` |
| Overall pronunciation metrics | `src/domain/pronunciation/pronunciation.service.ts` |
| Completed-attempt UI (word scores) | `src/components/drills/SpeakingPracticeAttemptDetails.tsx` |

This is the full picture of how a **pronunciation** drill is formed, how it is **supposed to run**, and what the app **calculates and stores**.
