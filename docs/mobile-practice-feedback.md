# Mobile Handoff — Practice Pass/Fail Feedback (Sounds + Haptics)

> **Prerequisites**: Read [`MOBILE_README.md`](MOBILE_README.md) first for auth, error envelope, shared types, and stack conventions.  
> **Web source of truth**: [`src/lib/practice-feedback.ts`](../src/lib/practice-feedback.ts) and drill / practice screens listed below.

---

## 1. Feature overview

When a learner **passes** a practice section (correct answer, pronunciation pass, etc.), the app should play a short **success** cue and trigger **success haptics**. When they **fail**, play a **failure** cue and trigger **error haptics**. A **neutral** kind exists on the shared helper for light progress cues if needed; Fill-in-the-Blank does **not** use it (see table below).

The web app uses synthesized Web Audio tones plus `navigator.vibrate()` for **in-drill** feedback. On native mobile, **haptics are the primary feedback**; optional short sounds can be added with `expo-av` if product wants parity with web audio.

> **End-of-drill celebration (MP3 + confetti)** is a separate flow. When the learner passes a full drill, web plays a hosted celebration MP3 — not synthesized tones. Mirror that using [`MOBILE_DRILL_CELEBRATION.md`](MOBILE_DRILL_CELEBRATION.md).

---

## 2. Shared helper (mobile)

Install:

```bash
npx expo install expo-haptics
```

Suggested module: `lib/practice-feedback.ts`

```ts
import * as Haptics from 'expo-haptics';

export type PracticeFeedbackKind = 'success' | 'failure' | 'neutral';

export async function playPracticeFeedback(kind: PracticeFeedbackKind): Promise<void> {
  try {
    if (kind === 'neutral') {
      // Light impact — shorter than success/error notification haptics
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      await Haptics.notificationAsync(
        kind === 'success'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error
      );
    }
  } catch {
    /* best-effort — simulators may not support haptics */
  }

  // Optional: add short success/fail/neutral tones via expo-av here if desired.
}
```

Call `void playPracticeFeedback('success' | 'failure' | 'neutral')` at the same logical points as the web app (next to existing toasts / confetti — do not replace them).

---

## 3. Pass/fail rules (keep thresholds in sync with web)

| Surface | Success | Failure | Neutral / notes |
|---------|---------|---------|-----------------|
| Vocabulary / Pronunciation / Roleplay drills | pronunciation `score >= 65` | below 65% | — |
| Key Phrases drill | correct choice **and** pronunciation `>= 65%` | wrong choice **or** pronunciation below 65% | Per-item only — web already fires `playPracticeFeedback('success' \| 'failure')` once per graded attempt; mobile must match. End-of-drill celebration is separate. |
| Matching drill | correct pair | incorrect pair | — |
| Fill-in-the-blank drill | **`success` on each blank option select** (dropdown/select change to a non-empty option); end-of-drill final submit `score >= 70%` (celebration doc) | below 70% on final submit | **Not on Next, Previous, or Submit** for per-item progress |
| Unscored drills (definition, grammar, sentence, summary, listening) | successful final submit only | no failure sound | — |
| Eklan Free Talk | `gradeResult.overallScore >= 60` when result screen shows | `< 60` |
| Daily Focus | `isCorrect === true` on answer submit | incorrect answer |
| Standalone pronunciation assignment | `attempt.passed` (70% threshold) | not passed |
| Pronunciation problem words | word score `>= 70%` after analysis | below 70% |

**Free Talk competency cutoff**: `60` matches web `scoreToCompetencyLevel` (“Safe & Effective Communicator” and above).

---

## 4. Web file → mobile screen mapping

Mirror these trigger points when implementing the equivalent mobile drill runners:

| Web file | When to fire |
|----------|----------------|
| `src/components/drills/VocabularyDrill.tsx` | After SpeechAce analysis per word/sentence |
| `src/components/drills/PronunciationDrill.tsx` | After SpeechAce analysis per word/sentence |
| `src/components/drills/RoleplayDrill.tsx` | After each student turn pronunciation analysis |
| `src/components/drills/KeyPhrasesDrill.tsx` | After each item is graded (choice + pronunciation) — web already fires success/fail; mirror exactly |
| `src/components/drills/MatchingDrill.tsx` | On each match attempt |
| `src/components/drills/FillBlankDrill.tsx` | `playPracticeFeedback('success')` on each blank option select (non-empty); **not** on Next / Previous / Submit; end-of-drill pass/fail via celebration hook on results |
| `src/components/drills/DefinitionDrill.tsx` | On successful completion submit |
| `src/components/drills/GrammarDrill.tsx` | On successful completion submit |
| `src/components/drills/SentenceDrill.tsx` | On successful completion submit |
| `src/components/drills/SummaryDrill.tsx` | On successful summary submit |
| `src/components/drills/ListeningDrill.tsx` | On successful completion submit |
| `src/hooks/useDrillScoreCelebration.ts` | **End-of-drill pass** on score review (MP3 — see [`MOBILE_DRILL_CELEBRATION.md`](MOBILE_DRILL_CELEBRATION.md)) |
| `src/components/drills/shared/DrillCompletionScreen.tsx` | **End-of-drill pass** on completion screen (matching, listening, definition) |
| `src/app/(student)/account/practice/free-talk/session/page.tsx` | When grade result arrives (`phase === 'result'`) |
| `src/app/(student)/account/daily-focus/[id]/page.tsx` | On each answer submit |
| `src/app/(student)/account/pronunciations/[pronunciationId]/page.tsx` | After assignment attempt result |
| `src/app/(student)/account/practice/pronunciation/[slug]/page.tsx` | After word pronunciation analysis |

**Out of scope**: Bookmark pronunciation practice uses tiered info toasts (60/80), not binary pass/fail.

---

## 5. Platform notes

- **iOS Safari (web PWA)**: vibration is limited; native `expo-haptics` is more reliable on the mobile app.
- **Android**: both web vibration and native haptics work well.
- **Simulators**: haptics are often no-ops; test on a physical device.
- **User mute toggle**: not implemented on web yet; add a shared preference key later if product requests it.

---

## 6. Testing checklist

- [ ] Vocabulary drill: pass and fail a word pronunciation
- [ ] Roleplay: pass and fail a student line
- [ ] Key Phrases: wrong MCQ → fail; correct + low pronunciation → fail; correct + pass → success (once each)
- [ ] Matching: correct and incorrect pair
- [ ] Fill-blank: selecting a blank option → success; clearing to "Select..." → no sound; Next / Previous / Submit → no per-item sound
- [ ] Fill-blank: final submit above and below 70% (end celebration / failure)
- [ ] Free Talk: grade at 60+ and below 60
- [ ] Daily Focus: correct and incorrect answer
- [ ] Pronunciation assignment: pass and fail attempt
- [ ] Verify haptics do not fire twice for the same Free Talk grade (use a ref guard like web)
- [ ] End-of-drill MP3 + confetti — see [`MOBILE_DRILL_CELEBRATION.md`](MOBILE_DRILL_CELEBRATION.md) checklist
