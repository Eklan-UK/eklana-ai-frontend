# Mobile Handoff — Drill Completion Celebration (MP3 + Confetti)

> **Prerequisites**: Read [`MOBILE_README.md`](MOBILE_README.md) for auth, error envelope, and React Query conventions.  
> **Related**: [`MOBILE_MY_PLAN.md`](MOBILE_MY_PLAN.md) §8.3 (complete mutation), [`mobile-practice-feedback.md`](mobile-practice-feedback.md) (per-item pass/fail — **not** end-of-drill).  
> **Web source of truth**: [`src/lib/practice-feedback.ts`](../src/lib/practice-feedback.ts) (`playDrillEndCelebration`), [`src/lib/drill/celebration-sound-url.ts`](../src/lib/drill/celebration-sound-url.ts), [`src/hooks/useDrillScoreCelebration.ts`](../src/hooks/useDrillScoreCelebration.ts), [`src/lib/drill/celebration-effects.ts`](../src/lib/drill/celebration-effects.ts)

---

## 1. Overview

When a learner **passes** a drill, the app plays a **celebration MP3** (hosted on Vercel Blob), triggers **success haptics**, and shows **confetti** once.

When the score is a **perfect 100** (`Math.round(score) >= 100`) **and** the drill type is a speech drill (`vocabulary` | `pronunciation` | `grammar` | `roleplay` | `key_phrases`), confetti is **gold** instead of green — mirroring the badge-unlock celebration — **and** a **distinct "crowd applause" MP3** (`CELEBRATION_SOUND_URL_100`) plays instead of the normal pass MP3. Same haptic either way. Matching, listening, fill-blank, and definition keep normal **pass** celebration (green + pass MP3) even at 100% — never gold/applause.

This gold-confetti-plus-perfect-sound combo also fires **mid-item**, while the drill is still in progress, whenever a speech-drill item (SpeechAce word/sentence, key-phrase, roleplay turn) scores a perfect 100 — see §6. Matching / fill-blank correct answers use short success feedback only.

| Layer | Responsibility |
|-------|----------------|
| **API** | `POST /drills/:drillId/complete` returns `effects.soundUrl` + `effects.triggerConfetti` + `effects.confettiVariant` (`'pass' \| 'perfect'`) when `passed: true`. `effects.soundUrl` already reflects the right MP3 for the variant (perfect vs. pass) — clients should not re-derive the URL from score. |
| **Mobile client** | Play that URL via `expo-av`; do **not** hardcode the asset in production (use API URL; keep default constants only as offline fallback). Use `effects.confettiVariant` to pick the confetti color palette — gold for `perfect`, green for `pass`. |

**Scope**: Assigned My Plan drills (`POST /drills/:drillId/complete`) plus mid-item perfect-score celebrations during those same drills. Weekly challenge completion does **not** return `effects` today.

**Not in scope**: Ordinary per-item pass/fail short haptics/tones (non-perfect scores) — see [`mobile-practice-feedback.md`](mobile-practice-feedback.md). Mid-item **perfect** celebrations are covered here (§6), not in that doc.

---

## 2. What changed (June 2026)

| Before | After (web + API) |
|--------|-------------------|
| End-of-drill sound was synthesized Web Audio tones | End-of-drill sound is the **Celebration MP3** from `effects.soundUrl` |
| Complete response: `{ attempt, badgesUnlocked }` | Adds `drillId`, `passed`, optional `effects` |
| Mobile had no server-driven asset | Server config `CELEBRATION_SOUND_URL` controls the URL returned in `effects` |

### 2.1 What changed (August 2026) — gold "perfect score" confetti + distinct perfect sound

| Before | After (web + API) |
|--------|-------------------|
| Pass confetti was always green, regardless of score | Confetti is **gold** when `Math.round(score) >= 100`, green otherwise. |
| Same MP3 (`CELEBRATION_SOUND_URL`) played regardless of score | A perfect score (`Math.round(score) >= 100`) plays a **distinct** MP3 — `CELEBRATION_SOUND_URL_100` (crowd applause) — instead of the normal pass MP3. Same haptic either way. |
| `effects: { soundUrl, triggerConfetti }` | Adds `effects.confettiVariant: 'pass' \| 'perfect'`. `effects.soundUrl` is already the correct MP3 for that variant (server picks it) — don't re-derive it from score. |
| N/A | Trigger rule: speech drill + `passed && Math.round(score) >= 100` → `'perfect'` (gold confetti + perfect MP3), else `'pass'` (green confetti + normal MP3). Non-speech types (`matching`, `listening`, `fill_blank`, `definition`, …) stay `'pass'` even at 100%. |
| Mid-item feedback was short tones only; roleplay per-turn confetti during the drill was always green | **Now in scope**: a perfect mid-item score — `Math.round(itemScore) >= 100` for SpeechAce items (vocab/pronunciation/key-phrases/roleplay) — fires the same gold confetti + perfect MP3 combo **without leaving the drill screen**. Matching / fill-blank correct answers use short success feedback (not perfect). Roleplay non-perfect passes use short success tone only (no green mid-drill confetti). See §6 and §7.1. |

Default assets (when env unset):

```
Normal pass (CELEBRATION_SOUND_URL):    https://mrsxoheopyanhton.public.blob.vercel-storage.com/Celebration%20_Sound.mp3
Perfect 100% (CELEBRATION_SOUND_URL_100): https://mrsxoheopyanhton.public.blob.vercel-storage.com/scottishperson-sound-effect-crowd-applause-and-cheering-237756.mp3
```

Web reads these via [`getCelebrationSoundUrl` / `getPerfectCelebrationSoundUrl`](../src/lib/drill/celebration-sound-url.ts) (server) and `getClientCelebrationSoundUrl` / `getClientPerfectCelebrationSoundUrl` (browser, `NEXT_PUBLIC_*`).

---

## 3. API contract

### 3.1 Endpoint

```http
POST /api/v1/drills/{drillId}/complete
Authorization: Bearer <token>
Content-Type: application/json
```

Request body unchanged — see [`MOBILE_MY_PLAN.md`](MOBILE_MY_PLAN.md) §5. Always send `platform: 'ios' | 'android'` and `performanceReviewSnapshot.passThreshold` when the drill shows a score review.

### 3.2 Success response

```json
{
  "code": "Success",
  "data": {
    "drillId": "674a1b2c3d4e5f6789012345",
    "passed": true,
    "attempt": {
      "id": "674a...",
      "score": 85,
      "timeSpent": 120,
      "completedAt": "2026-06-24T12:00:00.000Z"
    },
    "badgesUnlocked": [],
    "effects": {
      "soundUrl": "https://mrsxoheopyanhton.public.blob.vercel-storage.com/Celebration%20_Sound.mp3",
      "triggerConfetti": true,
      "confettiVariant": "pass"
    }
  }
}
```

`confettiVariant` is `"perfect"` instead of `"pass"` when the drill is a speech type (`supportsPerfectCelebration`) and `Math.round(attempt.score) >= 100`:

```json
"effects": {
  "soundUrl": "https://mrsxoheopyanhton.public.blob.vercel-storage.com/Celebration%20_Sound.mp3",
  "triggerConfetti": true,
  "confettiVariant": "perfect"
}
```

When `passed` is `false`, **`effects` is omitted** — no celebration audio or confetti.

### 3.3 TypeScript types

```ts
export const DEFAULT_CELEBRATION_SOUND_URL =
  'https://mrsxoheopyanhton.public.blob.vercel-storage.com/Celebration%20_Sound.mp3';

/** Perfect-score (100%) celebration MP3 — replaces the normal pass sound when Math.round(score) >= 100. */
export const DEFAULT_PERFECT_CELEBRATION_SOUND_URL =
  'https://mrsxoheopyanhton.public.blob.vercel-storage.com/scottishperson-sound-effect-crowd-applause-and-cheering-237756.mp3';

export type DrillConfettiVariant = 'pass' | 'perfect';

export type DrillCompletionEffects = {
  soundUrl: string;
  triggerConfetti: boolean;
  /** 'perfect' (gold) when Math.round(score) >= 100, else 'pass' (green). */
  confettiVariant: DrillConfettiVariant;
};

export type CompleteDrillResponse = {
  code: 'Success';
  data: {
    drillId: string;
    passed: boolean;
    attempt: {
      id: string;
      score: number;
      timeSpent: number;
      completedAt: string;
    };
    badgesUnlocked?: BadgeUnlockCelebration[];
    effects?: DrillCompletionEffects;
  };
};
```

### 3.4 When `passed` is true (server)

| Condition | `passed` |
|-----------|----------|
| `summaryResults.summaryProvided === true` | `true` (score may be `0`) |
| `listeningResults.completed === true` | `true` |
| Otherwise | `score >= performanceReviewSnapshot.passThreshold` (default **70**) |

Use `data.passed && data.effects` as the gate for celebration — do not re-derive pass from score on the client for effects.

---

## 4. Web timing — mirror on mobile

Web uses **two patterns**. Mobile must match so celebration fires at the same UX moment (not twice).

```mermaid
sequenceDiagram
  participant Learner
  participant Review as ScoreReview_or_CompletionScreen
  participant API as POST_complete

  Note over Learner,API: Pattern A — review-first drills
  Learner->>Review: Finish last item
  Review->>Review: playDrillEndCelebration(fallbackUrl)
  Learner->>API: Tap Continue / Submit
  API-->>Review: attempt saved (no second celebration)

  Note over Learner,API: Pattern B — complete-first drills
  Learner->>API: Submit drill
  API-->>Learner: effects.soundUrl
  Learner->>Review: Completion screen mounts
  Review->>Review: playDrillEndCelebration(effects.soundUrl)
```

### Pattern A — Score review **before** complete API

Celebration when the **performance review** (or fill-blank results screen) appears and the learner **passed**. Complete API runs later when they tap Continue / Submit.

| Drill types | Web hook / component |
|-------------|----------------------|
| Vocabulary, Pronunciation, Key Phrases, Roleplay | `DrillPerformanceReview` → `useDrillScoreCelebration` |
| Fill in the Blank | `useDrillScoreCelebration` on results view |

**Sound URL at this moment**: API not called yet → use `DEFAULT_CELEBRATION_SOUND_URL` (same default the server uses). Web: `getClientCelebrationSoundUrl()` in [`celebration-sound-url.ts`](../src/lib/drill/celebration-sound-url.ts).

**Confetti variant at this moment**: API not called yet → derive client-side from the same overall review score shown in the donut: `Math.round(avgScore) >= 100 ? 'perfect' : 'pass'`. This mirrors web [`DrillPerformanceReview`](../src/components/drills/shared/DrillPerformanceReview.tsx), which passes `avgScore` into `useDrillScoreCelebration`.

**Mobile**: `playDrillEndCelebration({ soundUrl: DEFAULT_CELEBRATION_SOUND_URL, triggerConfetti: true, confettiVariant })` when review mounts with pass. Do **not** celebrate again in complete `onSuccess`.

### Pattern B — Complete API **before** completion screen

Celebration when the **completion screen** mounts after a successful complete call.

| Drill types | Web behavior |
|-------------|--------------|
| Matching, Listening | `completeLearnerDrill` → store `result.data.effects?.soundUrl` → `DrillCompletionScreen` with `celebrate` |
| Definition | Same, only if `completionScore >= 70` |

**Sound URL**: `data.effects.soundUrl` from the complete response.

**Confetti variant**: `data.effects.confettiVariant` from the complete response — do **not** re-derive from score on Pattern B; the server already computed it from `attempt.score`.

**Mobile**: Pass `effects` (including `confettiVariant`) from complete result into the completion screen; call `playDrillEndCelebration(effects)` on mount when `celebrate` is true.

### Drills with no end celebration on web

| Drill | Web |
|-------|-----|
| Grammar, Sentence, Summary | `DrillCompletionScreen` with `celebrate={false}` — no end MP3 (may add later) |
| Failed attempt | `playDrillEndFailure()` on review (synthesized fail tone on web) — see practice-feedback doc |

---

## 5. Mobile implementation

### 5.1 Install

```bash
npx expo install expo-av expo-haptics
```

### 5.2 Shared module — mirror `playDrillEndCelebration`

Suggested: `lib/drill-celebration.ts`

```ts
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import type { DrillCompletionEffects } from '@/types/drills';

export const DEFAULT_CELEBRATION_SOUND_URL =
  'https://mrsxoheopyanhton.public.blob.vercel-storage.com/Celebration%20_Sound.mp3';

let celebrationSound: Audio.Sound | null = null;

/** Unload on screen unmount */
export async function unloadDrillCelebrationSound(): Promise<void> {
  if (!celebrationSound) return;
  try {
    await celebrationSound.unloadAsync();
  } catch {
    /* best-effort */
  }
  celebrationSound = null;
}

// Same gold palette as web BadgeUnlockModal / triggerDrillEndConfetti('perfect').
export const PERFECT_CONFETTI_COLORS = ['#fbbf24', '#f59e0b', '#d97706', '#92400e'];
export const PASS_CONFETTI_COLORS = ['#22c55e', '#16a34a', '#4ade80', '#86efac'];

/**
 * End-of-drill pass: MP3 + success haptic + confetti.
 * Mirrors web `playDrillEndCelebration(soundUrl?, { confettiVariant })`.
 * `confettiVariant` defaults to `'pass'` (green); pass `'perfect'` (gold) when
 * `Math.round(score) >= 100` — see §4 for how to derive it per pattern.
 */
export async function playDrillEndCelebration(
  effects?: DrillCompletionEffects | null,
): Promise<void> {
  const soundUrl = effects?.soundUrl?.trim() || DEFAULT_CELEBRATION_SOUND_URL;
  const triggerConfetti = effects?.triggerConfetti ?? true;
  const confettiVariant = effects?.confettiVariant ?? 'pass';

  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    /* simulators */
  }

  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    await unloadDrillCelebrationSound();
    const { sound } = await Audio.Sound.createAsync(
      { uri: soundUrl },
      { shouldPlay: true },
    );
    celebrationSound = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        void sound.unloadAsync();
        if (celebrationSound === sound) celebrationSound = null;
      }
    });
  } catch {
    /* CDN / network — haptics still run */
  }

  if (triggerConfetti) {
    const colors =
      confettiVariant === 'perfect' ? PERFECT_CONFETTI_COLORS : PASS_CONFETTI_COLORS;
    // Your confetti imperative API, e.g. confettiRef.current?.start({ colors })
  }
}
```

### 5.3 Hook — mirror `useDrillScoreCelebration`

Suggested: `hooks/useDrillScoreCelebration.ts`

```ts
import { useEffect } from 'react';
import { playDrillEndCelebration } from '@/lib/drill-celebration';
import { playPracticeFeedback } from '@/lib/practice-feedback'; // failure: haptics only or short tone

export function useDrillScoreCelebration(
  passed: boolean | null | undefined,
  effects?: DrillCompletionEffects | null,
  score?: number,
) {
  useEffect(() => {
    if (passed == null) return;
    if (passed) {
      const confettiVariant =
        typeof score === 'number' && Math.round(score) >= 100 ? 'perfect' : 'pass';
      void playDrillEndCelebration({ ...effects, confettiVariant } as DrillCompletionEffects);
    } else {
      void playPracticeFeedback('failure');
    }
  }, [passed, effects, score]);
}
```

Wire this on **Pattern A** score-review screens when `avgScore >= passThreshold`, passing `avgScore` as the third argument so a perfect score fires gold confetti (mirrors web `useDrillScoreCelebration(passed, celebrationSoundUrl, score)`).

### 5.4 Complete helper — Pattern B

```ts
export async function completeLearnerDrill(
  queryClient: QueryClient,
  drillId: string,
  body: CompleteDrillBody,
): Promise<CompleteDrillResponse> {
  const res = await apiClient.post<CompleteDrillResponse>(
    `/drills/${drillId}/complete`,
    body,
  );
  // Badge / cache invalidation (mirror web completeLearnerDrill)
  await queryClient.invalidateQueries({ queryKey: ['learner-drills'] });
  await queryClient.invalidateQueries({ queryKey: ['progress-scorecard'] });
  return res.data;
}
```

**Do not** call `playDrillEndCelebration` inside `completeLearnerDrill` for Pattern A drills — that would double-play.

For Pattern B, return `effects` to the caller:

```ts
const result = await completeLearnerDrill(queryClient, drillId, body);
setCelebrationEffects(result.data.effects);
// Navigate to completion screen; screen calls playDrillEndCelebration(celebrationEffects) on mount
```

### 5.5 Completion screen — Pattern B

```tsx
export function DrillCompletionScreen({
  celebrate,
  celebrationEffects,
}: {
  celebrate?: boolean;
  celebrationEffects?: DrillCompletionEffects;
}) {
  useEffect(() => {
    if (celebrate) void playDrillEndCelebration(celebrationEffects);
    return () => {
      void unloadDrillCelebrationSound();
    };
  }, [celebrate, celebrationEffects]);
  // ...
}
```

---

## 6. Per-item vs end-of-drill audio

| Moment | Sound |
|--------|-------|
| Each word / match / MCQ graded — non-perfect pass or fail | Short feedback (haptics primary; optional local tone) — [`mobile-practice-feedback.md`](mobile-practice-feedback.md) |
| Each speech-drill item graded — **perfect** (`Math.round(itemScore) >= 100` for vocab / pronunciation / key-phrases / roleplay) | **Gold confetti + perfect MP3** (web: `playPerfectItemCelebration()`) — same combo as end-of-drill, fired without leaving the drill screen (§7.1) |
| Matching correct pair / fill-blank correct blank | Short **success** feedback only — not gold/applause |
| Fill-blank wrong blank | Failure feedback — never the celebration MP3 |
| **End of drill (pass)** | **Celebration MP3** from `effects.soundUrl` (this doc) — perfect MP3 only when `confettiVariant === 'perfect'` (speech drills at 100%); non-speech completes stay pass even at 100% |
| End of drill (fail) | Failure haptics / short fail cue — not the celebration MP3 |

---

## 7. Confetti

When `triggerConfetti === true`, fire confetti in the same call as the MP3 (web: [`src/lib/drill-celebration.ts`](../src/lib/drill-celebration.ts) `triggerDrillEndConfetti`). Start within ~100ms of audio play.

### 7.1 Gold vs green (perfect score)

Use `confettiVariant` to pick the color palette. **Gold replaces green on a perfect score — never fire both.**

| `confettiVariant` | Colors | Web reference |
|--------------------|--------|----------------|
| `'pass'` (default) | `#22c55e`, `#16a34a`, `#4ade80`, `#86efac` | `triggerDrillEndConfetti('pass')` |
| `'perfect'` | `#fbbf24`, `#f59e0b`, `#d97706`, `#92400e` (same gold as badge unlock) | `triggerDrillEndConfetti('perfect')`, [`BadgeUnlockModal.tsx`](../src/components/badges/BadgeUnlockModal.tsx) |

Web also uses a slightly richer burst for `'perfect'` (`particleCount: 200`, `spread: 120` vs `150`/`100` for `'pass'`) — optional to mirror exactly, but keep the color swap.

**Trigger rule**: speech drill (`supportsPerfectCelebration`) + `passed && Math.round(score) >= 100` → `'perfect'`; otherwise `'pass'`. Same haptic in both cases — the confetti color **and** the MP3 both switch on `'perfect'` (`CELEBRATION_SOUND_URL_100` instead of `CELEBRATION_SOUND_URL`; see §2.1).

**Mid-item**: the identical gold-confetti + perfect-MP3 combo fires for a perfect single-item score on speech drills while the drill is still active (§6) — e.g. web's `playPerfectItemCelebration()` calls `triggerDrillEndConfetti('perfect')` plus the perfect MP3, in place of the normal per-item success tone. Matching / fill-blank correct answers and roleplay non-perfect passes stay on short success feedback (no green mid-drill confetti). Mobile needs a mid-drill confetti host mounted on speech drill screens (not just the end/review screen) to support this — see §10.

---

## 8. Error and edge cases

| Case | Behavior |
|------|----------|
| `passed: false`, no `effects` | No celebration |
| `soundUrl` fails to load | Fail silently; haptics still run; do not block navigation |
| Pattern A + Pattern B on same drill | **Avoid** — pick one celebration point per drill type (see §4) |
| Badge unlock UI | Separate from drill `effects` |
| Weekly challenge complete | No `effects` — guard optional chaining |

---

## 9. Testing checklist

- [ ] **Pattern A**: Vocabulary pass → MP3 + confetti on score review; complete API does not replay sound
- [ ] **Pattern A**: Fill-blank fail → failure feedback only, no MP3
- [ ] **Pattern B**: Matching → MP3 uses `effects.soundUrl` from complete response on completion screen
- [ ] **Pattern B**: Definition score &lt; 70 → no celebration
- [ ] Summary / Listening → `passed: true` and effects from API
- [ ] **Pattern A**: Score review with `Math.round(avgScore) >= 100` on speech drills → gold confetti + perfect MP3, not green + normal MP3
- [ ] **Pattern B**: Matching/Listening/Definition complete with score 100 → `effects.confettiVariant === 'pass'` (green pass celebration, not applause)
- [ ] **Pattern A**: Fill-blank results at 100% → pass celebration only (`allowPerfectCelebration: false`)
- [ ] Score 99 (rounds to 99) and 99.5 (rounds to 100) on speech drills → confirm the `Math.round` boundary matches web
- [ ] Mid-item: SpeechAce item (vocab / pronunciation / key-phrases / roleplay) at exactly 100 → gold confetti + perfect MP3 fires immediately, without leaving the drill; below 100 but passing → short success tone only (no green mid-drill confetti on roleplay non-perfect passes)
- [ ] Mid-item: matching correct pair → short success feedback only (not gold/applause)
- [ ] Mid-item: fill-blank correct answer → short success feedback; wrong answer → failure feedback
- [ ] Physical device: audio with silent switch (iOS) per product rules
- [ ] Unmount completion screen / drill screen → sound unloaded, mid-drill confetti host unmounted cleanly
- [ ] Weekly challenge complete → no crash when `effects` missing

---

## 10. Files to touch (mobile repo)

| File | Change |
|------|--------|
| `types/drills.ts` | `DrillCompletionEffects` (add `confettiVariant`), `CompleteDrillResponse`, `DEFAULT_CELEBRATION_SOUND_URL`, `DEFAULT_PERFECT_CELEBRATION_SOUND_URL` |
| `lib/drill-celebration.ts` | **New** — `playDrillEndCelebration` (branch to perfect MP3 when `confettiVariant === 'perfect'` and no explicit URL), `playPerfectItemCelebration` (mid-item), `unloadDrillCelebrationSound` |
| `hooks/useDrillScoreCelebration.ts` | **New** — Pattern A; pick perfect client URL when `Math.round(score) >= 100` and `allowPerfectCelebration` (default true); fill-blank passes `false` |
| `lib/complete-learner-drill.ts` | Return full response; no celebration for Pattern A |
| Score review components | `useDrillScoreCelebration(passed, celebrationSoundUrl, score)` |
| Matching / Listening / Definition completion | Pattern B: pass `effects` (incl. `confettiVariant`) to completion screen — server stays `'pass'` even at 100% for these types |
| Vocabulary / Pronunciation / Key-phrases / Roleplay drill screens | Mid-item: call `playPerfectItemCelebration()` on a perfect item score instead of the normal success tone (§6); needs a confetti host mounted on the drill screen itself, not just the review/completion screen |
| Matching / Fill-blank drill screens | Mid-item: `playPracticeFeedback("success")` on correct; fill-blank Pattern A `allowPerfectCelebration: false` |
| `my-plan/drills/[id]/completed.tsx` | No celebration (web does not celebrate there) |

---

## 11. Web file map

| Web file | Mobile equivalent |
|----------|-------------------|
| `src/lib/practice-feedback.ts` → `playDrillEndCelebration`, `playPerfectItemCelebration` | `lib/drill-celebration.ts` → `playDrillEndCelebration`, `playPerfectItemCelebration` |
| `src/lib/drill/celebration-sound-url.ts` | `DEFAULT_CELEBRATION_SOUND_URL` / `DEFAULT_PERFECT_CELEBRATION_SOUND_URL` constants |
| `src/hooks/useDrillScoreCelebration.ts` | `hooks/useDrillScoreCelebration.ts` |
| `src/components/drills/shared/DrillPerformanceReview.tsx` | Score review screen |
| `src/components/drills/shared/DrillCompletionScreen.tsx` | Completion screen (Pattern B) |
| `src/components/drills/VocabularyDrill.tsx`, `PronunciationDrill.tsx`, `KeyPhrasesDrill.tsx`, `RoleplayDrill.tsx` | Same drill screens — mid-item `playPerfectItemCelebration()` calls (§6) |
| `src/components/drills/MatchingDrill.tsx`, `FillBlankDrill.tsx` | Mid-item success feedback; fill-blank `allowPerfectCelebration: false` |
| `src/lib/drill/celebration-effects.ts` (`supportsPerfectCelebration`) | Server gate + mobile `types/drill.types.ts` mirror — clients read `effects` from API |
| `src/app/api/v1/drills/[drillId]/complete/route.ts` | Same endpoint; passes `drillType` into `buildDrillCompletionEffects` |
