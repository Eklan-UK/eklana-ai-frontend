# Vocabulary Drill — Formation, Flow, and Calculations

This document describes the **vocabulary** drill type (`type: "vocabulary"`) in the Eklana frontend and backend: how content is authored, how the learner experience works, what gets scored, and what is persisted.

---

## 1. Purpose of the drill

The vocabulary drill trains **spoken pronunciation** of a **target word** in isolation, then the **full sentence** that contains that word. It is **not** a multiple-choice or typing drill; it is **listen → record → Speechace analysis → pass/fail per step**.

Pedagogical intent:

- Anchor the learner on the **word** (form + sound).
- Generalize to **fluent sentence production** with the same word in context.
- Give **immediate machine feedback** (pronunciation percentage) before the learner can advance.

---

## 2. How the drill is formed (authoring & data model)

### 2.1 Drill type and storage

On the `Drill` document (`src/models/drill.ts`), a vocabulary drill has:

- `type: "vocabulary"`.
- `target_sentences`: an **array** of items. Each item is one “vocabulary unit” the learner will practice in sequence.

### 2.2 Shape of each `target_sentences[]` entry

| Field | Role |
|--------|------|
| `word` | Primary vocabulary token (used for the **Word** screen and bookmarks). If empty, the UI falls back to the **first token** of `text.split(" ")[0]`. |
| `wordTranslation` | Optional meaning of the word (shown on the word step). |
| `text` | **Required** full sentence the learner pronounces on the **Sentence** step. |
| `translation` | Optional sentence translation (shown on the sentence step). |
| `wordAudioUrl` | Optional pre-generated TTS URL for the word (Cloudinary). |
| `sentenceAudioUrl` | Optional pre-generated TTS URL for the full sentence. |

The Mongoose schema marks `text` as required for every row; authors typically fill `word` explicitly for clarity.

### 2.3 How authors create drills

Admins and tutors use the drill builder (`src/app/(admin)/admin/drills/create/...`, tutor equivalent). For vocabulary they maintain a list of rows with word, word translation, sentence text, and sentence translation. On submit, the API validates and persists `target_sentences` (see `src/app/api/v1/drills/route.ts` — `targetSentenceSchema` and `createDrillSchema`).

Optional **TTS** can be generated server-side for words/sentences (`drill-audio.service.ts` patterns) and stored in `wordAudioUrl` / `sentenceAudioUrl` so the learner hears a reference pronunciation without hitting live TTS every time.

### 2.4 Assignments

Learners receive drills through **DrillAssignment** records. Practice UI receives `drill` JSON plus `assignmentId` (used only when **completing** the drill).

---

## 3. How the drill is supposed to go (learner UX)

Implementation: `src/components/drills/VocabularyDrill.tsx`, rendered from `DrillPracticeInterface` when `drill.type === "vocabulary"`.

### 3.1 Progress model

- **Items:** one card per `target_sentences[index]`; `DrillProgress` shows “current / total”.
- **Per item, two screens:** `word` → then `sentence` (the sentence screen stays **locked** until the word step passes).

### 3.2 Word screen

1. Show heading **“Pronounce the Word”** and the string used for practice: `word` or first word of `text`.
2. Optional `wordTranslation` under the heading.
3. **Listen:** `TTSButton` with `text = currentWord` and optional `wordAudioUrl`.
4. **Record:** learner uses the floating mic dock (WebM/Opus, max **120 seconds** per recording; auto-stop with toast).
5. After stop, learner can preview audio, discard, or **submit** for analysis.
6. **Speechace** (`speechaceService.scorePronunciation`) sends audio + **reference text**:
   - On word screen, reference text = `currentSentence.word || currentSentence.text.split(" ")[0]`.
7. Response is parsed for `textScore` (Speechace `speechace_score.pronunciation` is the scalar used).
8. **Pass threshold:** `PASS_THRESHOLD = 65` (hardcoded). `passed = pronunciation >= 65`.
9. On success: toast with score; on failure: toast asking to retry.
10. **Side effect:** after a successful parse, the client calls `pronunciationAPI.createDrillAttempt` → `POST /api/v1/pronunciations/drill-attempt` with `drillType: "vocabulary"`, text, audio base64, `passingThreshold: 65`. This creates a **standalone pronunciation attempt** for analytics/history (separate from the final `DrillAttempt`).

### 3.3 Moving to the sentence screen

- Button **“Continue to Sentence”** is disabled until `wordPassed`.
- If the learner tries early, they see a toast: must pass word pronunciation **65%+** first.

### 3.4 Sentence screen

Same pattern as the word screen, but:

- Heading **“Pronounce the Sentence”**.
- Reference text for Speechace = **`currentSentence.text`** (full sentence).
- Optional `translation` and `sentenceAudioUrl` on `TTSButton`.

### 3.5 Navigation between items

- **“Next Item”** (or **“Complete Drill”** on the last item) requires **both** `wordPassed` and `sentencePassed` for the current index.
- **“Back to Word”** on the sentence screen resets the sentence UI state for rework.
- **“Previous Item”** (on first screen only, when `currentIndex > 0`) goes to the previous vocabulary item and resets to the word screen.

### 3.6 End-of-drill review and submit

When the learner finishes the **last** item with both passes:

1. `showReview = true` → **DrillPerformanceReview** screen.
2. It shows **item-by-item** groups built from `sessionReviewAnalytics`: each successful Speechace run stored a row with `sceneIndex` (= vocabulary item index), `turnIndex` 0 = word / 1 = sentence, `score`, full `textScore`, and `attempts` count (last attempt overwrites per turn).

From review the learner can:

- **Practice again** → resets all indices, progress, analytics, recordings.
- **Done** → calls `handleSubmit` (see §4).

---

## 4. What is being calculated (scores & payloads)

### 4.1 Per-item live metrics (client only until submit)

For each index `i`, `wordProgress[i]` holds:

- `wordPassed`, `wordScore` (0–100 from Speechace pronunciation),
- `sentencePassed`, `sentenceScore`.

These are updated only when Speechace returns a valid `textScore`.

### 4.2 Review screen aggregates (client)

- **`reviewAvgScore`:** mean of all `sessionReviewAnalytics[].score` if any; else mean of `(wordScore + sentenceScore) / 2` over items where both scores exist.
- **`reviewStatsLine`:** human string, e.g. `X of N items passed · M scored attempts` (passed = both word and sentence passed; `M` = number of analytics rows).

### 4.3 Final drill score (submitted to `POST /api/v1/drills/:drillId/complete`)

```text
totalItems = target_sentences.length
passedItems = count(wordProgress entries where wordPassed && sentencePassed)
score = round((passedItems / totalItems) * 100)
```

So the **stored drill score** is **not** the average Speechace percentage. It is the **percentage of vocabulary items fully completed** (word + sentence both ≥ 65% at least once each).

### 4.4 `vocabularyResults.wordScores` (per word row on attempt)

For each `target_sentences[i]` the client builds one `wordScores` entry:

| Field | Value |
|--------|--------|
| `word` | `sentence.word \|\| sentence.text.split(" ")[0]` |
| `score` | If both passed: `round((wordScore + sentenceScore) / 2)`; else **0** |
| `attempts` | Always **1** in current client (not incremented per retry) |
| `pronunciationScore` | Same as `score` (duplicate for legacy readers) |

So each row’s `score` is the **average of the best word and sentence Speechace scores** for that item, **or 0** if either side never passed.

### 4.5 `timeSpent`

`floor((Date.now() - startTime) / 1000)` from mount of `VocabularyDrill` to submit — **wall clock** for the whole session (including retries and review).

### 4.6 `performanceReviewSnapshot`

Structured JSON (version `1`, UI `drillPerformance`) with `avgScore`, `statsLine`, `passThreshold: 65`, `groups` copied from the review UI state — stored on the **DrillAttempt** for tutors/admins to replay the same breakdown later.

### 4.7 Backend persistence (`DrillService.completeDrill`)

The complete route validates the body (`src/app/api/v1/drills/[drillId]/complete/route.ts`) and `DrillService` writes a **DrillAttempt** with `vocabularyResults`, `score`, `timeSpent`, `performanceReviewSnapshot`, marks the assignment **completed**, and notifies the tutor.

### 4.8 Downstream: pronunciation profile metrics

After completion, the API handler **fire-and-forget** calls `computePronunciationMetrics(learnerId)`. The pronunciation service aggregates attempts that have `vocabularyResults.wordScores` among other drill types (`src/domain/pronunciation/pronunciation.service.ts`), so vocabulary drill outcomes feed **longitudinal pronunciation** views.

### 4.9 Streak

If `score >= 70` and the user role is `user`, `StreakService.recordActivityDay` is invoked with that score (`complete/route.ts`). A learner who completes all items but with **lower per-item averages** might still get **100** completion score (all items passed) and thus streak credit; a learner who passes only some items gets a lower completion score.

---

## 5. External dependencies

- **Speechace** (via `POST /api/v1/speechace/score`): provides `speechace_score.pronunciation` and rich `textScore` (word-level phone scores, etc.) for the accordion UI (`DrillLineReviewAccordion`).
- **Microphone** capture in the browser (MediaRecorder, WebM/Opus).

---

## 6. Edge cases & constraints

- **Empty `target_sentences`:** UI shows “No vocabulary items found in this drill.”
- **Missing assignment ID:** completion toast error; submit blocked.
- **Speechace failure:** no `textScore` → error toast; progress not updated.
- **Retries:** learner can re-record until pass; analytics row for that `(sceneIndex, turnIndex)` is **replaced** with the latest score and incremented `attempts`.
- **`attempts: 1` in `wordScores`:** does not reflect retry count; true per-turn attempt counts live in `performanceReviewSnapshot` / analytics rows.

---

## 7. File map (quick reference)

| Concern | Location |
|---------|----------|
| Drill schema (`target_sentences`) | `src/models/drill.ts` |
| Learner UI | `src/components/drills/VocabularyDrill.tsx` |
| Drill router | `src/components/drills/DrillPracticeInterface.tsx` |
| Complete API + Zod schema | `src/app/api/v1/drills/[drillId]/complete/route.ts` |
| Persist attempt + assignment | `src/domain/drills/drill.service.ts` |
| Attempt schema (`vocabularyResults`) | `src/models/drill-attempt.ts` |
| Speechace client | `src/services/speechace.service.ts` |
| Standalone pronunciation logging | `POST /api/v1/pronunciations/drill-attempt`, `src/domain/pronunciations/pronunciation.service.ts` |

This is the full picture of how a vocabulary drill is **formed**, how it is **supposed to run**, and what the app **calculates and stores**.
