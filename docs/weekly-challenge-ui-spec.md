# Weekly Challenge — UI Spec

## Routes

| Route | Page |
|-------|------|
| `/account/practice` | Practice page — entry point |
| `/account/practice/weekly-challenge` | History list — all challenges, newest first |
| `/account/practice/weekly-challenge/[weekStartDate]` | Week view — drill items for one week |
| `/api/v1/learner/weekly-challenge/[weekStartDate]/items/[index]/checkpoint` | API — checkpoint save / load / clear (not a UI page; drills call this via `weeklyChallengeAPI`) |

---

## 1. Practice page

Add a **Weekly Challenge** card below the Free Talk card, same style.

Clicking navigates to `/account/practice/weekly-challenge`.

---

## 2. History list (`/account/practice/weekly-challenge`)

**Hook:** `useWeeklyChallengeHistory()` → `{ challenges, isLoading, isError, refetch }`

On mount, trigger generation of the current week's challenge if it doesn't exist yet (call `weeklyChallengeAPI.getCurrent()` in the background — the backend upserts it automatically).

Each card shows:

| Field | Example |
|-------|---------|
| Title | "Week 23 Challenge" — derived from `weekNumber` |
| Week label | "Week of Jun 2, 2026" — format `weekStartDate` |
| Status badge | Ready / Ongoing / Completed / Generating / Failed — Ready = `status:'ready'` with 0 completions; Ongoing = some completed; Completed = all completed |
| Drill summary | "4 drills · 25 min" — count of `drillSequence` items + `totalEstimatedMinutes` |
| Generated date | "Generated Jun 4" — formatted `generatedAt` (shown when `status === 'ready'`) |

Clicking a card navigates to `/account/practice/weekly-challenge/[weekStartDate]` where `weekStartDate` is the ISO date string from the document.

Sort: newest first (the API already returns them sorted).

---

## 3. Week view (`/account/practice/weekly-challenge/[weekStartDate]`)

**Hook:** `useWeeklyChallenge(weekStartDate)` → `{ challenge, isLoading, isError, refetch }`

If `status === 'generating'`, poll every 3 s until ready (same pattern as the existing `useWeeklyChallenge` hook).

Render each `ChallengeDrillItem` as a card:
- Index number + drill type label
- `item.instructions`
- Estimated minutes
- **Start** button → launches `DrillPracticeInterface` with the adapted drill props

---

## 4. DrillPracticeInterface adapter

Map `ChallengeDrillItem` → `DrillPracticeInterface` props based on `drillType`:

| `drillType` | `generatedContent` key | Adapter notes |
|-------------|------------------------|---------------|
| `pronunciation` | `pronunciation_items` | Pass items directly; `sound` is an IPA string |
| `fill_blank` | `fill_blank_items` | Each `sentence` contains `___` per blank in `blanks[]` |
| `vocabulary` | `vocabulary_items` | Adapted as `fill_blank`; adapter remaps `vocabulary_items` → `fill_blank_items` |
| `key_phrases` | `key_phrase_items` | `correctAnswer` must exactly match one entry in `options[]` |
| `roleplay` | `roleplay_scenes` | See speaker constraint below |

### Roleplay speaker constraint

`dialogue[].speaker` is always `"student"` or `"ai_<n>"` (0-based index into `ai_character_names[]`). **Never** a character name. The adapter must resolve display names from `student_character_name` and `ai_character_names[]` — do not render the raw speaker value.

---

## 5. Checkpoint system

Drills running inside a weekly challenge save progress server-side via a dedicated checkpoint route, separate from the standard drill checkpoint API (weekly challenge drills use synthetic `_id` values that fail MongoDB ObjectId validation in the regular route).

**API:** `GET / POST / DELETE /api/v1/learner/weekly-challenge/[weekStartDate]/items/[index]/checkpoint`

Checkpoints are stored in a `checkpoints` Map field on the `WeeklyChallenge` document, keyed by item index (string). The client uses `weeklyChallengeAPI.getCheckpoint`, `.saveCheckpoint`, `.clearCheckpoint` from `src/lib/api.ts`.

| Drill type | Checkpoint trigger | State saved in `partialResults` |
|------------|--------------------|--------------------------------|
| `fill_blank` | Every 5 items answered | `answers`, `submittedCount` |
| `pronunciation` | Every 5 fully-passed items (word + sentence both pass) | `wordProgress`, `sessionReviewAnalytics` |
| `key_phrases` | Every 5 items answered | `itemResults`, `sessionReviewAnalytics` |
| `roleplay` | After each scene completes (multi-scene drills only) | `{}` — scene index alone is sufficient |

After a checkpoint is saved the drill shows `CheckpointScreen` (Continue / Exit & Resume Later). Exit navigates to `/account/practice/weekly-challenge/[weekStartDate]`.

On mount, the drill calls `getCheckpoint()` and hydrates `currentIndex` from `cp.resumeFromIndex`. The checkpoint is cleared automatically on full completion.

---

## 6. Completion

- All drill types navigate back to `/account/practice/weekly-challenge/[weekStartDate]` when the learner taps the return button on the completion screen.
- `FillBlankDrill` shows a `DrillPerformanceReview` screen before marking the item complete.
- Item completion is recorded via `POST /api/v1/learner/weekly-challenge/items/[index]/complete` (`$addToSet` on `completedItemIndexes` — safe to call multiple times).
- The item's checkpoint is cleared on completion.

---

## 7. Category → drill type mapping (reference)

| Weakness category | Drill type |
|-------------------|------------|
| `pronunciation` | `pronunciation` or `key_phrases` |
| `fluency` | `roleplay` |
| `vocabulary` | `fill_blank` or `key_phrases` |
| `grammar` | `fill_blank` |

This is determined by GPT-5.5 at generation time. The UI does not need to compute it.
