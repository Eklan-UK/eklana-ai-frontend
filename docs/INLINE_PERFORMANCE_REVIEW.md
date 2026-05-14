# Inline Performance Review (In-Drill Analysis)

This document describes **inline** pronunciation performance feedback: what appears **while** the learner is still inside a drill (before or without opening the full **Review Performance** screen), how it relates to progress UI, and **which** drill types use it.

> **Note:** “Inline” here means **embedded in the active drill page**, not a separate full-screen review. The codebase implements this primarily through **`DrillLineReviewAccordion`** and small **score / transcript** readouts next to the recording flow.

---

## 1. What “inline review” is

After the learner submits a recording for **Speechace** analysis, several things can appear **on the same scrollable drill surface**:

1. **A short status line** — e.g. “Analysis complete!” and a **transcript** line (pronunciation drill only shows transcript inline in the card; vocabulary similarly).
2. **`DrillLineReviewAccordion`** — a **card** for the **current** scored line with:
   - Line label (**Word** or **Sentence**),
   - The text Speechace aligned to (transcript fallback to target text),
   - A **pill** with the **performance score %** (green if ≥ pass threshold, amber otherwise),
   - A **collapsible** section **“Breakdown of the analysis”** (starts **collapsed**).

Expanding **“Breakdown of the analysis”** reveals **word-level** detail via **`PronunciationWordBreakdown`** (`variant="review"`): syllables, phoneme pills, stress, colors by score bands — all derived from the **`TextScore`** object returned by Speechace.

So **inline review** = **immediate, per-attempt feedback** without leaving the drill step.

---

## 2. Where it is implemented (UI)

| Piece | File | Export / usage |
|--------|------|------------------|
| Accordion row + analysis panel | `src/components/drills/shared/DrillPerformanceReview.tsx` | **`DrillLineReviewAccordion`** (same file as full-screen `DrillPerformanceReview`) |
| Word / phoneme breakdown | `src/components/drills/shared/PronunciationWordBreakdown.tsx` | Used inside `LineAnalysisPanel` |
| Transcript string from `TextScore` | `src/components/drills/shared/speechaceTranscript.ts` | `transcriptFromTextScore` |

`DrillLineReviewAccordion` is documented in code as mirroring the **“Breakdown of the analysis”** behavior from the end-of-drill review screen, but **scoped to one row** and **lazy-open** (student opens breakdown when they want).

---

## 3. Which drills use inline analysis

| Drill type | Inline `DrillLineReviewAccordion`? | How analytics rows are produced |
|------------|-------------------------------------|-----------------------------------|
| **Vocabulary** | **Yes** | On each successful Speechace result, `sessionReviewAnalytics` is updated for `(sceneIndex = item index, turnIndex = 0 word / 1 sentence)`. `inDrillReviewRow` derives the **current** row from `pronunciationScore` + index + screen. |
| **Pronunciation** | **Yes** | Same pattern as vocabulary; items come from `pronunciation_items`. |
| **Roleplay** | **No** (`DrillLineReviewAccordion` not used) | Spoken lines update `turnProgress` and append **`sessionAnalytics`** for the **later** full-screen review only. During play, feedback is toasts + confetti + optional transcript on the message when continuing — not the shared accordion. |
| **Other drills** (matching, grammar, sentence writing, etc.) | **No** | No Speechace `TextScore` pipeline in the same way. |

So **“every drill”** does **not** share this inline component — only **vocabulary** and **pronunciation** share **`DrillLineReviewAccordion`**.

---

## 4. Data driving the inline accordion

### 4.1 `PerformanceReviewAnalyticsRow` (shared shape)

Defined in `DrillPerformanceReview.tsx`:

- `sceneIndex` — For vocab/pronunciation: **which item** (0-based index in `target_sentences` / `pronunciation_items`).
- `turnIndex` — **0** = word step, **1** = sentence step.
- `text` — Reference string sent to Speechace for that turn.
- `score` — `textScore.speechace_score.pronunciation` (0–100).
- `textScore` — Full Speechace **`TextScore`** (word list, phones, syllables, etc.).
- `attempts` — Incremented when the same `(sceneIndex, turnIndex)` is scored again (re-record / try again).

### 4.2 `inDrillReviewRow` pattern (vocab & pronunciation)

Both drills compute a **single** `PerformanceReviewAnalyticsRow | null`:

- If there is **no** current `pronunciationScore` → `null` → accordion hidden.
- Else build the row for **current** item index and **current** screen (word vs sentence), matching `sessionReviewAnalytics` for **attempts** count.

The accordion is **`key`ed** by `sceneIndex`, `turnIndex`, and `attempts` so React **remounts** when the learner re-attempts the same line and gets fresh expand/collapse state.

---

## 5. Progress UI (“counter” / bar) vs Review

Learners also see **`DrillProgress`** (`src/components/drills/shared/DrillProgress.tsx`) at the top of vocab/pronunciation flows:

- Shows **`Item X of Y`** and a **percentage** bar (`current / total * 100`).
- This is **structural progress through items**, not Speechace score.
- **Pass** state per item is tracked separately (`wordPassed` / `sentencePassed`); the bar does **not** show pronunciation %.

**Transition to full Review Performance:**

- When the learner finishes the **last** item (both word + sentence passed), the drill sets **`showReview = true`** and replaces the main body with **`DrillPerformanceReview`** (full-screen layout under `DrillLayout` with title **“Review Performance”**).
- So the flow is: **progress bar (items)** + **inline accordion (last score)** on each step → then **entire screen** dedicated to aggregated review (donut, all scenes/items, submit).

That is the sense in which a **compact counter/bar** lives **above** the work area, and the learner later **moves into** the dedicated **Review** experience (not that the bar physically “expands” into review — it is **navigation/state**).

---

## 6. Speechace and side channels (context for inline)

- **Client** calls `speechaceService.scorePronunciation(text, audioBlob)` → Next route **`/api/v1/speechace/score`**.
- On success, **vocab / pron / roleplay** also fire **`pronunciationAPI.createDrillAttempt`** to log a **standalone** pronunciation attempt (Cloudinary + server Speechace in `PronunciationService`). Inline UI does **not** depend on that call succeeding.

---

## 7. Roleplay: “silent” collection (contrast)

`RoleplayDrill` **appends** to `sessionAnalytics` on each successful student-line analysis and builds **`reviewSceneGroups`** for **`RoleplayPerformanceReview`**, but **does not** render `DrillLineReviewAccordion` during the scene. Inline feedback there is **lighter** (toasts, transcript stored on the completed student message when advancing).

---

## 8. Summary

| Concept | Behavior |
|--------|----------|
| **Inline review** | **`DrillLineReviewAccordion`** after each scored word/sentence in **vocabulary** & **pronunciation** drills. |
| **Content** | Collapsible Speechace breakdown + score pill + transcript. |
| **Progress bar** | **`DrillProgress`** — item index / total, separate from pronunciation %. |
| **Full review** | **`DrillPerformanceReview`** after all items — aggregate donut, all groups, submit. |
| **Other drills** | No shared inline Speechace accordion; roleplay collects analytics for **post-session** review only. |

For the **full-screen** review module, snapshot format, and **API persistence**, see **`REVIEW_PERFORMANCE.md`**.
