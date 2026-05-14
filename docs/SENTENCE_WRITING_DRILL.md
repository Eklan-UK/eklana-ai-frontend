# Sentence Writing Drill — Formation, Flow, and Calculations

This document describes **sentence writing** drills (`type: "sentence_writing"`) and the related legacy **`sentence`** type. Both use the same learner component (`SentenceDrill.tsx`). The drill is **written**, not spoken: learners produce a **definition** and **two sentences** per target word; scoring is **human review**, not automatic.

---

## 1. Drill types covered

| `type` | Primary content field | Notes |
|--------|------------------------|--------|
| `sentence_writing` | `sentence_writing_items[]` | Multiple words; each has `word`, optional `hint`, optional `audioUrl`. |
| `sentence` | `sentence_drill_word` (+ optional `sentence_drill_audio_url`) | Single target word; legacy shape. |

The UI also has a **fallback**: if neither of the above is present, it derives words from `target_sentences` entries that have a `word` field (`getWordItems` in `SentenceDrill.tsx`).

---

## 2. How the drill is formed (authoring & data model)

### 2.1 `sentence_writing_items` (main shape)

Defined in `src/models/drill.ts` (`SentenceWritingItemSchema`):

| Field | Required | Purpose |
|--------|----------|---------|
| `word` | Yes | The lemma or token the learner must define and use in sentences. |
| `hint` | No | Short author guidance (shown in a highlighted “Hint” callout). |
| `audioUrl` | No | Pre-generated TTS for the word (optional listen button). |

Authors add one or more rows in the admin/tutor drill builder. Validation on create requires **at least one** item with a non-empty `word` (`sentence_writing` branch in create page).

### 2.2 Optional drill-level `context`

`Drill.context` is a free-text string. If set, the learner sees it at the top in a card **before** the target word — scenario instructions, theme, or register guidance.

### 2.3 Legacy `sentence` fields

Some drills store:

- `sentence_drill_word`: single string.
- `sentence_drill_audio_url`: optional TTS URL.

The learner flow is identical to a one-item `sentence_writing_items` list.

### 2.4 Assignments

Same as other drills: **DrillAssignment** links learner to drill; `assignmentId` is required to call the complete API.

---

## 3. How the drill is supposed to go (learner UX)

Implementation: `src/components/drills/SentenceDrill.tsx` (also used when `drill.type === "sentence"` via `DrillPracticeInterface`).

### 3.1 Word list resolution

`getWordItems(drill)` builds an ordered array of `{ word, hint?, audioUrl? }`:

1. Prefer `sentence_writing_items`.
2. Else if `sentence_drill_word` → single synthetic item.
3. Else map `target_sentences` with non-empty `word`.

If the result is empty → **“No words found”** error state.

### 3.2 Per-word flow (multi-page wizard)

For each word index `0 .. totalWords-1` the learner sees:

1. **Target word card**  
   - Large `word`, optional `TTSButton` + `BookmarkButton`.  
   - Optional hint.  
   - Subtext: “Provide definition and two sentences”.

2. **Definition** (`Textarea`)  
   - Placeholder: define the word.  
   - Character count shown (no max enforced in UI).

3. **Sentence 1** (`Textarea`)  
   - Placeholder: write a sentence **using** the word.

4. **Sentence 2** (`Textarea`)  
   - Placeholder: write **another** sentence using the word.

### 3.3 Validation gates

- **Current word complete:** all three fields must be **non-empty after trim**.
- **Primary action:**  
  - If not last word → **Next** (increments index, scrolls to top).  
  - If last word → **`handleSubmit`** (see §4).
- **Submit guard:** `allWordsComplete` — every word index must have all three fields non-empty; otherwise toast and jump to first incomplete word.

There is **no** spell checker, grammar checker, or keyword-in-sentence validator in the client: any non-empty string satisfies gating.

### 3.4 Completion screen

After successful API response:

- `DrillCompletionScreen` with title **“Drill Submitted”** and copy that the submission is **pending review** (not instant scored feedback).

---

## 4. What is being calculated (payloads, scores, review)

### 4.1 Payload: `sentenceResults` (on `POST /api/v1/drills/:drillId/complete`)

Built in `SentenceDrill.handleSubmit`:

**Multi-word shape (`words`):**

```ts
words: wordItems.map((item, idx) => ({
  word: item.word,
  definition: answers[idx].definition.trim(),
  sentences: [
    { text: answers[idx].sentence1.trim(), index: 0 },
    { text: answers[idx].sentence2.trim(), index: 1 },
  ],
}))
```

**Legacy flat fields** (backwards compatibility for older consumers):

- `word`, `definition`, `sentences` — duplicated from **word index 0** only.

**Metadata:**

- `reviewStatus: "pending"` — signals that **no numeric score is final** until a reviewer acts.

### 4.2 `score` on completion request

The client sends **`score: 0`** with an inline comment that the score **will be calculated after review**. The complete API still requires `score` in `0..100`; zero is valid.

So immediately after submit:

- **DrillAttempt.score** may be **0** until review.
- **Assignment** is still marked completed (learner finished their obligation to submit).

### 4.3 `timeSpent`

Same pattern as vocabulary: seconds from `SentenceDrill` mount to submit — entire multi-word session.

### 4.4 What is **not** calculated on submit

- No cosine similarity, no LLM grader, no binary “word used in sentence” check in this path.
- **`sentenceWritingResults`** (legacy schema with `sentencesWritten`, `accuracy`, etc.) is **not** populated by `SentenceDrill` today; that block appears in completed-attempt UI only for old data.

### 4.5 Human review and **post-hoc score** (`AttemptReviewService`)

Reviewers (admin/tutor flows) call the review API (`src/app/api/v1/drills/attempts/[attemptId]/review/route.ts` → `reviewSentenceAttempt` in `src/domain/attempts/attempt-review.service.ts`):

1. Loads attempt; ensures drill `type` is **`sentence`** or **`sentence_writing`**.
2. Requires `sentenceResults` on the attempt.
3. Accepts an array of **`SentenceReview`**: `{ sentenceIndex, isCorrect, correctedText? }`.
4. Computes:

```text
correctCount = number of reviews where isCorrect === true
totalSentences = reviews.length
score = round((correctCount / totalSentences) * 100)
```

5. Persists `sentenceResults.reviewStatus = "reviewed"`, `sentenceResults.sentenceReviews` (with `reviewedAt`, `reviewedBy`), and **overwrites `attemptDoc.score`** with the formula above.

**Important:** `sentenceIndex` is a **global index across all words**: for word 0, sentences are indices `0` and `1`; for word 1, indices `2` and `3`; etc. The student completed-attempt page computes this with `getGlobalIndex(wordIdx, sentenceIdx)` (`src/app/(student)/account/drills/[id]/completed/page.tsx`). Review UIs must align with the same indexing when submitting reviews.

### 4.6 Definition field in review scoring

The **`definition`** text is stored on the attempt but **reviewSentenceAttempt** only counts **`reviews.length`** in the denominator — in typical flows the reviewer submits **one review per sentence** (two per word), not per definition. If a product decision wanted definitions graded, the API would need extra review rows or a separate field; the current service code scores **only the sentence reviews array length** supplied by the caller.

### 4.7 Streak and downstream metrics

- **Streak** (`complete/route.ts`): `recordActivityDay` runs when `score >= 70`. For sentence writing, **initial score is 0**, so streak credit typically arrives **after** a tutor/admin review sets a high enough score (if the client re-calls completion or a separate path updates score — today review updates the attempt document directly; streak may **not** re-fire unless another mechanism records activity). Worth treating streak coupling as **implementation detail** that may favor auto-scored drills unless review also triggers streak.
- **Confidence metrics** still run `computeConfidenceMetrics` after complete; sentence-specific confidence rules depend on that service.
- **Pronunciation metrics** are unrelated to this drill path (no Speechace).

---

## 5. Persistence model (`DrillAttempt`)

From `src/models/drill-attempt.ts`, relevant fields:

**`sentenceResults`:**

- `word`, `definition`, `sentences` — legacy single-word mirror.
- `words[]` — optional multi-word structure (preferred for new data).
- `reviewStatus`: `'pending' | 'reviewed'`.
- `sentenceReviews[]`: per-sentence adjudication with `sentenceIndex`, `isCorrect`, optional `correctedText`, `reviewedAt`, `reviewedBy`.

**`sentenceWritingResults`** (legacy):

- Used by older flows / analytics cards; not set by current `SentenceDrill` submit.

---

## 6. API contract summary

| Step | Endpoint | Body highlights |
|------|----------|-----------------|
| Complete drill | `POST /api/v1/drills/:drillId/complete` | `drillAssignmentId`, `score` (0 at submit), `timeSpent`, `sentenceResults` (with `words`, `reviewStatus: "pending"`), `platform` |
| Review (staff) | `POST .../attempts/:attemptId/review` | Reviews with global `sentenceIndex`; sets final `score` |

Zod schema for `sentenceResults` in `complete/route.ts` allows optional `words[]` alongside legacy `word` / `definition` / `sentences`.

---

## 7. Edge cases

- **Missing `assignmentId`:** cannot submit (toast error).
- **Whitespace-only answers:** trimmed to empty → blocked by validation.
- **Very long text:** no client max length; server/DB limits apply from Mongoose/string caps if any.
- **Type `sentence` vs `sentence_writing`:** same UI; review service accepts both types.

---

## 8. File map (quick reference)

| Concern | Location |
|---------|----------|
| Drill schema (`sentence_writing_items`, legacy sentence fields) | `src/models/drill.ts` |
| Learner UI + submit payload | `src/components/drills/SentenceDrill.tsx` |
| Router to component | `src/components/drills/DrillPracticeInterface.tsx` |
| Complete API schema | `src/app/api/v1/drills/[drillId]/complete/route.ts` |
| Attempt schema | `src/models/drill-attempt.ts` |
| Review scoring | `src/domain/attempts/attempt-review.service.ts` (`reviewSentenceAttempt`) |
| Student results UI (global index) | `src/app/(student)/account/drills/[id]/completed/page.tsx` |
| Admin sentence review queue | `src/app/(admin)/admin/drills/sentence-reviews/page.tsx` |

Together, this describes how a sentence writing drill is **formed**, how the learner is expected to **complete** it, and what the system **calculates** at submit time versus at **review** time.
