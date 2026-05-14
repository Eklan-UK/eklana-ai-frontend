# Review Performance — UI and API / Persistence

This document describes the **Review Performance** experience: the full-screen (or modal) **`DrillPerformanceReview`** UI, how **scene/item groups** and **scores** are built, how data is **sent to the API** on drill completion, and how staff **replay** the same view from stored snapshots.

> **Terminology:** The codebase does not use a product name “Acorn.” This file documents the **HTTP/API contract**, **`DrillService.completeDrill`**, and **MongoDB `DrillAttempt`** fields that back Review Performance.

---

## 1. Components and responsibilities

### 1.1 `DrillPerformanceReview`

**File:** `src/components/drills/shared/DrillPerformanceReview.tsx`

**Props:**

| Prop | Purpose |
|------|---------|
| `avgScore` | Number **0–100** shown in the **donut** (“Overall Score”). |
| `statsLine` | Short human-readable summary under the donut (e.g. “3 of 5 items passed · 6 scored attempts”). |
| `groups` | `PerformanceReviewGroup[]` — one **accordion** per scene/item block. |
| `passThreshold` | Typically **65** for speaking drills; used to color line score pills (pass vs warn). |
| `sectionHeading` | e.g. **“Item-by-Item Analysis”** (vocab/pron) or from caller for roleplay. |
| `viewMode` | **`"student"`** (default): bottom bar with **Done for today** + **Practice again**. **`"viewer"`**: single **Close** for admin/tutor replay. |
| `onDone` | Student: submit drill / viewer: close modal. |
| `onPracticeAgain` | Reset drill state (student only). |
| `isSubmitting` | Disables primary button and shows spinner text “Submitting…”. |

**UI structure:**

1. **`OverallScoreDonut`** — SVG donut, stroke `#3B883E`, numeric label `round(clamp(avgScore, 0, 100))`.
2. **Section heading** + list of **scene cards** — each card is a **button** header (`sceneTitle` + chevron). **Only one scene expanded at a time** (`expandedListIndex` accordion).
3. Inside an expanded scene: subheading **“Here is a Breakdown of your performance”** and a list of **`LineReviewAccordionRow`** per spoken line (`Line ${turnIndex + 1}`). **Only one line’s “Breakdown” expanded at a time** (`expandedLineKey`).
4. **Bottom bar** — fixed for students; viewer gets a simple Close strip.

**Shared building blocks:** `LineReviewAccordionRow` and `LineAnalysisPanel` (same file) — score pill, collapsible breakdown, `PronunciationWordBreakdown` + transcript + attempts count.

### 1.2 `DrillLineReviewAccordion`

Exported from the **same file** — thin wrapper around `LineReviewAccordionRow` with **local** `useState` for open/collapse. Used **inside** vocabulary/pronunciation drills for **inline** feedback (see **`INLINE_PERFORMANCE_REVIEW.md`**).

### 1.3 `RoleplayPerformanceReview`

**File:** `src/components/drills/shared/RoleplayPerformanceReview.tsx`

A **thin adapter** over `DrillPerformanceReview`:

- Forces `sectionHeading` to **“Scene-by-Scene Analysis”**.
- Passes `sceneGroups` through as `groups`.
- Passes `ui: "roleplay"` only indirectly via snapshot on submit (see §3).

---

## 2. Data model (`PerformanceReviewGroup` / `Row`)

**Types** (in `DrillPerformanceReview.tsx`):

```ts
interface PerformanceReviewAnalyticsRow {
  sceneIndex: number;
  turnIndex: number;
  text: string;
  score: number;
  textScore: TextScore | null;
  attempts: number;
}

interface PerformanceReviewGroup {
  sceneIndex: number;
  sceneTitle: string;
  rows: PerformanceReviewAnalyticsRow[];
}
```

- **`sceneIndex` / `sceneTitle`:** Vocab/pron = vocabulary **item** or pronunciation **item**; roleplay = **scene** index + `scene_name`.
- **`turnIndex` / rows:** Ordered lines inside that group (word vs sentence for vocab/pron; dialogue order for roleplay student lines).

**`textScore`:** Must be JSON-serializable for snapshot storage (Speechace-shaped object).

---

## 3. How each speaking drill builds `groups` / `avgScore` / `statsLine`

### 3.1 Vocabulary (`VocabularyDrill.tsx`)

- **`sessionReviewAnalytics`:** updated on every successful Speechace analysis (replace row per `(sceneIndex, turnIndex)`, bump `attempts`).
- **`reviewGroups`:** `useMemo` — `Map` by `sceneIndex`, sort, map to `{ sceneTitle: "Item N: preview", rows }` where preview is truncated word/sentence text.
- **`reviewAvgScore`:** Mean of **all** `sessionReviewAnalytics[].score` if non-empty; else mean of `(wordScore + sentenceScore)/2` from `wordProgress`.
- **`reviewStatsLine`:** `passedItems of target_sentences.length items passed · N scored attempts`.

**Submit:** `drillAPI.complete` includes `performanceReviewSnapshot: { version: 1, ui: "drillPerformance", avgScore, statsLine, passThreshold: 65, sectionHeading: "Item-by-Item Analysis", groups }` (deep-cloned with `JSON.parse(JSON.stringify(reviewGroups))`).

### 3.2 Pronunciation (`PronunciationDrill.tsx`)

Same structure as vocabulary; groups use `pronunciation_items` for titles/previews. Snapshot `ui` is **`"drillPerformance"`**.

### 3.3 Roleplay (`RoleplayDrill.tsx`)

- **`sessionAnalytics`:** array **`TurnAnalytics`** — on each successful student-line Speechace, **append** `{ sceneIndex, turnIndex, text, score, textScore, attempts, timestamp }`.
- **`reviewSceneGroups`:** `useMemo` — filter/dedupe/sort `sessionAnalytics`, group by `sceneIndex`, map rows to `PerformanceReviewAnalyticsRow` shape, titles from `scene.scene_name`.
- **Review screen** (`showReview`): `RoleplayPerformanceReview` with `avgScore` from **current** `turnProgress` scores, `statsLine` from completed student lines count + sum of attempts.
- **Submit:** `performanceReviewSnapshot` uses **`ui: "roleplay"`** and `sectionHeading: "Scene-by-Scene Analysis"`; `roleplayResults.sceneScores` holds per-scene averages for the **attempt** document (separate from snapshot).

---

## 4. API: submitting Review Performance with the attempt

### 4.1 Route

**`POST /api/v1/drills/[drillId]/complete`** — `src/app/api/v1/drills/[drillId]/complete/route.ts`

Zod schema (excerpt):

- `performanceReviewSnapshot` optional, must match **version `1`**, `ui` ∈ `drillPerformance` | `roleplay`, numeric `avgScore`, string `statsLine`, `passThreshold`, `sectionHeading`, **`groups`**: `z.array(z.any())` (loose typing for nested `TextScore`).

### 4.2 Service layer

**`DrillService.completeDrill`** (`src/domain/drills/drill.service.ts`) passes `performanceReviewSnapshot` through into **`CreateAttemptData`** → **`AttemptRepository.create`**.

### 4.3 Persistence

**`DrillAttempt`** (`src/models/drill-attempt.ts`):

- Field **`performanceReviewSnapshot?: Record<string, unknown>`** — frozen copy of the review UI payload for replay.

No separate “Review Performance” table: the snapshot lives **on the attempt**.

---

## 5. Viewer / replay UI (admin)

**`DrillSubmissionsComponent`** (`src/components/admin/drill-submissions.tsx`):

1. Reads `drill.latestAttempt?.performanceReviewSnapshot`.
2. **`parsePerformanceReviewSnapshot`** validates **`version === 1`**, **`ui`** in `drillPerformance` | `roleplay`, required numeric/string fields, **`groups`** is an array.
3. If valid and drill type is **vocabulary**, **pronunciation**, or **roleplay**, shows button **“View full performance analysis”**.
4. Click opens a **modal** titled **“Review performance”** with:
   - **`RoleplayPerformanceReview`** if `ui === "roleplay"` (passes `viewMode="viewer"`, `onClose` / `onDone` clear modal, no-op **Practice again**).
   - Else **`DrillPerformanceReview`** with `sectionHeading` from snapshot.

**Older attempts** without a snapshot show copy that **line-by-line analysis is not available**.

---

## 6. Student vs viewer behavior

| Mode | Primary action | Practice again |
|------|----------------|------------------|
| `student` | **Done for today** → parent `handleSubmit` (persist attempt + assignment complete). | Resets drill state, returns to practice. |
| `viewer` | **Close** → dismiss modal. | Disabled / no-op. |

---

## 7. Interaction with drill `score`

- **Vocabulary / pronunciation:** `score` on complete = **% of items** where **both** word and sentence passed (see drill-specific docs). **`avgScore` in the snapshot** is the **mean Speechace line score** (from analytics or from `wordProgress`), which can **differ** from the stored drill `score`.
- **Roleplay:** `score` on complete = **mean** of `turnProgress` scores; snapshot `avgScore` on review screen uses the same pool — closer alignment, but snapshot still stores whatever was computed at submit time.

---

## 8. File map

| Layer | Path |
|-------|------|
| Review UI + types + inline accordion | `src/components/drills/shared/DrillPerformanceReview.tsx` |
| Roleplay adapter | `src/components/drills/shared/RoleplayPerformanceReview.tsx` |
| Word breakdown | `src/components/drills/shared/PronunciationWordBreakdown.tsx` |
| Vocab wiring | `src/components/drills/VocabularyDrill.tsx` |
| Pronunciation wiring | `src/components/drills/PronunciationDrill.tsx` |
| Roleplay wiring | `src/components/drills/RoleplayDrill.tsx` |
| Complete API schema | `src/app/api/v1/drills/[drillId]/complete/route.ts` |
| Persist attempt | `src/domain/drills/drill.service.ts` |
| Attempt schema | `src/models/drill-attempt.ts` |
| Admin replay | `src/components/admin/drill-submissions.tsx` |

---

## 9. Summary

| Topic | Implementation |
|--------|----------------|
| **Review Performance UI** | `DrillPerformanceReview` — donut, accordion scenes, accordion lines, breakdown panel, student footer or viewer Close. |
| **Roleplay** | `RoleplayPerformanceReview` → same component, fixed section title; snapshot `ui: "roleplay"`. |
| **API** | Optional `performanceReviewSnapshot` on **`POST .../complete`**; stored on **`DrillAttempt`**. |
| **Replay** | Admin parses snapshot v1 and opens modal with `viewMode="viewer"`. |

Companion doc: **`INLINE_PERFORMANCE_REVIEW.md`** (per-line accordion **during** vocab/pronunciation drills).
