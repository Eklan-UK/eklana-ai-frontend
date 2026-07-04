# AI-Assisted Drill Creation — Full Implementation Reference

Covers additions built on top of the MVP. For the base generation flow, tool schemas, chat sidebar, and document parser see `docs/ai-drill-generator.md`.

---

## 1. Overview

The full implementation extends the MVP with four capabilities injected into the AI generation pipeline:

| Addition | What it adds |
|----------|-------------|
| **Student context** | Per-student profile (role, unit, proficiency, goals) sent to GPT-5.5 alongside weaknesses aggregated live from drill history |
| **Prompt templates** | Admin/tutor-authored template strings stored per `drillType + topic + part`, prepended to the user message at generation time |
| **Drill history memory** | Last 10 drill assignments for the student summarised and injected so GPT-5.5 avoids repetition and ensures progression |
| **Weekly work view** | Endpoint that groups a student's drill assignments by calculated week number — no stored Week model |

All four feed into the existing `POST /api/v1/drills/ai-generate` call via the `generateDrill()` service. The MVP route, service, and tool schemas are unchanged.

---

## 2. Student Context

### Model — `src/models/studentContext.ts`

| Field | Type | Notes |
|-------|------|-------|
| `studentId` | ObjectId | Ref to `User`; unique index |
| `nativeLanguage` | string | |
| `professionalRole` | string | e.g. `"registered_nurse"` |
| `hospitalUnit` | string | e.g. `"ICU"` |
| `country` | string | |
| `proficiencyLevel` | string | e.g. `"intermediate"` |
| `goals` | string[] | Free-text learning goals |
| `simulationWeaknesses` | string[] | Manually authored by tutor/admin |

### Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/v1/students/[studentId]/context` | admin, tutor | Fetch context for a student |
| `POST` | `/api/v1/students/[studentId]/context` | admin, tutor | Create or update (upsert) context |

### Injection into `ai-generate`

When `studentId` is present in the generation request, the route fetches the matching `StudentContext` document and passes it to `generateDrill()` as `studentContext`. It appears in the user message as:

```
Student Context: { ...studentContext fields }
```

### Weaknesses — not stored

`drillWeaknesses` is computed on every request — it is never persisted. The route calls:

```ts
aggregateWeaknesses(studentId, subscriptionActivatedAt)
```

from `src/domain/challenges/weakness-aggregator.ts`. `subscriptionActivatedAt` (from the student's `User` document) is the anchor date; only drill results after that date are included. The resulting array is passed to `generateDrill()` as `drillWeaknesses` and injected into the user message as:

```
Student Weaknesses to target: [ ...weakness objects ]
```

---

## 3. Prompt Templates

### Model — `src/models/promptTemplate.ts`

| Field | Type | Notes |
|-------|------|-------|
| `drillType` | string | One of the 10 supported types |
| `topic` | string | Learning journey topic |
| `part` | string | Learning journey part ID |
| `template` | string | Template body with `{{placeholders}}` |

Compound unique index on `drillType + topic + part` — one template per combination.

### Placeholders

| Placeholder | Resolved to |
|-------------|-------------|
| `{{difficulty}}` | `params.difficulty` |
| `{{context}}` | `params.context` (pre-truncation) |
| `{{topic}}` | `params.topic` |
| `{{part}}` | `params.part` |

### Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/v1/prompt-templates` | admin, tutor | List all templates |
| `POST` | `/api/v1/prompt-templates` | admin, tutor | Create a new template |
| `PUT` | `/api/v1/prompt-templates/[templateId]` | admin only | Update an existing template |

### Injection into `ai-generate`

At generation time the route queries `PromptTemplate` by `{ drillType, topic, part }`. If a match is found, placeholders are resolved and the result is passed to `generateDrill()` as `templatePrompt`. It is prepended as the first item in the user message, before the standard generation instruction:

```
<resolved template>
Generate <drillType> drill content.
Difficulty: ...
Context: ...
<prompt>
```

If no template matches, `templatePrompt` is `undefined` and the user message is unchanged from the MVP.

---

## 4. Drill History Memory

At generation time, the route fetches the student's last 10 drill assignments by querying `drill_assignments` joined with `drills`, sorted by `assignedAt` descending. Each assignment is mapped to a minimal summary object:

```ts
{
  type: string;
  title: string;
  difficulty: string;
  learning_journey_topic: string;
  learning_journey_part: string;
}
```

This array is passed to `generateDrill()` as `drillHistory` and injected into the user message as:

```
Previous drills created for this student (avoid repeating content): [ ...summaries ]
```

GPT-5.5 uses this to avoid reusing the same vocabulary, scenarios, or grammar patterns and to ensure content progresses appropriately.

---

## 5. Weekly Work View

### Endpoint

```
GET /api/v1/students/[studentId]/weeks
```

**Auth:** `withRole(["admin", "tutor"])`

### Calculation — no Week model

Weeks are computed on the fly from `drill_assignments`. For each assignment:

```ts
const anchor = user.subscriptionActivatedAt ?? user.createdAt;
const weekNumber = Math.max(1, Math.ceil((assignedAt - anchor) / 7_days_in_ms));
```

If `subscriptionActivatedAt` is `null`, `createdAt` is used as the fallback anchor. The minimum clamped value is `1` — assignments before the anchor (edge case) land in week 1.

### Response shape

```json
{
  "code": "Success",
  "data": {
    "weeks": [
      {
        "weekNumber": 1,
        "assignments": [
          {
            "_id": "...",
            "drillId": "...",
            "title": "...",
            "drillType": "vocabulary",
            "difficulty": "intermediate",
            "status": "completed",
            "assignedAt": "2025-01-06T..."
          }
        ]
      }
    ]
  }
}
```

Weeks are returned in ascending order. Weeks with no assignments are omitted.

---

## 6. Updated `generateDrill()` signature

The service function accepts three additional optional parameters added for the full implementation:

| Parameter | Type | Injected as |
|-----------|------|-------------|
| `studentContext` | `object` | `Student Context: ...` in user message |
| `drillWeaknesses` | `object[]` | `Student Weaknesses to target: ...` in user message |
| `templatePrompt` | `string` | Prepended before the standard user message |
| `drillHistory` | `object[]` | `Previous drills created for this student ...: ...` in user message |

All four are optional. When absent the user message is identical to the MVP. Model, `tool_choice`, and `max_completion_tokens` are unchanged (`gpt-5.5`, `'required'`, `4000`).

---

## 7. Files

| File | Purpose |
|------|---------|
| `src/models/studentContext.ts` | `StudentContext` Mongoose model |
| `src/models/promptTemplate.ts` | `PromptTemplate` Mongoose model |
| `src/app/api/v1/students/[studentId]/context/route.ts` | `GET` / `POST` student context |
| `src/app/api/v1/prompt-templates/route.ts` | `GET` / `POST` prompt templates |
| `src/app/api/v1/prompt-templates/[templateId]/route.ts` | `PUT` prompt template (admin only) |
| `src/app/api/v1/students/[studentId]/weeks/route.ts` | `GET` weekly work view |
| `src/domain/challenges/weakness-aggregator.ts` | `aggregateWeaknesses()` — live weakness computation from drill results |
| `src/domain/drills/ai-drill-generator.service.ts` | Extended with `studentContext`, `drillWeaknesses`, `templatePrompt`, `drillHistory` params |

---

## 8. Testing status

All endpoints confirmed working via Postman against a production-like dataset:

- `GET/POST /api/v1/students/[studentId]/context` — create and retrieve student context
- `GET/POST /api/v1/prompt-templates` and `PUT /api/v1/prompt-templates/[templateId]` — full CRUD
- `POST /api/v1/drills/ai-generate` with `studentContext`, `drillWeaknesses`, `templatePrompt`, and `drillHistory` all injected
- `GET /api/v1/students/[studentId]/weeks` — tested against a student with 5 weeks of existing drill assignments; week grouping and anchor fallback confirmed correct

---

## 9. Not yet built

| Item | Notes |
|------|-------|
| Dashboard hierarchy UI | Student list → student view → weekly work → drill builder; no frontend screens exist yet |
| Student context setup form | First-time context entry UI for tutors/admins; only the API is built |
| Navigation links | No sidebar nav links added for context, template, or weekly work pages |
