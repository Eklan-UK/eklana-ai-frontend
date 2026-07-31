# Drill Checkpoints

## Overview

Each drill is divided into smaller sections called **checkpoints**. When a student completes a checkpoint, their progress is saved automatically. They can continue immediately or exit and return later, picking up exactly where they left off. A drill is only marked complete when all checkpoints are finished.

In addition to server checkpoints, both web and mobile keep **device-local, item-level progress** so leaving mid-chunk (items 1–4 of a 5-item block), backgrounding, or crashing still resumes silently at the next unfinished item with prior answers locked.

## Checkpoint Structure by Drill Type

| Drill Type | Server checkpoint | Local item resume |
|---|---|---|
| Vocabulary | Every 5 items + CheckpointScreen | Every completed item |
| Pronunciation | Every 5 items + CheckpointScreen | Every completed item |
| Roleplay | By scene (Continue Later / roleplay-progress API) | Scene/turn + turn maps on leave |
| Matching | Every 5 items + CheckpointScreen | Every matched pair |
| Definition | Every 5 items + CheckpointScreen | Every completed item |
| Grammar | Every 5 items + CheckpointScreen | Every completed item |
| Sentence Writing | Every 5 items + CheckpointScreen | Every completed item |
| Filling in the Blank | Every 5 items + CheckpointScreen | Every completed item |
| Key Phrases | Every 5 items + CheckpointScreen | Every completed item |
| Listening | None | `hasListened` phase |
| Summary | None | Draft text + read/listen/mode |

## Flow

1. Student opens a drill — hydrate **local progress first**, else server checkpoint, else start fresh (silent; no Continue/Restart prompt for local).
2. After each completed item (and meaningful Listening/Summary phase changes), write local progress.
3. At every 5th completed item, also POST the server checkpoint and show CheckpointScreen (unchanged celebration milestone).
4. On leave / tab hide / crash, local flush ensures the latest item state is on device.
5. Student can continue from CheckpointScreen or exit and return later.
6. On successful complete (and redo/restart), clear local (+ server checkpoint as before).
7. Drill is marked complete only when all sections are finished via the existing complete API.

## Local progress contract (web + mobile isomorphic)

Same JSON envelope and storage key shape on web `localStorage` and mobile AsyncStorage.

```ts
type LocalDrillProgressV1 = {
  v: 1;
  drillId: string;
  drillType: string;
  scope:
    | { source: 'assignment'; assignmentId: string }
    | { source: 'weekly_challenge'; challengeId: string; challengeItemIndex: number; weekStartDate?: string }
    | { source: 'unscoped'; drillId: string };
  resumeFromIndex: number;
  completedItemCount: number;
  partialResults: Record<string, unknown>; // reuse existing per-type shapes
  startedAt: string;
  lastUpdatedAt: string;
};
```

**Storage key:** `eklan-drill-progress:v1:{userId}:{scopeKey}`

| Scope | `scopeKey` |
|---|---|
| Assignment | `a:{assignmentId}` |
| Weekly challenge | `wc:{challengeId}:{itemIndex}` |
| Unscoped / bookmarks | `d:{drillId}` |

**Rules**

- Local is the source of truth for resume between server milestones. Do **not** POST every item to the server.
- Debounce free-text drafts (~300–500ms); flush immediately on item advance.
- Web flush: `pagehide` / `visibilitychange=hidden` / unmount.
- Mobile flush: AppState background/inactive, navigation `beforeRemove`, unmount.
- Clear local on successful complete and on redo/restart open.

### `partialResults` by drill type

| Drill | Keys |
|---|---|
| Vocabulary / Pronunciation | `wordProgress`, `sessionReviewAnalytics` |
| Matching | `matchedPairKeys` |
| Definition / Grammar / Sentence | `answers` |
| Fill in the Blank | `answers`, `submittedCount` |
| Key Phrases | `itemResults`, `sessionReviewAnalytics` |
| Listening | `hasListened` |
| Summary | `summary`, `hasRead`, `hasListened`, `currentMode`, `showPassage` |
| Roleplay | `currentSceneIndex`, `currentTurnIndex`, `pausedAtSceneBreak`, `completedSceneIndex`, `turnProgress`, `sessionAnalytics`, `roleMode`, `originalRoleProgress`, `swappedRoleProgress`, `sessionStarted` |

Web helpers: `src/lib/drill/local-drill-progress.ts`, `src/hooks/useLocalDrillProgress.ts`.
