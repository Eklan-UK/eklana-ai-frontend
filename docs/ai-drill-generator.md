# AI-Assisted Drill Creation — Implementation Reference

Covers the backend, service layer, document parser, and frontend components for the AI drill generation feature. For the full UI flow and wireframes see `docs/ai_drill_creation_ui_spec_updated.md`.

---

## 1. Overview

Tutors and admins can generate drill content for all 10 drill types using GPT-5.5 via a two-step flow:

1. **Generate** — submit a form with drill type, difficulty, mission/topic, context, and a curriculum prompt. GPT-5.5 returns structured JSON content matching the drill's Mongoose schema.
2. **Refine** — chat with the AI in a sidebar to adjust the content. Each message sends the full conversation history and the current drill state. The AI either returns an updated drill (JSON) or answers conversationally (plain text).

Both endpoints are restricted to `admin` and `tutor` roles.

---

## 2. Data flow

```
AIGenerationForm submit
        │
        ▼
POST /api/v1/drills/ai-generate
        │
        │  generateDrill() — OpenAI function calling
        │  tool_choice: 'required' → guaranteed structured output
        │
        ▼
AIGeneratedPreview shown + AIChatSidebar opens
        │
        ├── Tutor refines via chat
        │         POST /api/v1/drills/ai-chat
        │         full message history + current drill sent each turn
        │         JSON response → drill update | plain text → conversational reply
        │
        ▼
"Use This Drill" → drill builder populates + sidebar closes
        │
        ▼
Tutor fills title, completion date, assigns student
        │
        ▼
POST /api/v1/drills → POST /api/v1/drills/[id]/assign
```

**Import flow (separate, no AI):**

```
File upload → POST /api/v1/drills/parse-document (drillType in FormData)
        │
        │  correct parser selected by drill type (not inferred from column count)
        │
        ▼
handleApplyParsedContent → drill builder fields populated
```

---

## 3. Files

| File | Purpose |
|------|---------|
| `src/app/api/v1/drills/ai-generate/route.ts` | `POST /api/v1/drills/ai-generate` — validates request, calls `generateDrill()`, returns structured content |
| `src/app/api/v1/drills/ai-chat/route.ts` | `POST /api/v1/drills/ai-chat` — full conversation refinement; distinguishes JSON drill updates from conversational replies |
| `src/domain/drills/ai-drill-generator.service.ts` | `generateDrill(params)` — OpenAI function calling with one typed tool per drill type; `tool_choice: 'required'`; `max_completion_tokens: 4000` |
| `src/app/api/v1/drills/templates/[type]/route.ts` | Downloadable Excel templates for all 10 drill types |
| `src/app/api/v1/drills/parse-document/route.ts` | Document import parser — `drillType` query param added; correct parser selected per type |
| `src/services/document-parser.service.ts` | Excel/CSV parsers for all 10 drill types; header detection fixes; roleplay metadata rows |
| `src/components/drills/AIGenerationForm.tsx` | Form: Students (multi-select), Drill Type, Difficulty, Mission, Topic, Context (max 1000 chars), Prompt (max 2000 chars) |
| `src/components/drills/AIGeneratedPreview.tsx` | Preview card after generation — renders content per drill type; "Export as Excel" and "Use This Drill" buttons |
| `src/components/drills/AIChatSidebar.tsx` | Slide-in sidebar; maintains `latestDrill` state; typed indicator; minimise/expand toggle |
| `src/app/(admin)/admin/drills/create/page.tsx` | AI flow wired in for admin |
| `src/app/(tutor)/tutor/drills/create/page.tsx` | AI flow wired in for tutor |
| `src/constants/ai-drill.ts` | `AI_DRILL_TYPES` and `AI_DIFFICULTIES` option arrays used by the form |

---

## 4. API

### `POST /api/v1/drills/ai-generate`

Generate structured drill content for a given drill type.

**Required fields:**

| Field | Type | Notes |
|-------|------|-------|
| `drillType` | string | One of the 10 supported types |
| `prompt` | string | Curriculum prompt — truncated to 1000 chars before being sent to GPT-5.5 |
| `part` | string | Learning journey part ID (e.g. `"clinical_communication"`) |
| `topic` | string | Topic within the part |

**Optional fields:**

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `difficulty` | string | `"intermediate"` | Passed to GPT-5.5 in the user message |
| `context` | string | `""` | Clinical scenario description — truncated to 500 chars |
| `studentId` | string | — | Informational only; not sent to GPT-5.5 |
| `studentIds` | string[] | — | Informational only |

**Response:**

```json
{
  "code": "Success",
  "message": "Drill content generated successfully",
  "data": { /* drill type-specific content object */ }
}
```

The `data` object is the parsed function call arguments — shape varies by drill type (see Section 6).

**Auth:** `withRole(["admin", "tutor"])`

---

### `POST /api/v1/drills/ai-chat`

Refine an existing drill via a chat conversation.

**Required fields:**

| Field | Type | Notes |
|-------|------|-------|
| `messages` | `{ role: "user"\|"assistant"; content: string }[]` | Full conversation history — sent on every request |
| `currentDrill` | object | Latest drill state; embedded in the system prompt as JSON |
| `drillType` | string | Embedded in the system prompt |

**Response:**

```json
{ "data": { "drill": object | null, "message": string | null } }
```

- If GPT-5.5 returns valid JSON → `{ drill: <updated object>, message: null }`
- If GPT-5.5 returns plain text → `{ drill: null, message: "<text>" }`

The distinction is made by attempting `JSON.parse` on the raw response — no separate classification call.

**Auth:** `withRole(["admin", "tutor"])`

**Model:** `gpt-5.5` — no `max_completion_tokens` set on this endpoint; the system prompt embeds the full current drill JSON and instructs GPT-5.5 to return either plain text or a complete updated drill object, never partial diffs.

---

## 5. AI generation service (`ai-drill-generator.service.ts`)

`generateDrill(params)` selects the tool for the requested drill type and calls the OpenAI chat completions API with:

```
model: 'gpt-5.5'
tool_choice: 'required'
max_completion_tokens: 4000
```

**System prompt enforces two rules:**
1. No copying words directly from the prompt or context — use them only to understand the scenario and learning objectives, then generate original clinical content.
2. Korean translations (`wordTranslation`, `translation`) are generated only for `vocabulary` drills. All other types must omit translation fields.

**User message format:**
```
Generate <drillType> drill content.
Difficulty: <difficulty>
Context: <context (max 500 chars)>
<prompt (max 1000 chars)>
```

The function call arguments are parsed directly from `tool_calls[0].function.arguments`. If GPT-5.5 skips the tool call and returns text content instead (rare), `JSON.parse` is attempted on the text as a fallback.

---

## 6. Generated content schemas (function calling tools)

One OpenAI function tool is defined per drill type. `tool_choice: 'required'` forces GPT-5.5 to call the correct tool — the response is always a valid JSON object matching the schema below.

### `vocabulary`

```ts
{
  target_sentences: Array<{
    word: string;
    wordTranslation: string;   // Korean only — all other types omit
    text: string;
    translation: string;       // Korean
  }>
}
```

### `pronunciation`

```ts
{
  pronunciation_items: Array<{
    sound: string;    // IPA phoneme, e.g. "/θ/"
    word: string;
    sentence: string;
  }>
}
```

### `roleplay`

```ts
{
  student_character_name: string;
  ai_character_names: string[];
  drill_intro: string;
  roleplay_scenes: Array<{
    scene_name: string;
    context: string;
    dialogue: Array<{
      speaker: string;   // "student" or "ai_0", "ai_1" — never a character name
      text: string;
    }>;
  }>;
}
```

### `matching`

```ts
{
  matching_pairs: Array<{
    left: string;
    right: string;
    leftTranslation: string;
    rightTranslation: string;
  }>
}
```

### `definition`

```ts
{
  definition_items: Array<{
    word: string;
    hint: string;
  }>
}
```

### `grammar`

```ts
{
  grammar_items: Array<{
    pattern: string;
    hint: string;
    example: string;
  }>
}
```

### `sentence_writing`

```ts
{
  sentence_writing_items: Array<{
    word: string;
    hint: string;
  }>
}
```

### `fill_blank`

```ts
{
  fill_blank_items: Array<{
    context?: string;   // situational setup shown before the sentence
    sentence: string;       // MUST contain "___" for each blank — enforced in tool description
    translation: string;
    blanks: Array<{
      position: number;     // 0-based
      correctAnswer: string;
      options: string[];
      hint: string;
    }>;
  }>
}
```

The `sentence` field description explicitly states: *"The sentence MUST contain '___' (three underscores) where the blank should appear. Never write the answer into the sentence."*

### `key_phrases`

```ts
{
  key_phrase_items: Array<{
    prompt: string;
    respondentName: string;
    options: string[];
    correctAnswer: string;   // must exactly match one entry in options[]
  }>
}
```

### `summary`

```ts
{
  article_title: string;
  article_content: string;
}
```

---

## 7. Document parser fixes (`document-parser.service.ts`)

The Excel/CSV import parser (`POST /api/v1/drills/parse-document`) was updated alongside the AI feature:

| Fix | Detail |
|-----|--------|
| Drill type passed from frontend | `drillType` sent in FormData; correct parser selected by type instead of inferring from column count |
| Excel parsers added for missing types | `pronunciation`, `definition`, `grammar`, `sentence_writing`, `summary`, `listening`, `fill_blank`, `key_phrases` |
| `looksLikeHeader` digit check | Changed from "contains any digit" to "purely numeric string" — headers like "Option 2" now detected correctly |
| New header keywords | `sound`, `prompt`, `respondent`, `title`, `article`, `content`, `option` |
| Roleplay Excel format | Supports metadata rows (`student_character`, `ai_character`, `drill_intro`, `context`) before the `Speaker / Text / Translation` dialogue rows |
| Auto re-parse on type change | File re-parses automatically when the drill type dropdown changes with a file already loaded |

---

## 8. Excel export (`AIGeneratedPreview.tsx`)

"Export as Excel" builds rows in-memory using the `xlsx` library and downloads a filled workbook. Column layouts per type:

| Drill type | Columns |
|------------|---------|
| `vocabulary` | Word, Word Translation, Sentence, Sentence Translation |
| `pronunciation` | Sound, Word, Sentence |
| `matching` | Left, Right, Left Translation, Right Translation |
| `roleplay` | Metadata rows (student_character / ai_character / drill_intro / context) then Speaker, Text, Translation |
| `definition` | Word, Hint/Definition |
| `grammar` | Pattern, Hint, Example |
| `sentence_writing` | Word, Hint |
| `fill_blank` | Context, Sentence, Correct Answer, Option 2, Option 3, Hint |
| `key_phrases` | Prompt, Respondent, Option 1–4, Correct Answer |
| `summary` | Title, Content |

---

## 9. Frontend components

### `AIGenerationForm`

Controlled form component. Props: `values`, `onChange`, `onStudentIdsChange`, `students`, `isGenerating`, `onGenerate`.

Two variants: `"page"` (renders inside a white card with heading) and `"modal"` (fields only, used inside a modal wrapper).

**Fields:**
- **Students** — searchable multi-select with "select all shown" checkbox; selected students shown as removable chips
- **Drill Type** — select from `AI_DRILL_TYPES` constant
- **Difficulty** — select from `AI_DIFFICULTIES` constant
- **Mission / Topic** — `LearningJourneyPartTopicFields` shared component; topics filter per mission from `learning-journey.catalog.ts`; changing Mission clears Topic
- **Context / Scenario** — textarea, max 1000 chars (enforced client-side with `slice`)
- **Prompt** — textarea, max 2000 chars

Form is independent of the Drill Settings panel (which is the manual builder flow).

### `AIGeneratedPreview`

Renders generated drill content per drill type after generation. Two action buttons:

- **Export as Excel** — builds and downloads a filled workbook (see Section 8)
- **Use This Drill** — calls `onUseDrill()` which populates the drill builder and closes the chat sidebar

### `AIChatSidebar`

Slide-in panel from the right. Maintains its own `latestDrill` state — updated after each successful drill refinement and sent as `currentDrill` on every subsequent request.

- Full conversation history is accumulated in `messages` state and sent on every request
- A typing indicator (animated dots) is shown while the AI generates
- Minimise/expand toggle collapses the panel to a header bar
- If the API returns `drill: object`, `onDrillUpdated` is called and `latestDrill` is updated
- If the API returns `message: string`, the text is appended as an assistant message with no drill update
- "Use This Drill" from the preview calls `onClose` which closes the sidebar

---

## 10. Known issues / pending at handoff

| Issue | Detail |
|-------|--------|
| Drill builder does not populate after AI generation | `handleApplyParsedContent` expects data nested in `items[0]`; AI generate returns content directly on `extractedData` (e.g. `extractedData.roleplay_scenes`). Fix needed in both admin and tutor create pages for all 10 drill types |
| Roleplay builder population | When AI generates `roleplay_scenes` directly on `extractedData` (not in `items[0]`), the roleplay drill builder does not populate. Same root cause as above |
| Navigation links not added | Links to AI create pages not yet added to the admin/tutor sidebar nav |
| Student context / drill history memory excluded | Full spec (including planned per-student memory and past drill history context) is in `docs/ai_drill_creation_ui_spec_updated.md`; not built in MVP |
| ai-chat has no `max_completion_tokens` | Unlike ai-generate (4000 tokens), the chat endpoint does not set a token limit — long drills embedded in the system prompt could approach context limits for complex drill types |
