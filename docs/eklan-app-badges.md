# Eklan App Badges

Achievement badges learners unlock through practice, consistency, and drill milestones. Each badge has copy for **before** unlock (how to earn it) and **after** unlock (outcome + humorous line).

---

## Badge overview

| # | Badge name | Icon | How to earn |
|---|------------|------|-------------|
| 1 | First Steps | 👣 | Complete your first passing drill (score of 70 or more) |
| 2 | 7-Day Stretch | 🔥 | Practise for at least 5 minutes every day for 7 consecutive days |
| 3 | Done & Dusted | 🏆 | Complete all drills for the week |
| 4 | Déjà Vu | 🔭 | Practise a difficult drill at least 10 times |
| 5 | Monthly Challenge | 📅 | Practise for at least 5 minutes every day for 14 consecutive days within a single month |
| 6 | Master Collector | 📚 | Save a drill to revisit and master later |
| 7 | Medication Master | 💊 | Correctly practise 50 unique vocabulary words or definitions |
| 8 | Handover Hero | 📋 | Complete a passing giving- or receiving-handover Free Talk |
| 9 | Nightingale Award | 👑 | Complete Zero Pause Challenge |
| 10 | Skill Keeper | 🔄 | Complete your assigned daily refresh |

---

## Badge details

### 1. First Steps 👣

**Before completion:** You earn this award for completing your first passing drill (score of 70 or more).

**After completion**

- **Outcome description:** You've earned this award for completing your first passing drill (score of 70 or more) and officially started your journey toward confident nursing communication.
- **Humorous line:** Looks like someone's been busy.

---

### 2. 7-Day Stretch 🔥

**Before completion:** You earn this award for practising for at least 5 minutes every day for 7 consecutive days.

**After completion**

- **Outcome description:** You've earned this award for practicing for at least 5 minutes every day for 7 consecutive days.
- **Humorous line:** At this point, your phone expects to see you.

---

### 3. Done & Dusted 🏆

**Before completion:** You earn this award for completing all drills for the week.

**After completion**

- **Outcome description:** You've earned this award for completing all drills for the week.
- **Humorous line:** And they all lived happily ever after... or not. Next?

---

### 4. Déjà Vu 🔭

**Before completion:** You earn this award for practising a difficult drill at least 10 times.

**After completion**

- **Outcome description:** You've earned this award for practising a difficult drill at least 10 times.
- **Humorous line:** If this drill could talk, it would know your voice by now.

**Implementation note:** “Difficult” means a drill the learner has bookmarked (`type: 'drill'`) **or** a drill with `difficulty === 'advanced'`. Passes on either surface count toward the 10-attempt target.

---

### 5. Monthly Challenge 📅

**Before completion:** You earn this award for practicing at least 5 minutes everyday for 14 consecutive days within a single month.

**After completion**

- **Outcome description:** You've earned this award for practicing at least 5 minutes everyday for 14 consecutive days within a single month.
- **Humorous line:** Not every hero wears a cape... Turns out consistency is a superpower.

---

### 6. Master Collector 📚

**Before completion:** You earn this award for saving a drill to revisit and master later.

**After completion**

- **Outcome description:** You've earned this award for saving a drill to revisit and master later.
- **Humorous line:** This drill is already getting nervous. We love seeing it.

---

### 7. Medication Master 💊

**Before completion:** You earn this award for correctly practising 50 unique vocabulary words or definitions.

**After completion**

- **Outcome description:** You've earned this award for correctly practising 50 unique vocabulary words or definitions.
- **Humorous line:** Metoprolol is even scared of you now... You're in charge.

---

### 8. Handover Hero 📋

**Before completion:** You earn this award for completing a passing giving- or receiving-handover Free Talk.

**After completion**

- **Outcome description:** You've earned this award for completing a passing giving- or receiving-handover Free Talk.
- **Humorous line:** Clear. Concise. Complete. Look at you!

---

### 9. Nightingale Award 👑

**Before completion:** You earn this award for completing Zero Pause Challenge.

**After completion**

- **Outcome description:** You've earned this award for completing Zero Pause Challenge.
- **Humorous line:** Florence is looking down on you and smiling.

**Implementation note:** Also awarded when the learner has a completed Challenge window (`zeroPauseDate` set and `zeroPauseEndDate` in the past), so the badge remains after the Challenge period ends.

---

### 10. Skill Keeper 🔄

**Before completion:** You earn this award for completing your assigned daily refresh.

**After completion**

- **Outcome description:** You've earned this award for completing your assigned daily refresh.
- **Humorous line:** You keep showing up. That's what stars do.

---

## Unlock rules (v1 implementation)

Technical unlock criteria used by [`src/domain/badges/badge.service.ts`](../src/domain/badges/badge.service.ts). Product copy above may differ slightly in wording.

| badgeId | Rule |
|---------|------|
| `first-steps` | ≥1 passing drill attempt (`score >= 70`) or first daily-focus completion (`score >= 70`) |
| `seven-day-stretch` | 7 consecutive UTC days with ≥5 minutes practice (sum of drill `timeSpent` + daily-focus `timeSpent` per day) |
| `done-and-dusted` | All drill assignments with `dueDate` in the current ISO week (Mon–Sun UTC) have `status === 'completed'` |
| `deja-vu` | ≥10 passing attempts on the same drill that is bookmarked (`type: 'drill'`) **or** has `difficulty === 'advanced'` |
| `monthly-challenge` | 14 consecutive UTC days within the same calendar month with ≥5 minutes practice per day |
| `master-collector` | ≥1 learner bookmark with `type: 'drill'` (any difficulty) |
| `medication-master` | 50 unique vocabulary/definition words with per-word `score >= 70` across drill attempts |
| `handover-hero` | ≥1 free-talk attempt with `scenarioType` of `handover` or `handover_receive` and `gradeResult.overallScore >= 70` |
| `nightingale-award` | User `zeroPauseProducts` includes `'challenge'`, **or** completed Challenge window (`zeroPauseDate` set and `zeroPauseEndDate` in the past) |
| `skill-keeper` | ≥1 daily-focus first completion with `score >= 70` |

**API:** `GET /api/v1/badges` — returns all badges, progress, and `featuredBadge` (most recently unlocked, or first locked).

**Home UI:** Student home header shows `featuredBadge` icon; links to `/account/badges`.

Legacy `week-warrior` streak badges are mapped to `seven-day-stretch` on read.
