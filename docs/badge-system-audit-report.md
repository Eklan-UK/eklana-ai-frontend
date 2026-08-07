# Badge System Audit Report

**Date:** 2026-08-04  
**Scope:** Audit only (no product/code fixes). Pipeline: evaluate → persist → celebrate → gallery refresh.  
**Primary symptom:** Master Collector stays locked after saving drills.

---

## Verdict: Partially working

The badge pipeline works end-to-end for several badges on ObjectId learners (31 users have at least one badge in production-like data). Master Collector cannot unlock with current content + criteria (zero `advanced` drills; all learner drill bookmarks are `intermediate`). Celebration on drill-complete is broken at the response contract (always `[]`), mitigated client-side by a follow-up evaluate call. UUID/Better Auth users are a latent full-pipeline break via `UserStreak` ObjectId casting.

---

## Environment & evidence sources

| Source | Result |
|--------|--------|
| Static code review | Complete across service, routes, UI, models |
| Unit tests (`badge.service.test.ts`) | Failed to load under vitest (`@/` alias unresolved when importing `badge.service.ts`). File only covers helpers, not evaluators |
| `MONGO_URI` DB `eklan-ai` | Connected; nearly empty (no drills/bookmarks/streaks) |
| Live data DB `elkan-db` | Used for runtime evidence (same Atlas cluster; ~67 collections, real badge/streak/bookmark data) |
| Live HTTP learner repro | Not run (no authenticated learner session in this audit) |
| ObjectId(UUID) throw | Confirmed locally: `input must be a 24 character hex string...` |

**DB note:** App `.env` `MONGO_URI` targets `/eklan-ai` (empty). Runtime badge evidence below is from `elkan-db` on the same cluster. Confirm which DB the deployed app uses before drawing ops conclusions.

Diagnostic script used: `scripts/diagnose-badges-audit.mjs` (read-only; points at `MONGO_URI` DB name).

---

## Phase 1 — Master Collector hypothesis triage

| # | Hypothesis | Verdict | Evidence |
|---|------------|---------|----------|
| 1 | Criteria mismatch: only `difficulty === 'advanced'` counts | **CONFIRMED (primary for Master Collector)** | Evaluator requires advanced drill bookmark (`badge.service.ts` 321–343). Docs/copy say “difficult drills.” Live `elkan-db`: **0 advanced drills**, 862 intermediate, 1 beginner. All 29 `type:'drill'` bookmarks are intermediate. **0** `master-collector` unlocks. |
| 2 | UUID / `UserStreak` ObjectId persistence break | **CONFIRMED as latent systemic bug**; **not** the cause in `elkan-db` today | `evaluateAndUnlock` / `getBadgeState` cast `new Types.ObjectId(userId)` (495, 541). `UserStreak.userId` is ObjectId-only (`user-streak.ts` 47–52). Bookmarks use Mixed + `toUserIdCandidates` (`bookmark.ts` 24; `bookmarks/route.ts` 65–69). Live DB: **0 UUID users**, 91 ObjectId users — so current unlocks are ObjectId-only. |
| 3 | Wrong save surface (admin library vs learner bookmark) | **CONFIRMED as a separate trap**; learner path is correct | Learner: `POST /api/v1/bookmarks` via `useDrillBookmarkToggle` / `DrillBookmarkToggle`. Admin: `POST /api/v1/drills/[id]/bookmark` sets `Drill.is_bookmarked` only — **no** badge evaluation. Live: 1 admin-library bookmarked drill; Master Collector ignores it. |
| 4 | Drill-complete always returns empty `badgesUnlocked` | **CONFIRMED (systemic celebration bug)** | `drills/[drillId]/complete/route.ts` 257–288: fire-and-forget eval + hard-coded `badgesUnlocked: []`. Client mitigation: `complete-learner-drill.ts` 15–21 calls `POST /api/v1/badges/evaluate` afterward. Bookmark path **does** await eval and return celebrations (201 only). |

**False alarm:** Bookmarking an intermediate (or “feels hard”) drill correctly creates a bookmark but correctly fails Master Collector under current rules. Progress stays `{ current: 0, target: 1 }`.

---

## Phase 2 — Static checklist

| Check | Status | Notes |
|-------|--------|-------|
| Trigger coverage | Partial | Bookmark (await), daily-focus (await via streak), free-talk (await), badges GET/evaluate (await). Drill-complete: fire-and-forget only. Admin drill bookmark: none. |
| Response contract | Partial | Bookmark 201 + free-talk + daily-focus return real `badgesUnlocked`. Drill-complete always `[]`. Duplicate bookmark 200 omits `badgesUnlocked` and skips eval. |
| Evaluator correctness | Mixed | Matches `docs/eklan-app-badges.md` unlock table for most badges. Gaps: Master Collector / Déjà Vu “difficult” wording vs `advanced` / any-bookmark; Nightingale code also awards completed challenge window (docs table only lists `zeroPauseProducts`); Handover Hero requires score ≥70 and `scenarioType === 'handover'` only (not `handover_receive`). |
| Persistence | Partial | Writes to `UserStreak.badges` with upsert. ObjectId-safe. UUID users throw before persist. |
| Idempotency | OK (static) | Skips already-unlocked IDs; `normalizeStoredBadges` maps `week-warrior` → `seven-day-stretch`. Live: 0 legacy `week-warrior` rows. |
| UI refresh | OK (static) | `BadgeUnlockProvider` in student layout. Bookmark / daily-focus / free-talk / drill-complete invalidate `queryKeys.badges.all`. Gallery uses `GET /api/v1/badges` which re-evaluates then returns state. |
| Silent failures | Present | Bookmark catch → `[]` (`bookmarks/route.ts` 94–96). Drill-complete `.catch(() => {})`. `triggerBadgeEvaluation` swallows errors (`streak.service.ts` 45–49). Per-badge eval errors logged but skipped. |
| Test gaps | Confirmed | Helpers only; no evaluator/integration tests; vitest path-alias failure when running the file. |

---

## Live unlock inventory (`elkan-db`)

| badgeId | Unlocks | Interpretation |
|---------|--------:|----------------|
| `first-steps` | 31 | Working |
| `nightingale-award` | 26 | Working (21 challenge users all unlocked; extras via completed window / prior state) |
| `done-and-dusted` | 25 | Working |
| `medication-master` | 12 | Working |
| `seven-day-stretch` | 1 | Working (rare; hard criteria) |
| `master-collector` | 0 | Broken by criteria + content (no advanced drills) |
| `deja-vu` | 0 | Not earned yet (max 2 passing attempts on any bookmarked drill; target 10) |
| `monthly-challenge` | 0 | Not earned yet (14-day same-month bar) |
| `handover-hero` | 0 | Not earned yet (11 handover attempts; max score 63 &lt; 70) |
| `skill-keeper` | 0 | No qualifying data (`daily_focus_completions` count = 0) |

---

## Per-badge matrix

Legend: **OK** = path looks correct and/or live unlocks exist · **FAIL** = confirmed break · **N/A / unmet** = code path OK but criteria/data not met · **LATENT** = breaks for UUID users

| Badge | Trigger | Criteria | Persist | Celebrate | Gallery | Notes |
|-------|---------|----------|---------|-----------|---------|-------|
| First Steps | OK (drill bg + daily-focus) | OK | OK / LATENT UUID | Drill: FAIL contract; mitigated by client evaluate | OK | 31 live unlocks |
| 7-Day Stretch | OK | OK (≥5 min × 7 days) | OK / LATENT | Same as drills/focus | OK | 1 live unlock |
| Done & Dusted | OK | OK (ISO week assignments) | OK / LATENT | Same | OK | 25 live unlocks |
| Déjà Vu | OK | Intentional gap: any bookmark **or** advanced | OK / LATENT | Same | OK | Max progress seen: 2/10 on bookmarked drills |
| Monthly Challenge | OK | OK (14 days same month) | OK / LATENT | Same | OK | 0 unlocks — unmet, not proven broken |
| **Master Collector** | OK (learner bookmark) | **FAIL vs product copy / content** | OK / LATENT | OK on new bookmark 201 | OK if criteria met | **0 advanced drills; 0 unlocks; all bookmarks intermediate** |
| Medication Master | OK | OK (50 unique words ≥70) | OK / LATENT | Same | OK | 12 live unlocks |
| Handover Hero | OK (free-talk await) | Strict: handover + score≥70 | OK / LATENT (also ObjectId query) | OK when earned | OK | 0 passing handover attempts |
| Nightingale | OK (any eval trigger) | Broader than docs (completed window) | OK / LATENT | Via evaluate/gallery | OK | 26 unlocks; challenge users 21/21 |
| Skill Keeper | OK (daily-focus) | OK | OK / LATENT | OK when earned | OK | 0 focus completions in DB |

---

## Confirmed root causes (with citations)

### 1. Master Collector requires `advanced`; catalog has none (primary user-facing failure)

```321:343:src/domain/badges/badge.service.ts
async function evaluateMasterCollector(userId: string): Promise<EvalResult> {
  const bookmarks = await Bookmark.find({
    userId: { $in: toUserIdCandidates(userId) },
    type: 'drill',
  })
  // ...
  const advancedCount = await Drill.countDocuments({
    _id: { $in: drillIds },
    difficulty: 'advanced',
  }).exec();
  return {
    earned: advancedCount >= 1,
    progress: advancedCount >= 1 ? null : { current: 0, target: 1 },
  };
}
```

Product copy: “saving difficult drills” (`badge.definitions.ts` 63–64; `docs/eklan-app-badges.md` 83–88). Live content: difficulty enum includes `advanced` (`drill.ts` 550–555) but **no advanced rows** in `elkan-db`.

### 2. Badge persistence / evaluation assumes ObjectId user ids (systemic latent break)

```493:520:src/domain/badges/badge.service.ts
static async evaluateAndUnlock(userId: string): Promise<BadgeId[]> {
  await connectToDatabase();
  const uid = new Types.ObjectId(userId);
  const userStreak = await UserStreak.findOne({ userId: uid }).lean().exec();
  // ...
  await UserStreak.findOneAndUpdate(
    { userId: uid },
    { $push: { badges: newBadge } },
    { upsert: true }
  ).exec();
```

```47:52:src/models/user-streak.ts
userId: {
  type: Schema.Types.ObjectId,
  ref: 'User',
  required: true,
  unique: true,
```

Contrast: bookmarks already support UUID via Mixed + helpers (`src/lib/api/user-id.ts`, `src/models/bookmark.ts`). Bookmark route swallows eval failures (`bookmarks/route.ts` 91–96), so UUID learners get bookmarks with empty `badgesUnlocked` and no unlock.

### 3. Drill-complete celebration contract broken

```257:288:src/app/api/v1/drills/[drillId]/complete/route.ts
// Fire-and-forget: recompute metrics, streak, and badges in background
setImmediate(() => {
  void Promise.all([
    // ...
    context.userRole === 'user'
      ? import('@/services/streak.service')
          .then(({ triggerBadgeEvaluation }) => triggerBadgeEvaluation(userId).catch(() => {}))
      : Promise.resolve(),
  ]);
});
// ...
badgesUnlocked: [],
```

Client workaround:

```14:21:src/lib/drill/complete-learner-drill.ts
const result = await drillAPI.complete(drillId, data);
celebrateBadgesFromApiResponse(result);
void fetch('/api/v1/badges/evaluate', { method: 'POST' })
  .then((res) => (res.ok ? res.json() : null))
  .then((json) => celebrateBadgesFromApiResponse(json))
  .catch(() => {});
```

Unlock can still persist and gallery can refresh; modal timing depends on the follow-up evaluate race.

### 4. Duplicate bookmark path skips evaluation and celebration

```74:78:src/app/api/v1/bookmarks/route.ts
if (existing) {
  return NextResponse.json(
    { message: 'Already bookmarked', bookmark: existing },
    { status: 200 }
  );
}
```

```35:41:src/hooks/useDrillBookmarkToggle.ts
if (data.message === "Already bookmarked") {
  toast.info("Already bookmarked");
} else {
  toast.success("Added to bookmarks!");
  celebrateBadgesFromApiResponse(data);
  await queryClient.invalidateQueries({ queryKey: queryKeys.badges.all });
```

Users who bookmarked before the badge system, or who re-toggle, won’t get a celebration from this path (gallery GET can still unlock later if criteria are met).

### 5. Admin library bookmark is not a Master Collector trigger

```1:37:src/app/api/v1/drills/[drillId]/bookmark/route.ts
// POST /api/v1/drills/[drillId]/bookmark - Bookmark drill (shared admin library)
// ... sets Drill.is_bookmarked via DrillService — no triggerBadgeEvaluation
```

---

## Smoke matrix (runtime)

| Badge | Minimal action | Static path | Live data / repro | badgesUnlocked / DB |
|-------|----------------|-------------|-------------------|---------------------|
| Master Collector | Learner bookmark advanced drill | Trigger OK | **Blocked:** 0 advanced drills; intermediate bookmarks do not unlock | DB: 0 unlocks |
| Master Collector (control) | Bookmark intermediate | Correct non-earn | 29 intermediate drill bookmarks | Progress 0/1 |
| First Steps | Pass drill / daily focus | OK | 733 passing drill attempts | 31 unlocks |
| Skill Keeper | Pass daily focus first completion | OK | **0** `daily_focus_completions` | 0 unlocks |
| 7-Day Stretch | 7× ≥5 min days | OK | Hard; 1 unlock exists | 1 unlock |
| Monthly Challenge | 14× ≥5 min same month | OK | No unlocks | unmet |
| Done & Dusted | Complete all week assignments | OK | 25 unlocks | working |
| Déjà Vu | 10 passes on advanced/bookmarked | OK (lenient bookmark rule) | Max 2/10 on bookmarked | unmet |
| Medication Master | 50 unique words ≥70 | OK | 12 unlocks | working |
| Handover Hero | Free-talk handover ≥70 | OK | 11 handover attempts, max 63 | unmet |
| Nightingale | Challenge product / window | OK | 21 challenge users, 21 unlocked | working |

**HTTP learner session:** not available in this audit. Gallery/evaluate behavior inferred from code + DB unlock counts.

---

## False alarms

1. “I saved a hard-feeling intermediate drill and didn’t get Master Collector” — expected under code rules.  
2. “Drill complete response had no badges” — expected from API contract; client evaluate may still celebrate.  
3. “Admin bookmarked a drill in the library” — wrong surface for Master Collector.  
4. Déjà Vu / Monthly / Handover / Skill Keeper at 0 unlocks — primarily unmet criteria or missing activity data, not proven evaluator bugs (except UUID latent issue).

---

## Recommended fixes (ranked, deferred)

1. **Unblock Master Collector (product + content):** Either (a) create/tag real `advanced` drills learners can save, or (b) change criteria to match “difficult” product language (e.g. advanced **or** intermediate, or a dedicated flag). Align copy, docs, and evaluator.  
2. **Make badge persistence UUID-safe:** Use `toUserIdQuery` / Mixed (or dual-write strategy) for `UserStreak.userId` and replace bare `new Types.ObjectId(userId)` in `evaluateAndUnlock`, `getBadgeState`, and ObjectId-only evaluators (`first-steps`, practice aggregation, medication, handover, skill-keeper, etc.).  
3. **Fix drill-complete celebration contract:** Await (or reliably join) badge evaluation and return real `badgesUnlocked` instead of `[]`; keep client evaluate only as fallback.  
4. **Evaluate on idempotent bookmark:** On “Already bookmarked”, still run `triggerBadgeEvaluation` and return `badgesUnlocked` so pre-badge bookmarks and retries can celebrate.  
5. **Tighten docs + secondary criteria clarity:** Document Déjà Vu’s any-bookmark rule; decide whether `handover_receive` counts for Handover Hero; align Nightingale docs with completed-window behavior.  
6. **Tests:** Add evaluator unit/integration tests (Master Collector advanced vs intermediate; UUID userId path; drill-complete response shape). Fix vitest `@/` resolution for `badge.service.test.ts`.  
7. **Ops:** Confirm production `MONGO_URI` database name (`eklan-ai` vs `elkan-db`).

---

## Todo status

| Todo | Status |
|------|--------|
| hypothesis-triage | Completed |
| static-audit | Completed |
| runtime-repro | Completed (DB + ObjectId probe + unit-test attempt; no live authed HTTP session) |
| audit-report | Completed (this document) |
