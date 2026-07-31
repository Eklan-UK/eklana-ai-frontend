# AI-Assisted Drill Creation — Frontend UI Spec
## Eklan | Next.js + Tailwind + shadcn/ui

---

## Status

| Section | Status | Notes |
|---------|--------|-------|
| AI Generation Form | ✅ Built (backend) | Part, Topic, Prompt wired. Student, Drill Type, Difficulty, Completion Date, Duration incorrectly live in separate Drill Settings panel — must be moved into the AI form |
| Drill Builder Auto-fill | ⚠️ Broken | Does not populate for any drill type. Fix pending |
| Import Fallback | ✅ Built + Fixed | All 10 drill types parse correctly. Drill type passed to parser. Header detection fixed |
| Chatbot Sidebar | ✅ Backend built | `/api/v1/drills/ai-chat` endpoint tested. Frontend not yet built (Goodness's scope) |
| AI Generate API | ✅ Built + Deployed | `/api/v1/drills/ai-generate` — OpenAI function calling, all 10 types, Korean translation |
| Navigation links | ⬜ Not done | |

---

## Known Issues / Pending Fixes

- **Drill builder does not populate for any drill type** after AI generation. `handleApplyParsedContent` receives the correct data (confirmed via console log) but does not wire it to the form. Root cause: AI generate returns content directly on `extractedData` (e.g. `extractedData.roleplay_scenes`) while the handler expects it nested inside `items[0]`. Fix needed in both admin and tutor pages for all 10 drill types.
- **Drill Settings panel must be disconnected from the AI flow.** Student, Drill Type, Difficulty, Completion Date, and Duration are currently in the right-hand Drill Settings panel. These fields must be removed from the panel and added directly to the AI Generation Form. The Drill Settings panel should only remain for the manual drill builder flow — the two flows are independent.

---

## Overview

The existing `/tutor/drills/create` and `/admin/drills/create` pages are extended with an AI-first drill creation flow. The existing manual drill builder and import fallback are retained as separate flows.

---

## Full User Flow

```
1. Tutor fills AI Generation Form
        ↓
2. Clicks "Generate with AI"
        ↓
3. POST /api/v1/drills/ai-generate
        ↓
4. AI-generated drill content displayed in a preview card (not the drill builder yet)
   Chatbot sidebar slides in from the right
        ↓
5. Tutor reviews content. If changes needed:
   → Types request in chatbot sidebar
   → POST /api/v1/drills/ai-chat
   → Preview card updates with refined content
   → Repeat until satisfied
        ↓
6. Tutor clicks "Use This Drill" button
        ↓
7. Drill builder populates with the final content
   Tutor can manually edit any field
   Tutor fills in:
     - Drill title (required)
     - Completion date (required)
     - Duration (days)
     - Assign to student (pre-selected from form)
   The following are auto-filled from the AI form:
     - Drill type
     - Difficulty
     - Part
     - Topic
        ↓
8. Tutor clicks "Create Drill for [N] users"
   → POST /api/v1/drills to save
   → POST /api/v1/drills/[drillId]/assign to assign
   → Toast + redirect to drill list
```

---

## Page Layout

```
┌─────────────────────────────────────────────────┬──────────────────────┐
│                  Main Content                   │   Chatbot Sidebar    │
│                  (flex-1)                       │   (slides in right)  │
│                                                 │                      │
│  [AI Generation Form]                           │  [Hidden until AI    │
│  [Generated Content Preview]  ← hidden until    │   generates]         │
│  [Use This Drill button]         AI generates   │                      │
│  [Drill Builder]              ← hidden until    │                      │
│  [Import Fallback]               tutor clicks   │                      │
│  [Action Buttons]                "Use This"     │                      │
└─────────────────────────────────────────────────┴──────────────────────┘
```

---

## Section 1 — AI Generation Form

**Card title:** "Generate Drill with AI"

**Fields (all in this form — NOT in a separate settings panel):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Student | Select dropdown | Yes | Fetch from existing learner list via `useTutorStudents` |
| Drill Type | Select dropdown | Yes | All 10 types: vocabulary, pronunciation, roleplay, matching, definition, grammar, sentence_writing, fill_blank, key_phrases, summary |
| Difficulty | Select dropdown | Yes | beginner, intermediate, advanced |
| Part | Select dropdown | Yes | "Part 1: Communication with Patients", "Part 2: Communication with Colleagues", "Part 3: Communication with Doctors, Families and Friends", "Part 4: Bonus Scenarios" |
| Topic | Select dropdown | Yes | "Handling Emergency/Critical Situation", "Follow-up with Patients", "Admitting a Patient", "Small Talk with a Patient" |
| Context / Scenario | Textarea | Yes | Max 500 chars. Placeholder: "e.g. ICU nurse at Mount Sinai giving handover to incoming nurse" |
| Prompt | Textarea | Yes | Max 1000 chars. Placeholder: "Paste your curriculum prompt here" |

> **Important:** Student, Drill Type, and Difficulty must be removed from the existing Drill Settings right-hand panel for this flow. The AI form and the manual drill builder are independent — the Drill Settings panel only applies to the manual builder.

> **Note:** Part and Topic are currently free-text inputs on staging. Must be changed to dropdowns.

**Submit button:** "Generate with AI" — spinner while loading, disabled during generation.

**On submit:** POST to `/api/v1/drills/ai-generate`:
```json
{
  "drillType": "...",
  "difficulty": "...",
  "part": "Part 1: Communication with Patients",
  "topic": "Handling Emergency/Critical Situation",
  "context": "...",
  "prompt": "...",
  "studentId": "..."
}
```

**On success:**
- Show generated content in preview card below the form
- Open chatbot sidebar
- Show toast: "Drill generated successfully"

**On error:** Show toast with error message.

---

## Section 2 — Generated Content Preview

Shown immediately after AI generates. Displays the raw drill content in a readable format (not the full drill builder UI).

A **"Use This Drill →"** button sits below the preview. Clicking it:
- Populates the drill builder (Section 3) with the final content
- Hides the preview
- Scrolls to the drill builder

---

## Section 3 — Drill Builder (populated on demand)

Hidden until tutor clicks "Use This Drill".

Reuse the **existing drill builder form** exactly — same card layout, same field components per drill type.

Fields pre-populated from AI response. Tutor can edit any field.

**Additional fields tutor must fill here:**
- Drill title (required)
- Completion date (required)
- Duration (days)
- User(s) assignment (pre-selected with student from AI form, tutor can change)

**Auto-filled from AI form (read-only or pre-set):**
- Drill type
- Difficulty
- Part (learning_journey_part)
- Topic (learning_journey_topic)

**Assign button:** "Create Drill for [N] users"
- POST `/api/v1/drills` to save
- POST `/api/v1/drills/[drillId]/assign` to assign with completion date
- On success: toast + redirect to drill list

---

## Section 4 — Import Fallback

**✅ Already built and working.**

Shown below the AI form as a separate section (not collapsible, always visible).

- File upload zone (PDF, Word, Excel, CSV, Text, Markdown)
- Paste from Clipboard button
- Download Template button

Drill type from the selected value in the form is passed to the parser.

---

## Chatbot Sidebar

**Backend:** `/api/v1/drills/ai-chat` — built and tested. ✅
**Frontend:** Not yet built. Goodness's scope.

**Trigger:** Slides in from the right after AI generates. Width: ~380px. Overlays main content, does not push it.

**Header:** "Refine with AI" + close button (X)

**Body:** Scrollable message history. Each message shows role (You / AI) and content.

**Input area (bottom):**
- Textarea
- Send button

**On send:** POST `/api/v1/drills/ai-chat`:
```json
{
  "drillType": "...",
  "currentDrill": { ...current generated content... },
  "messages": [
    { "role": "user", "content": "Make Scene 2 more clinical" }
  ]
}
```

**On success:**
- Update generated content preview with refined content
- Append assistant response to message history
- Show toast: "Drill updated"

Conversation history maintained in component state (not persisted).

---

## API Endpoints

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/v1/drills/ai-generate` | POST | Generate drill content | ✅ Built |
| `/api/v1/drills/ai-chat` | POST | Refine drill via chatbot | ✅ Built |
| `/api/v1/drills/parse-document` | POST | Parse uploaded file | ✅ Built + Fixed |
| `/api/v1/drills/templates/[type]` | GET | Download Excel template | ✅ Built |
| `/api/v1/drills` | POST | Save drill | ✅ Existing |
| `/api/v1/drills/[drillId]/assign` | POST | Assign to student | ✅ Existing |

---

## Routes

- `/tutor/drills/create` ✅
- `/admin/drills/create` ✅

---

## Notes for Dev

- Reuse UI primitives: `Card`, `Button`, `Input`, `Label`, `Textarea`, `Select` from `@/components/ui/`
- Reuse `FileUploadZone`, `ClipboardPaste`, `TemplateDownload` from `@/components/drills/`
- Reuse `useTutorStudents` hook for student dropdown
- Toast via `sonner`
- Chatbot sidebar: new component `src/components/drills/AIChatSidebar.tsx`
- `AI_PARTS` and `AI_TOPICS` constants already defined in the tutor create page — reuse them for the dropdowns
- The AI flow and the manual drill builder flow are independent. Do not share state between them. The Drill Settings right-hand panel (with drill type, difficulty, completion date, duration, user assignment) belongs to the manual builder only. The AI form owns its own copies of those fields.
