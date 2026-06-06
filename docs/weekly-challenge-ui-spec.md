# Weekly Challenge — UI Spec

## Routes

| Route | Page |
|-------|------|
| `/account/practice` | Practice page — entry point |
| `/account/practice/weekly-challenge` | History list — all challenges, newest first |
| `/account/practice/weekly-challenge/[weekStartDate]` | Week view — drill items for one week |

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
| Week label | "Week of Jun 2, 2026" — format `weekStartDate` |
| Status badge | Ready / Generating / Failed |
| Drill summary | "2 drills · 12 min" — count of `drillSequence` items + `totalEstimatedMinutes` |

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
| `key_phrases` | `key_phrase_items` | `correctAnswer` must exactly match one entry in `options[]` |
| `roleplay` | `roleplay_scenes` | See speaker constraint below |

### Roleplay speaker constraint

`dialogue[].speaker` is always `"student"` or `"ai_<n>"` (0-based index into `ai_character_names[]`). **Never** a character name. The adapter must resolve display names from `student_character_name` and `ai_character_names[]` — do not render the raw speaker value.

---

## 5. Category → drill type mapping (reference)

| Weakness category | Drill type |
|-------------------|------------|
| `pronunciation` | `pronunciation` or `key_phrases` |
| `fluency` | `roleplay` |
| `vocabulary` | `fill_blank` or `key_phrases` |
| `grammar` | `fill_blank` |

This is determined by Gemini at generation time. The UI does not need to compute it.
