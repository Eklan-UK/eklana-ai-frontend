# How learner streaks work

This document describes the streak feature for **student** accounts (`role: user`): what counts as activity, how days are stored, how consecutive streaks are computed, and how the UI gets data.

---

## Overview

A **streak** is a count of **consecutive UTC calendar days** on which the learner had at least one **qualifying activity**. The system also maintains:

- **Longest streak** (all-time best consecutive run)
- **Last 7 UTC days** of activity (for the week row on profile and streak screens)
- **Badges** when milestones are hit (e.g. 7-day badge)

All streak logic lives in **`StreakService`** ([`src/services/streak.service.ts`](../src/services/streak.service.ts)). Aggregated state is stored in **`UserStreak`** ([`src/models/user-streak.ts`](../src/models/user-streak.ts)).

---

## Calendar days: UTC

Streaks use **UTC midnight boundaries**, not the learner’s local timezone.

- Each activity is keyed by a **`dateString`** in the form `YYYY-MM-DD` (UTC).
- “Today” and “yesterday” in streak checks use the same UTC definition as the server clock.

If you later need “local day” streaks, you would change how `dateString` is produced and queried (not a small toggle).

---

## What counts as activity (three sources)

The streak engine **merges** two kinds of persisted data into one set of qualifying UTC days:

| Source | When it is written | Notes |
|--------|-------------------|--------|
| **Daily focus** | `POST` daily focus complete (score ≥ 70%) | Creates a **`DailyFocusCompletion`** row (`isFirstCompletion: true`). Handled by **`StreakService.recordCompletion`**. |
| **Drill completion** | `POST` drill complete for learners, score ≥ 70 | Upserts a **`StreakActivityDay`** for today via **`StreakService.recordActivityDay`** (with optional `score`, `$max` on score). |
| **App presence (login ping)** | Once per UTC day while using the student app | Same **`recordActivityDay`** without score; client calls **`POST /api/v1/users/streak/activity`** at most once per day (see below). |

If the same UTC day appears in **both** daily focus completions and streak activity days, **daily focus wins** for that `dateString` when merging (the daily-focus row is applied first; activity-day rows only fill **missing** dates).

---

## Data models

### `DailyFocusCompletion`

- One row per user / daily focus / first completion that day (when daily focus flow runs).
- Used for historical daily-focus streak data and merged into streak math.

See [`src/models/daily-focus-completion.ts`](../src/models/daily-focus-completion.ts).

### `StreakActivityDay`

- **At most one document per `(userId, dateString)`** (unique index).
- Stores **`date`** (UTC day anchor) and optional **`score`** (e.g. from drills via `$max`).
- Used for **login ping** and **drill**-based qualifying days.

See [`src/models/streak-activity-day.ts`](../src/models/streak-activity-day.ts).

### `UserStreak`

- One document per user (by `userId`).
- Caches **`currentStreak`**, **`longestStreak`**, **`weeklyActivity`** (last 7 UTC days), **`badges`**, and related metadata.

See [`src/models/user-streak.ts`](../src/models/user-streak.ts).

---

## Recompute flow (`updateStreak`)

Whenever qualifying data changes, **`StreakService.updateStreak(userId)`** runs. It:

1. Loads **merged** UTC days via **`getMergedStreakDayRows`** (daily focus + activity days).
2. If there are **no** merged days, resets cached streak fields on **`UserStreak`** to zero / null.
3. Otherwise computes **current consecutive streak** backward from today or yesterday (same rules as before the merge), updates **`longestStreak`**, rebuilds **`weeklyActivity`** for the rolling 7 UTC days, and persists **`UserStreak`**.

`recordCompletion` (daily focus) and `recordActivityDay` (login / drill) both call **`updateStreak`** after writing their respective data.

---

## HTTP API

| Method | Path | Purpose |
|--------|------|--------|
| `GET` | `/api/v1/users/streak` | Returns **`StreakData`** for the current user (used by profile + `StreakDisplay`). |
| `POST` | `/api/v1/users/streak/activity` | **Learner only** (`role: user`). Idempotent “mark today as active” for the login ping. |

Daily focus completion continues to go through the **daily-focus complete** route, which calls **`StreakService.recordCompletion`** (not the activity endpoint).

Drill completion is wired in **`POST /api/v1/drills/[drillId]/complete`**: after a successful complete, if the user is a learner and **score ≥ 70**, it calls **`recordActivityDay`** with that score.

---

## Frontend

- **Profile** streak card: [`useUserStreak`](../src/hooks/useUserStreak.ts) → `GET /api/v1/users/streak`.
- **Streak page**: [`StreakDisplay`](../src/components/streak/StreakDisplay.tsx) uses **`streakAPI.getStreak()`** (same backend data).
- **Login ping**: [`StreakActivityPing`](../src/components/streak/StreakActivityPing.tsx) is mounted from the **[student layout](../src/app/(student)/layout.tsx)**. It uses **`sessionStorage`** key `streakActivityUtc:<YYYY-MM-DD>` so the **`POST .../streak/activity`** call runs **at most once per UTC day** per browser.

---

## Feature flag

Streak processing is **on by default**.

- To **disable** all streak writes and API-backed streak UI data, set environment variable **`STREAK_ENABLED=false`**.
- If unset or any other value, **`streakFeatureEnabled()`** treats streaks as enabled (see `StreakService`).

When disabled, **`recordCompletion`** / **`recordActivityDay`** / merged reads used for display short-circuit so existing UI shows empty/zero streaks without throwing.

---

## Badges

Badge definitions live in **`BADGE_DEFINITIONS`** in `streak.service.ts`. After streak updates, **`checkBadgeUnlock`** may append to **`UserStreak.badges`** when **`currentStreak`** crosses a milestone (e.g. 7 days).

---

## Operational notes

- **Idempotency**: Multiple drill completes or login pings on the **same UTC day** do not create duplicate merged days; activity day upserts and daily focus guards its own rules.
- **Drill failures**: Drill completion does **not** fail if streak recording throws; errors are caught so the learner still gets a successful drill response.
- **Indexes**: `StreakActivityDay` has a unique compound index on `(userId, dateString)` to enforce one logical row per user per UTC day.

For code entry points, start at [`src/services/streak.service.ts`](../src/services/streak.service.ts) and the routes under **`src/app/api/v1/users/streak/`** and **`src/app/api/v1/drills/[drillId]/complete/`**.
