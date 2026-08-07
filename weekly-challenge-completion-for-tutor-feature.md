# Weekly Challenge Completion — What the Tutor Feature Needs

## Goal
Tutors need to see whether a student has completed their weekly challenge for the current (or a given) week.

## Data source
Collection: `weekly_challenges`
Model: `WeeklyChallengeModel` (`src/models/weekly-challenge.ts`)

## Confirmed fields (verified directly against the model)

- `learnerId` — the student
- `weekStartDate` — which week this challenge belongs to. **Note:** this is set once at generation time and is not re-validated against any "current week" logic elsewhere — treat it as the source of truth for which week a document belongs to.
- `content.drillSequence` — array of the generated drill items for that week. **Do not hardcode a length of 4** — always use `content.drillSequence.length` as the denominator. Nothing in the schema enforces a fixed count.
- `completedItemIndexes` — array of indices (into `content.drillSequence`) that the student has completed
- `status` — generation status (`'ready'` at minimum; used to distinguish a fully-generated challenge from one still being built)

## How completion is currently checked elsewhere in the codebase

`src/scripts/generate-due-challenges.ts` reads this exact field to decide whether a student has *started* their challenge, so it can avoid overwriting one that's in progress:

```ts
const existing = await WeeklyChallengeModel.findOne({
  learnerId: learner._id,
  weekStartDate,
});

if (existing && (existing.completedItemIndexes?.length ?? 0) > 0) {
  // student has started — don't touch it
}
```

## Verified — no existing service function for this

There is **no existing function** in `src/domain/challenges/` that computes completion status for a learner (checked directly — no `getCompletionStatus`, `isChallengeComplete`, or equivalent exists). The tutor feature will need to write this logic fresh; it should live as a small service function rather than inline in the route, since the same "is this student's challenge complete" question will likely be needed in more than one place over time.

## Still open — flag to the dev, don't guess

- Whether `completedItemIndexes` values are guaranteed unique and in-range, or could theoretically contain duplicates/out-of-range indices — the schema doesn't enforce this, so defensive code (e.g. `new Set(completedItemIndexes).size`) is safer than trusting raw `.length`.
- What exactly triggers an index being added to `completedItemIndexes` (finished vs. passed vs. something else) — trace whichever route/service writes to this field before assuming "completed" means "passed."

## What the tutor feature needs to build

For a given student (and optionally a given week):

1. **Fetch the challenge**: `WeeklyChallengeModel.findOne({ learnerId, weekStartDate })`
2. **Compute status**:
   - Not started: `completedItemIndexes.length === 0`
   - In progress: `0 < completedItemIndexes.length < content.drillSequence.length`
   - Fully completed: `completedItemIndexes.length === content.drillSequence.length`
3. **Handle the "no challenge exists yet" case** — a student may not have a `weekly_challenges` document for the current week at all if:
   - They haven't hit their personal "Day 7" yet that week
   - Generation hasn't run for them (check `status`)
   - This should render distinctly from "0 completed" — it's "not available yet," not "not started"

## Recommended endpoint shape

```
GET /api/v1/tutor/students/[studentId]/weekly-challenge?weekStartDate=...
```

Response:
```json
{
  "exists": true,
  "weekStartDate": "2026-08-03T00:00:00.000Z",
  "totalDrills": 4,
  "completedCount": 2,
  "status": "in_progress" // "not_started" | "in_progress" | "completed" | "not_available"
}
```

For a tutor dashboard showing multiple students at once, this likely needs a bulk variant — confirm with the dev whether he's building a single-student view or a roster view, since a bulk endpoint (`studentIds[]`) would avoid N+1 queries.

## Things to verify before building (not confirmed in this doc)

- Exact shape of `content.drillSequence` items and whether `completedItemIndexes` values are guaranteed unique/in-range
- Whether there's already a `getWeeklyChallengeHistory`-style service function that could be reused instead of querying the model directly (check `src/domain/challenges/` for an existing service layer before writing new query logic)
- Timezone handling for `weekStartDate` — confirm it's always UTC-midnight-normalized before matching
