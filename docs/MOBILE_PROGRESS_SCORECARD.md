# Mobile Handoff — Progress Scorecard

> **Prerequisites**: Read `MOBILE_README.md` first for auth, error envelope, and React Query conventions.
>
> **Product spec**: See `docs/progress-scorecard.md` for metric definitions.
>
> **Supersedes**: The Home metric sections in `MOBILE_HOME.md` that reference `/progress/home`, `/confidence`, and `/pronunciation` as separate sources. Use the unified scorecard endpoint described here instead.

---

## 1. Overview

The **Progress Scorecard** powers the four metric cards on the Home screen (and the Profile confidence summary on web):

| Home card label | Scorecard field | Weekly delta field |
|-----------------|-----------------|--------------------|
| Confidence | `confidence` | `confidenceWeeklyChange` |
| Pronunciation | `pronunciation` | `pronunciationWeeklyChange` |
| Accurate Sentence Usage | `accuracy` | `accuracyWeeklyChange` |
| Response Speed (Fluency) | `fluency` | `fluencyWeeklyChange` |

All four cards read from **one API call**. Do not fetch legacy `/progress/home`, `/confidence`, or `/pronunciation` for these cards.

---

## 2. What changed (June 2026)

Web fixed two issues that mobile must mirror in client behavior:

| Issue | Backend fix | Mobile action |
|-------|-------------|---------------|
| Accuracy always `0` | Server now persists `drillType` on each `DrillAttempt`. Legacy attempts without `drillType` are inferred from result fields server-side. | No payload change. Keep submitting full drill result objects on complete (see §5). |
| Scores not updating after practice | N/A (server already recomputed on complete) | **Invalidate/refetch** the scorecard cache after drill completion, weekly challenge completion, and Free Talk session save (see §4). |

---

## 3. Backend contract

### 3.1 Fetch scorecard

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/progress/scorecard` | Bearer, role `user` | `{ code: 'Success', data: { scorecard: ProgressScorecardMetrics } }` |

**Example request**

```http
GET /api/v1/progress/scorecard
Authorization: Bearer <token>
Cache-Control: no-store
```

**Example response**

```json
{
  "code": "Success",
  "message": "Success",
  "data": {
    "scorecard": {
      "pronunciation": 80,
      "accuracy": 94,
      "fluency": 0,
      "confidence": 87,
      "pronunciationWeeklyChange": 0,
      "accuracyWeeklyChange": -6,
      "fluencyWeeklyChange": 0,
      "confidenceWeeklyChange": -15,
      "confidenceLabel": "Good",
      "confidenceTrend": "declining",
      "sampleCounts": {
        "pronunciationDrills": 2,
        "accuracyDrills": 18,
        "fluencyScenarios": 0
      }
    }
  }
}
```

### 3.2 TypeScript types

```ts
type ConfidenceLabel =
  | 'Excellent'      // score >= 95
  | 'Very Good'      // score >= 88
  | 'Good'           // score >= 82
  | 'Average'        // score >= 75
  | 'Developing'     // score >= 60
  | 'Needs Improvement';

type ConfidenceTrend = 'improving' | 'stable' | 'declining';

interface ProgressScorecardMetrics {
  pronunciation: number;              // 0–100
  accuracy: number;                 // 0–100
  fluency: number;                  // 0–100
  confidence: number;               // 0–100
  pronunciationWeeklyChange: number;
  accuracyWeeklyChange: number;
  fluencyWeeklyChange: number;
  confidenceWeeklyChange: number;
  confidenceLabel: ConfidenceLabel;
  confidenceTrend: ConfidenceTrend;
  sampleCounts: {
    pronunciationDrills: number;    // attempts with Speechace data
    accuracyDrills: number;         // assigned key_phrases + fill_blank
    fluencyScenarios: number;       // free talk attempts with grade
  };
}
```

### 3.3 Metric calculation (server-side)

Mobile displays values as returned. Computation lives in `src/domain/progress/progress-scorecard.service.ts`.

| Metric | Source data | Notes |
|--------|-------------|-------|
| **Pronunciation** | Avg Speechace score per completed drill attempt | Uses `vocabularyResults`, `pronunciationResults`, or `roleplayResults` word/scene scores. Only scores `> 0` count. One avg per drill, then avg across drills. |
| **Accuracy** | Avg score from assigned **Key Phrases** and **Fill-in-the-blank** drills | Requires `drillAssignmentId` on the attempt. Uses `keyPhrasesResults.score` or `fillBlankResults.score`. |
| **Fluency** | Avg `gradeResult.overallScore` from **Free Talk** attempts | Stays `0` until at least one graded Free Talk session exists. |
| **Confidence** | Average of pronunciation, accuracy, and fluency **only where data exists** | e.g. only pronunciation data → confidence equals pronunciation. Empty pillars show `0` on the card. |

**Weekly change**: Rolling 7-day window vs prior 7-day window. Returns `0` when either window has no samples for that pillar.

**Trend** (`confidenceTrend`): `improving` if weekly change ≥ 3, `declining` if ≤ −3, else `stable`.

---

## 4. Mobile client integration

### 4.1 React Query hook

```ts
// hooks/useProgressScorecard.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/axios';

export const PROGRESS_SCORECARD_KEY = ['progress-scorecard'] as const;

async function fetchProgressScorecard(): Promise<ProgressScorecardMetrics> {
  const { data } = await apiClient.get('/progress/scorecard');
  return data.data.scorecard;
}

export function useProgressScorecard() {
  return useQuery({
    queryKey: PROGRESS_SCORECARD_KEY,
    queryFn: fetchProgressScorecard,
    staleTime: 5 * 60 * 1000, // 5 minutes — match web
    retry: 1,
  });
}
```

### 4.2 Home screen usage

Replace separate progress/confidence/pronunciation queries with one hook:

```ts
const { data: scorecard, isLoading } = useProgressScorecard();

// Confidence card
const confidence = scorecard?.confidence ?? 0;
const confidenceDelta = scorecard?.confidenceWeeklyChange ?? 0;

// Pronunciation card
const pronunciation = scorecard?.pronunciation ?? 0;
const pronunciationDelta = scorecard?.pronunciationWeeklyChange ?? 0;

// Accurate Sentence Usage card
const accuracy = scorecard?.accuracy ?? 0;
const accuracyDelta = scorecard?.accuracyWeeklyChange ?? 0;

// Response Speed / Fluency card
const fluency = scorecard?.fluency ?? 0;
const fluencyDelta = scorecard?.fluencyWeeklyChange ?? 0;
```

Clamp displayed ring values: `Math.max(0, Math.min(100, value))`.

### 4.3 Cache invalidation (required)

After any activity that affects the scorecard, invalidate the query so Home reflects new scores immediately. Web uses query key `['progress-scorecard']`.

| Event | Invalidate `progress-scorecard`? |
|-------|----------------------------------|
| Assigned drill completed via `POST /drills/:drillId/complete` | **Yes** |
| Free Talk session saved with grade | **Yes** |
| Weekly challenge item marked complete | **Yes** (fluency/pronunciation may still be unchanged — see §6) |
| Profile edit, logout | No |
| Streak / badges only | No (unless you also show scorecard on that screen) |

**After drill completion helper** (mirror web `completeLearnerDrill`):

```ts
async function completeLearnerDrill(
  queryClient: QueryClient,
  drillId: string,
  payload: CompleteDrillPayload,
) {
  const result = await apiClient.post(`/drills/${drillId}/complete`, payload);

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['learner-drills'] }),
    queryClient.invalidateQueries({ queryKey: ['badges'] }),
    queryClient.invalidateQueries({ queryKey: ['user-streak'] }),
    queryClient.invalidateQueries({ queryKey: PROGRESS_SCORECARD_KEY }),
  ]);

  return result.data;
}
```

For celebration MP3 + confetti on pass, see [`MOBILE_DRILL_CELEBRATION.md`](./MOBILE_DRILL_CELEBRATION.md). The complete response includes `data.effects` when `data.passed` is true.

**After Free Talk session save** — add the same `invalidateQueries({ queryKey: PROGRESS_SCORECARD_KEY })` alongside streak/badge invalidation.

**After weekly challenge complete** — invalidate scorecard for consistency; note limitations in §6.

---

## 5. Drill completion payload (feeds the scorecard)

Mobile must call **`POST /drills/:drillId/complete`** for assigned plan drills (same as web). The server sets `drillType` from the drill record — **do not send `drillType` in the body**.

Minimum body:

```ts
{
  drillAssignmentId: string;  // required — accuracy pillar needs this
  score: number;              // 0–100
  timeSpent: number;          // seconds
  platform: 'ios' | 'android';
  // Type-specific results (include the block for the drill type):
  vocabularyResults?: { wordScores: Array<{ word: string; score: number; attempts: number; pronunciationScore?: number }> };
  pronunciationResults?: { wordScores: Array<{ word: string; score: number; attempts: number; pronunciationScore?: number }> };
  roleplayResults?: { sceneScores: Array<{ sceneName: string; score: number; fluencyScore?: number; pronunciationScore?: number }> };
  keyPhrasesResults?: { items: unknown[]; totalItems: number; correctItems: number; score: number };
  fillBlankResults?: { items?: unknown[]; totalBlanks?: number; correctBlanks?: number; score?: number };
  // ... other drill types per MOBILE_PRACTICE.md / learning journey spec
}
```

### Which drills move which card?

| Drill type | Updates pronunciation | Updates accuracy |
|------------|----------------------|------------------|
| `vocabulary` | Yes (if `vocabularyResults.wordScores` include Speechace scores) | No |
| `pronunciation` | Yes | No |
| `roleplay` | Yes (scene pronunciation scores) | No |
| `key_phrases` | No | Yes (assigned only) |
| `fill_blank` | No | Yes (assigned only) |
| `matching`, `grammar`, `listening`, etc. | No* | No |

\*Unless they include Speechace result fields (unusual for those types).

---

## 6. Weekly challenge caveat

Drills completed **only** through the weekly challenge flow (`POST /learner/weekly-challenge/items/:index/complete`) do **not** create a `DrillAttempt` record. Those completions **do not** affect the Progress Scorecard today.

For scorecard updates, learners must complete drills through the **assigned drill** path (`POST /drills/:drillId/complete` with `drillAssignmentId`).

If mobile supports both flows, still invalidate the scorecard cache after weekly challenge complete, but set expectations: cards may not change until an assigned drill or Free Talk session is completed.

---

## 7. Free Talk (fluency pillar)

Fluency reads from `FreeTalkAttempt` documents with `gradeResult.overallScore`. Implement per `docs/free-talk-mobile-integration.md` or `docs/eklan-free-talk-mobile-spec.md`.

After a session is graded and persisted, invalidate `progress-scorecard` so the Response Speed card updates.

---

## 8. UI reference (web parity)

| Element | Web implementation |
|---------|-------------------|
| Home cards | `HomeConfidenceCard`, `HomePronunciationCard`, `HomeAccurateSentenceCard`, `HomeResponseSpeedCard` |
| Profile confidence detail | `ConfidenceCard` (shows sub-bars for all three pillars) |
| Hook | `src/hooks/useProgressScorecard.ts` |
| Service | `src/domain/progress/progress-scorecard.service.ts` |

**Weekly delta display**: Show `+N% this week` in green when change ≥ 0, red when negative. Use absolute value for the label (web pattern).

**Loading**: Skeleton ring while `isLoading`. On error, show greyed card or `—`; do not crash Home.

---

## 9. Legacy endpoints

| Endpoint | Status for Home metrics |
|----------|-------------------------|
| `GET /progress/scorecard` | **Use this** |
| `GET /progress/home` | Deprecated for scorecard cards |
| `GET /confidence` | Deprecated for Home; still maps old confidence model |
| `GET /pronunciation` | Deprecated for Home; now derived from scorecard for backward compatibility |

You may keep `/pronunciation` for a dedicated pronunciation history screen if needed, but Home cards should use the scorecard.

---

## 10. Acceptance checklist

- [ ] Home fetches `GET /progress/scorecard` once (not three separate metric endpoints)
- [ ] All four metric cards bind to the correct scorecard fields (§1 table)
- [ ] `confidenceLabel` available for Profile or tooltips if desired
- [ ] After assigned drill complete, scorecard refetches and cards update without app restart
- [ ] After Free Talk graded session, fluency card updates when `sampleCounts.fluencyScenarios > 0`
- [ ] Vocabulary/pronunciation/roleplay drills with Speechace results update pronunciation
- [ ] Key phrases / fill-blank assigned drills update accuracy
- [ ] Weekly challenge-only completions do not falsely promise scorecard updates (§6)
- [ ] `platform: 'ios' \| 'android'` sent on drill complete
- [ ] 401 on scorecard fetch redirects to login

---

## 11. Related docs

| Doc | Purpose |
|-----|---------|
| `MOBILE_HOME.md` | Home layout and navigation (update metric fetch section to point here) |
| `MOBILE_PRACTICE.md` | Drill runners and complete payloads |
| `mobile-weekly-challenge.md` | Challenge completion (separate from scorecard data) |
| `free-talk-mobile-integration.md` | Free Talk / fluency |
| `progress-scorecard.md` | Product definition of the four pillars |
