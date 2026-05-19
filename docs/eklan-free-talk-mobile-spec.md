# Eklan Free Talk — Mobile Implementation Specification

> **Version:** 1.0 · **Date:** May 2026  
> **Purpose:** Single source of truth for the React Native / Expo team to implement an identical Free Talk experience to the web app.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication & Subscription Gate](#2-authentication--subscription-gate)
3. [Backend API Routes](#3-backend-api-routes)
   - 3.1 [GET /api/v1/ai/free-talk/scenarios](#31-get-apiv1aifree-talkscenarios)
   - 3.2 [GET /api/v1/ai/free-talk/greeting](#32-get-apiv1aifree-talkgreeting)
   - 3.3 [POST /api/v1/ai/free-talk](#33-post-apiv1aifree-talk)
   - 3.4 [POST /api/v1/ai/free-talk/tts](#34-post-apiv1aifree-talktts)
   - 3.5 [GET /api/v1/ai/free-talk/attempts](#35-get-apiv1aifree-talkattempts)
   - 3.6 [POST /api/v1/ai/free-talk/attempts](#36-post-apiv1aifree-talkattempts)
   - 3.7 [GET /api/v1/admin/learners/[learnerId]/free-talk-attempts](#37-get-apiv1adminlearnerslearneridfreе-talk-attempts)
   - 3.8 [GET /api/v1/admin/free-talk/scenarios](#38-get-apiv1adminfree-talkscenarios)
   - 3.9 [POST /api/v1/admin/free-talk/scenarios](#39-post-apiv1adminfree-talkscenarios)
   - 3.10 [DELETE /api/v1/admin/free-talk/scenarios/[id]](#310-delete-apiv1adminfree-talkscenariosid)
4. [Data Models](#4-data-models)
   - 4.1 [FreeTalkScenario (Mongoose)](#41-freetalkscenarion-mongoose)
   - 4.2 [FreeTalkAttempt (Mongoose)](#42-freetalkattempti-mongoose)
   - 4.3 [Shared TypeScript types](#43-shared-typescript-types)
   - 4.4 [FreeTalkScenarioType enum](#44-freetalkscenariotype-enum)
5. [Student Web Flow](#5-student-web-flow)
   - 5.1 [Hub page](#51-hub-page)
   - 5.2 [Session page](#52-session-page)
6. [Admin Web Flow](#6-admin-web-flow)
   - 6.1 [Scenario create form](#61-scenario-create-form)
   - 6.2 [Scenario list with expand/delete](#62-scenario-list-with-expanddelete)
   - 6.3 [Learner Free Talk attempts component](#63-learner-free-talk-attempts-component)
7. [Services & Utilities](#7-services--utilities)
   - 7.1 [ai.service.ts — Free Talk methods](#71-aiservicets--free-talk-methods)
   - 7.2 [gemini.service.ts — grading pipeline](#72-geminiservicets--grading-pipeline)
   - 7.3 [free-talk-history.ts — localStorage schema & merge](#73-free-talk-historyts--localstorage-schema--merge)
   - 7.4 [free-talk-scenario-lists.ts — normalise helper](#74-free-talk-scenario-liststs--normalise-helper)
8. [SSE Grading Stream Protocol](#8-sse-grading-stream-protocol)
9. [Mobile Implementation Guidance](#9-mobile-implementation-guidance)
   - 9.1 [API call sequence](#91-api-call-sequence)
   - 9.2 [Audio recording on iOS & Android](#92-audio-recording-on-ios--android)
   - 9.3 [Transcription upload](#93-transcription-upload)
   - 9.4 [SSE streaming on mobile](#94-sse-streaming-on-mobile)
   - 9.5 [Attempt persistence (AsyncStorage / MMKV)](#95-attempt-persistence-asyncstorage--mmkv)
   - 9.6 [TTS playback](#96-tts-playback)
   - 9.7 [Suggested screen & component breakdown](#97-suggested-screen--component-breakdown)

---

## 1. Overview

**Eklan Free Talk** is a premium, scenario-based clinical communication practice feature for nursing students. Each session presents the learner with a real-world ICU/ward scenario. The learner either speaks or types a response, the recording is transcribed by Gemini, and the text is graded by Gemini against a scenario-specific clinical rubric. Detailed narrative feedback and a structured grade (7 behaviours, 0–100 score, competency level) are streamed back to the client.

### High-level flow

```
Hub (scenario list) → Session: load scenario + TTS
                    → Student responds (voice or text)
                    → Transcribe audio (POST /transcribe)
                    → Stream grading (POST /free-talk) via SSE
                    → Display result + persist attempt (POST /attempts)
                    → Next scenario | Try again | Done
```

### Premium gate

All student-facing Free Talk endpoints require a **Pro subscription** (HTTP `402` if unsubscribed). Admin endpoints require the `admin` or `tutor` role.

---

## 2. Authentication & Subscription Gate

| Endpoint category | Auth method | Access requirement |
|---|---|---|
| Student API (`/api/v1/ai/free-talk/*`) | Session cookie (`withPremium` middleware) | Authenticated + Pro subscription |
| Admin API (`/api/v1/admin/free-talk/*`) | Session cookie (`withRole`) | Role: `admin` |
| Admin learner view | Session cookie (`withRole`) | Role: `admin` or `tutor` |

**HTTP 402** is returned when the subscription is absent. Mobile apps must catch this and redirect to the subscription/paywall screen.

---

## 3. Backend API Routes

### 3.1 `GET /api/v1/ai/free-talk/scenarios`

Returns an ordered list of all scenario summaries for cycling in the student flow.

**Auth:** Pro required  
**Method:** GET  
**Query params:** none

**Response (200)**

```json
{
  "success": true,
  "scenarios": [
    {
      "id": "6649aae5f3a2c100124d8abc",
      "title": "Worsening Abdominal Pain",
      "scenarioType": "handover"
    }
  ]
}
```

**Error responses**

| Status | Condition |
|---|---|
| 402 | No Pro subscription |
| 404 | No scenarios configured |
| 503 | DB error |

**Mobile notes:** Call once when entering the session screen. Cache the list in memory for the duration of the session to enable Next/Previous navigation without re-fetching.

---

### 3.2 `GET /api/v1/ai/free-talk/greeting`

Load one full scenario (background, task, useful phrases, include list, hint). Also works without `scenarioId` to return a **random** scenario (legacy / random-pick callers).

**Auth:** Pro required  
**Method:** GET  
**Query params:**

| Param | Required | Description |
|---|---|---|
| `scenarioId` | Optional | MongoDB ObjectId string. Omit for a random pick. |

**Response (200)**

```json
{
  "success": true,
  "scenario": {
    "id": "6649aae5f3a2c100124d8abc",
    "title": "Worsening Abdominal Pain",
    "situation": "Sarah Thompson is a 42-year-old...\n\nYou are handing over Sarah Thompson to the next nurse.",
    "hint": "You are handing over Sarah Thompson to the next nurse.",
    "usefulPhrases": [
      "Her pain increased overnight.",
      "I'd like to hand over Sarah Thompson."
    ],
    "include": [
      "Her current pain level",
      "Vitals and monitoring",
      "Pending investigations"
    ],
    "scenarioType": "handover",
    "background": "Sarah Thompson is a 42-year-old...",
    "task": "You are handing over Sarah Thompson to the next nurse."
  }
}
```

> **Note:** `situation` = `background + "\n\n" + task` concatenated. The client uses `situation` for display and TTS; `background` and `task` are raw fields also included.

**Error responses**

| Status | Condition |
|---|---|
| 400 | Invalid `scenarioId` format |
| 402 | No Pro subscription |
| 404 | Scenario not found / none configured |
| 503 | DB error |

**Mobile notes:** Always call with `scenarioId` from the scenario list. After the scenario loads, immediately kick off TTS pre-fetch in parallel (see §3.4).

---

### 3.3 `POST /api/v1/ai/free-talk`

Submit the student's text response for grading. Returns a **Server-Sent Events (SSE) stream** with narrative feedback followed by a final `metadata` chunk containing the structured grade.

**Auth:** Pro required  
**Method:** POST  
**Content-Type:** `application/json`  
**Max duration:** 300 s

**Request body**

```json
{
  "userResponse": "I'd like to hand over Sarah Thompson...",
  "scenarioId": "6649aae5f3a2c100124d8abc"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `userResponse` | string | ✅ | Non-empty, trimmed |
| `scenarioId` | string | ✅ | Valid MongoDB ObjectId |

**Response headers**

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**SSE stream format** — see [§8 SSE Grading Stream Protocol](#8-sse-grading-stream-protocol) for full details.

**Error responses**

| Status | Body | Condition |
|---|---|---|
| 400 | `{ success: false, message: "..." }` | Missing/invalid fields |
| 402 | `{ success: false, message: "..." }` | No Pro subscription |
| 404 | `{ success: false, message: "..." }` | Scenario not found |
| 500 | `{ success: false, message: "..." }` | AI service error (incl. 429 quota) |

---

### 3.4 `POST /api/v1/ai/free-talk/tts`

Generate TTS audio for any text using Gemini's native TTS (voice: **Kore**). Returns a **WAV audio body** directly.

**Auth:** Pro required  
**Method:** POST  
**Content-Type:** `application/json`  
**Max duration:** 60 s

**Request body**

```json
{ "text": "Sarah Thompson is a 42-year-old patient..." }
```

| Field | Type | Constraints |
|---|---|---|
| `text` | string | Non-empty, max 2000 chars |

**Response (200)**

```
Content-Type: audio/wav
Cache-Control: no-cache

<binary WAV body>
```

The WAV file is raw PCM (24 kHz, 16-bit, mono) wrapped in a RIFF header.

**Error responses**

| Status | Condition |
|---|---|
| 400 | Missing/empty text or text > 2000 chars |
| 402 | No Pro subscription |
| 500 | TTS error (incl. quota) |

**Mobile notes:** Use this to read the scenario `situation` text aloud and optionally the `hint` text. Pre-fetch during scenario load (parallel to the scenario JSON fetch) so playback is instant.

---

### 3.5 `GET /api/v1/ai/free-talk/attempts`

Paginated list of the signed-in learner's Free Talk attempts (most recent first).

**Auth:** Pro required  
**Method:** GET  
**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | 30 | Max items per page (1–100) |
| `cursor` | string | — | ObjectId cursor for the next page (from previous `nextCursor`) |

**Response (200)**

```json
{
  "success": true,
  "attempts": [
    {
      "id": "664abc123",
      "scenarioId": "6649aae5f3a2c100124d8abc",
      "scenarioTitle": "Worsening Abdominal Pain",
      "scenarioType": "handover",
      "feedbackText": "You covered the patient's pain level clearly...",
      "gradeResult": {
        "overallScore": 71,
        "competencyLevel": "Developing Communicator",
        "behaviours": [
          { "id": 1, "name": "Gives concise and focused report", "result": "full", "score": 1 },
          { "id": 2, "name": "Organizes information logically", "result": "partial", "score": 0.5 }
        ],
        "rawScore": 4.5,
        "maxScore": 7
      },
      "audioUrl": "https://res.cloudinary.com/...",
      "audioMimeType": "audio/webm;codecs=opus",
      "durationMs": 12500,
      "usedVoice": true,
      "completedAt": "2026-05-18T16:00:00.000Z"
    }
  ],
  "nextCursor": "664abc000"
}
```

`nextCursor` is `null` when there are no more pages.

---

### 3.6 `POST /api/v1/ai/free-talk/attempts`

Persist a completed graded attempt. Optionally includes the audio recording as a multipart upload; the server stores audio to Cloudinary.

**Auth:** Pro required  
**Method:** POST  
**Max duration:** 120 s

#### Without audio (JSON body)

```
Content-Type: application/json
```

```json
{
  "scenarioId": "6649aae5f3a2c100124d8abc",
  "scenarioTitle": "Worsening Abdominal Pain",
  "scenarioType": "handover",
  "feedbackText": "You covered the patient's pain level clearly...",
  "gradeResult": {
    "overallScore": 71,
    "competencyLevel": "Developing Communicator",
    "behaviours": [...],
    "rawScore": 4.5,
    "maxScore": 7
  },
  "durationMs": 12500,
  "usedVoice": false
}
```

#### With audio (multipart/form-data)

```
Content-Type: multipart/form-data
```

| Field | Type | Description |
|---|---|---|
| `payload` | string (JSON) | Same JSON object as above, serialized as a string |
| `audio` | File | Audio recording (max 15 MB) |

The server uploads the audio to Cloudinary under `eklan/free-talk/attempts/` and stores the resulting URL in `audioUrl`.

**Payload schema (Zod)**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `scenarioId` | string | ✅ | 1–200 chars |
| `scenarioTitle` | string | ✅ | 1–500 chars |
| `scenarioType` | string | ✅ | 1–200 chars |
| `feedbackText` | string | — | max 200,000 chars, default `""` |
| `gradeResult` | object\|null | — | See grade schema |
| `durationMs` | integer | — | 0–3,600,000 ms |
| `usedVoice` | boolean | — | default `false` |

**Response (200)**

```json
{
  "success": true,
  "attempt": { ...same shape as GET attempts row... }
}
```

**Error responses**

| Status | Condition |
|---|---|
| 400 | Validation error / audio > 15 MB |
| 402 | No Pro subscription |
| 500 | Save error |

---

### 3.7 `GET /api/v1/admin/learners/[learnerId]/free-talk-attempts`

Admin/tutor view of a specific learner's Free Talk attempts.

**Auth:** Role `admin` or `tutor` required  
**Method:** GET  
**Path param:** `learnerId` — MongoDB ObjectId  
**Query params:** `limit` (default 100, max 200)

**Response (200)**

```json
{
  "code": "Success",
  "data": {
    "attempts": [ ...same shape as learner GET... ],
    "nextCursor": null
  }
}
```

**Error responses**

| Status | Code | Condition |
|---|---|---|
| 400 | `ValidationError` | Invalid learnerId |
| 404 | `NotFound` | Learner not found or access denied |
| 500 | `ServerError` | DB error |

---

### 3.8 `GET /api/v1/admin/free-talk/scenarios`

List all scenarios (full detail, sorted by newest first).

**Auth:** Role `admin` required  
**Method:** GET

**Response (200)**

```json
{
  "code": "Success",
  "data": [
    {
      "_id": "6649aae5f3a2c100124d8abc",
      "title": "Worsening Abdominal Pain",
      "background": "Sarah Thompson is a 42-year-old...",
      "task": "You are handing over Sarah Thompson...",
      "include": ["Her current pain level", "Vitals and monitoring"],
      "usefulPhrases": ["Her pain increased overnight."],
      "scenarioType": "handover",
      "hint": "Hand over this patient to the incoming nurse.",
      "createdAt": "2026-05-01T10:00:00.000Z",
      "updatedAt": "2026-05-01T10:00:00.000Z"
    }
  ]
}
```

---

### 3.9 `POST /api/v1/admin/free-talk/scenarios`

Create a new scenario.

**Auth:** Role `admin` required  
**Method:** POST  
**Content-Type:** `application/json`

**Request body**

```json
{
  "title": "Worsening Abdominal Pain",
  "scenarioType": "handover",
  "background": "Sarah Thompson is a 42-year-old...",
  "task": "You are handing over Sarah Thompson...",
  "include": ["Her current pain level", "Vitals"],
  "usefulPhrases": ["Her pain increased overnight."],
  "hint": "Hand over this patient."
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `title` | string | ✅ | 1–200 chars |
| `scenarioType` | enum | ✅ | See §4.4 |
| `background` | string | ✅ | Non-empty |
| `task` | string | ✅ | Non-empty |
| `include` | string\|string[]\|null | — | Normalised to `string[]` |
| `usefulPhrases` | string\|string[]\|null | — | Normalised to `string[]` |
| `hint` | string | — | Defaults to `""` |

**Response (201)**

```json
{ "code": "Success", "data": { ...full scenario document... } }
```

---

### 3.10 `DELETE /api/v1/admin/free-talk/scenarios/[id]`

Delete a scenario.

**Auth:** Role `admin` required  
**Method:** DELETE  
**Path param:** `id` — MongoDB ObjectId

**Response (200)**

```json
{ "code": "Success", "message": "Scenario deleted" }
```

**Error responses**

| Status | Code | Condition |
|---|---|---|
| 400 | `ValidationError` | Invalid id |
| 404 | `NotFound` | Scenario not found |
| 500 | `ServerError` | DB error |

---

## 4. Data Models

### 4.1 `FreeTalkScenario` (Mongoose)

MongoDB collection: `freetalkscenarios`

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | ObjectId | auto | |
| `title` | string | ✅ | Trimmed |
| `background` | string | ✅ | Clinical context |
| `task` | string | ✅ | What the student must do |
| `include` | string[] | — | Admin-defined content bullets, default `[]` |
| `usefulPhrases` | string[] | — | Helpful phrases for the student, default `[]` |
| `scenarioType` | FreeTalkScenarioType enum | ✅ | See §4.4 |
| `hint` | string | — | Shown under "Your Turn", default `""`. Falls back to `task` when empty. |
| `createdBy` | ObjectId (ref: User) | — | Admin who created |
| `createdAt` | Date | auto | timestamps: true |
| `updatedAt` | Date | auto | timestamps: true |

> **`include` and `usefulPhrases` normalisation:** These fields are stored as `string[]` but the admin UI allows pasting free-form multiline text. The server normalises any incoming string (or legacy single-string DB rows) by splitting on newlines and trimming. Mobile should treat them as a clean `string[]` from the API.

---

### 4.2 `FreeTalkAttempt` (Mongoose)

MongoDB collection: `free_talk_attempts`

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | ObjectId | auto | |
| `learnerId` | ObjectId (ref: User) | ✅ | Indexed |
| `scenarioId` | string | ✅ | Scenario `_id` as string |
| `scenarioTitle` | string | ✅ | Denormalised for display |
| `scenarioType` | string | ✅ | Denormalised |
| `feedbackText` | string | — | Full AI narrative feedback, default `""` |
| `gradeResult` | object\|null | — | See §4.3 |
| `audioUrl` | string | — | Cloudinary CDN URL |
| `audioPublicId` | string | — | Cloudinary public ID |
| `audioMimeType` | string | — | e.g. `audio/webm;codecs=opus` |
| `durationMs` | number | — | Recording duration in milliseconds |
| `usedVoice` | boolean | — | `true` if student used the microphone |
| `createdAt` | Date | auto | |
| `updatedAt` | Date | auto | |

Indexes:
- `learnerId` (single)
- `{ learnerId: 1, createdAt: -1 }` (compound)

---

### 4.3 Shared TypeScript types

```typescript
// Grade result — stored in FreeTalkAttempt.gradeResult
type FreeTalkAttemptGradeResult = {
  overallScore: number;       // 0–100, normalised from rawScore/maxScore
  competencyLevel: string;    // See competency levels table below
  behaviours: FreeTalkAttemptGradeBehaviour[];
  rawScore: number;           // Sum of individual behaviour scores
  maxScore: number;           // Count of relevant behaviours (not_applicable excluded)
};

type FreeTalkAttemptGradeBehaviour = {
  id: number;                           // 1–7
  name: string;                         // Human-readable behaviour name
  result: "full" | "partial" | "none";  // not_applicable filtered out before saving
  score: number;                        // full=1, partial=0.5, none=0
};

// History entry stored locally (AsyncStorage equivalent)
type FreeTalkHistoryEntryV1 = {
  v: 1;
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  scenarioType: string;
  completedAt: string;           // ISO 8601
  feedbackText: string;
  gradeResult: FreeTalkGradeResult | null;
  audioUrl?: string | null;
  durationMs?: number | null;
  usedVoice?: boolean;
};
```

**Competency levels** (score thresholds):

| Min score | Label |
|---|---|
| 90 | Advanced Clinical Communicator |
| 80 | Safe & Effective Communicator |
| 70 | Developing Communicator |
| 60 | Need Improvement |
| 0 | Unsafe Communication Risk |

---

### 4.4 `FreeTalkScenarioType` enum

```typescript
const FREE_TALK_SCENARIO_TYPES = [
  'icu_emergency',
  'admission',
  'small_talk_patient',
  'handover',
  'decline_request',
  'phone_doctor',
  'small_talk_colleague',
] as const;
```

Display labels used in the web UI:

| Value | Display label |
|---|---|
| `icu_emergency` | ICU Emergency |
| `admission` | Admission |
| `small_talk_patient` | Small Talk — Patient |
| `handover` | Handover |
| `decline_request` | Decline Request |
| `phone_doctor` | Phone the Doctor |
| `small_talk_colleague` | Small Talk — Colleague |

---

## 5. Student Web Flow

### 5.1 Hub page

**Route:** `/account/practice/free-talk`

#### Subscription guard

On mount, if the user has no Pro access, redirect immediately to `/account/settings/subscriptions`.

#### Tabs

| Tab | Content | Badge |
|---|---|---|
| **Ongoing** | Scrollable list of scenario cards (all available scenarios). Tapping a card navigates to the session with `?scenarioId=<id>`. | Count of available scenarios |
| **History** | Accordion list of past attempts (newest first). Each row shows: scenario title, date/time, score if available. Expanding shows: grade result (behaviours), audio player, feedback text. | Count of history entries |

#### History data loading (merge logic)

```
1. Call GET /api/v1/ai/free-talk/attempts (limit: 50) → serverEntries
2. Load local storage entries for this learnerId → localEntries
3. Build a Set of keys: scenarioId + completedAt for all serverEntries
4. Filter localEntries to only those NOT in the set → extras
5. Merge: [...serverEntries, ...extras] sorted newest-first
6. On API error: fall back to localEntries only
```

#### Scenario card

Each card shows:
- Gradient icon (MessageSquare)
- Scenario title
- Scenario type label (formatted from enum value, e.g. `handover` → `Handover`)
- Chevron arrow

Tapping navigates to `/account/practice/free-talk/session?scenarioId={id}`.

**Mobile notes:** Equivalent to a `FlatList` with `ListEmptyComponent` for loading/error states. Use `useCallback`/`useMemo` to avoid unnecessary re-renders.

---

### 5.2 Session page

**Route:** `/account/practice/free-talk/session?scenarioId={id}`

#### Phases

```
loading → ready → responding → grading → result
```

| Phase | What is shown | What is happening |
|---|---|---|
| `loading` | Spinner + "Preparing your scenario…" | Fetching scenario list + scenario detail + TTS pre-fetch |
| `ready` | Background card, Include accordion, Useful Phrases accordion, "Your Turn" card with hint, "Got it" CTA | TTS audio plays automatically; student reads scenario |
| `responding` | Same layout + mic button (large, bottom-fixed) + optional text input | Student records or types response |
| `grading` | Spinner + streaming feedback text (rendered in Markdown) | SSE stream active |
| `result` | Score ring, competency level, feedback, behaviours list, Next/Try again/Done buttons | Attempt persisted |

#### Session initialization sequence

```
1. fetchFreeTalkScenarioSummaries()  → scenario list
2. Find starting index (from ?scenarioId query param or 0)
3. loadScenarioByIndex(index, list):
   a. fetchFreeTalkScenario({ scenarioId })   → full scenario
   b. fetchTtsBlob(scenario.situation)        → pre-fetch WAV (parallel or serial)
   c. setPhase("ready")
   d. playBlob(audioBlob)                     → auto-play TTS
```

#### Background / Info card

Displays:
- Scenario title (in green)
- `scenario.situation` text (background + task concatenated)
- Volume button: tap to play/stop TTS of situation
- Languages icon (translate — UI placeholder only, no functionality)

#### Include accordion

- Header: "Include"
- Toggle: ChevronDown / ChevronUp
- Content: `freeTalkStringListToMultiline(scenario.include)` — join items with `\n`, render as pre-wrap
- Only shown when `scenario.include.length > 0`

#### Useful Phrases accordion

- Header: "Useful phrases"
- Same toggle pattern as Include
- Content: `freeTalkStringListToMultiline(scenario.usefulPhrases)`
- Only shown when `scenario.usefulPhrases.length > 0`

#### "Your Turn" card

- Shows `scenario.hint` text (bold, centered)
- Volume icon: tap to play/stop TTS of hint
- Link "Can't use the microphone? Type your response" → shows text input

#### Text input

Shown when `showTextInput = true`:
- Textarea (3 rows)
- Ctrl+Enter (keyboard shortcut on web) to send
- "Cancel" + "Send" buttons

#### Recording flow (voice)

```
1. startRecording():
   a. navigator.mediaDevices.getUserMedia({ audio: true })
   b. Prefer codec: audio/webm;codecs=opus → audio/webm → default
   c. new MediaRecorder(stream, { mimeType })
   d. Start recording, capture chunks
   e. setIsRecording(true)

2. stopRecording():
   a. mediaRecorderRef.stop()
   b. rec.onstop fires:
      - Assemble Blob from chunks
      - Calculate durationMs
      - setIsAnalyzingVoice(true)
      - POST blob to /api/v1/ai/transcribe → transcript string
      - setIsAnalyzingVoice(false)
      - Call submitResponse(transcript, { blob, mimeType, durationMs })
```

On `NotAllowedError` (mic denied): show toast + reveal text input.

#### Grading (submitResponse)

```
1. setPhase("grading")
2. POST /api/v1/ai/free-talk { userResponse, scenarioId } → SSE stream
3. On each "text" chunk: append to feedbackText state (streaming Markdown)
4. On "metadata" chunk:
   a. Set feedbackText = chunk.data.fullText
   b. Set gradeResult = chunk.data.grade
   c. setPhase("result")
5. After stream completes: call persistAttemptHistory()
```

**persistAttemptHistory:**
```
1. POST /api/v1/ai/free-talk/attempts (multipart with audio if available)
2. On error: appendFreeTalkHistoryEntry(learnerId, ...) to localStorage
```

#### Result view

Shows:
- **Score ring** (SVG circle, animated stroke): `gradeResult.overallScore` out of 100, color by score
- **Competency level** heading (text from `gradeResult.competencyLevel`)
- **Raw score badge**: `rawScore / maxScore pts`
- **Feedback** section (Markdown rendered)
- **Clinical Communication Behaviours** list — each behaviour shows: icon (✓/~/✗), name, points (1 / 0.5 / 0)
- **Next** button (load next scenario in list, cyclic)
- **Try again** button (reload same scenario)
- **Done** button (return to hub)

#### Navigation / Leave modal

Back button triggers a "Leave this session?" confirmation modal:
- "Leave" → discard & return to hub
- "Keep going" → dismiss modal

In-progress work (no completed grading) is NOT persisted.

**Progress bar**

`width = ((scenarioIndex + phaseSlot) / scenarioTotal) * 100%`

Phase slots: loading=6%, ready=20%, responding=50%, grading=78%, result=100%

---

## 6. Admin Web Flow

### 6.1 Scenario Create Form

**Route:** `/admin/free-talk`

Form fields (all in one page):

| Field | UI control | Required | Notes |
|---|---|---|---|
| **Scenario Title** | text input | ✅ | max 200 chars |
| **Scenario Type** | `<select>` with all 7 enum values | ✅ | |
| **Background** | textarea (4 rows) | ✅ | Clinical context |
| **Task** | textarea (2 rows) | ✅ | What the student must do |
| **Include** | textarea (6 rows, monospace) | — | Free-form multiline. Each non-blank line → one item. |
| **Useful Handover Phrases** | textarea (6 rows, monospace) | — | Same free-form multiline. |
| **Hint** | textarea (2 rows) | — | Shown under "Your Turn". Defaults to Task if blank. |

On submit, `include` and `usefulPhrases` are normalised via `normalizeFreeTalkScenarioStringList()` before posting.

---

### 6.2 Scenario List with Expand/Delete

Below the create form, all saved scenarios are listed (sorted newest first).

Each item:
- **Header row**: type badge (colour-coded), title, expand chevron, delete button
- **Expanded details**: Background, Task, Include (pre-wrap), Useful Phrases (pre-wrap), Hint, created date
- **Delete**: confirms via browser `confirm()` dialog, calls DELETE endpoint

---

### 6.3 Learner Free Talk Attempts Component

`src/components/admin/learner-free-talk-attempts.tsx`

Embedded in the admin learner detail view. Shows a scrollable list of all attempts for a given learner:

| Section | Content |
|---|---|
| Header | Scenario title, date/time, score if available, "Voice response" badge |
| Audio | `<audio>` player + download link (if `audioUrl` present) |
| Feedback | Markdown-rendered `feedbackText` |

Uses `useLearnerFreeTalkAttempts(learnerId)` hook which calls `GET /api/v1/admin/learners/{learnerId}/free-talk-attempts`.

---

## 7. Services & Utilities

### 7.1 `ai.service.ts` — Free Talk methods

All methods are in `src/services/ai.service.ts`:

| Method | HTTP call | Returns |
|---|---|---|
| `fetchFreeTalkScenarioSummaries(signal?)` | `GET /api/v1/ai/free-talk/scenarios` | `{ id, title, scenarioType }[]` |
| `fetchFreeTalkScenario({ scenarioId?, signal? })` | `GET /api/v1/ai/free-talk/greeting?scenarioId=` | Full scenario object |
| `streamFreeTalkGrading({ userResponse, scenarioId, signal? }, onChunk)` | `POST /api/v1/ai/free-talk` SSE | Calls `onChunk` for each event |
| `transcribeAudio(blob)` | `POST /api/v1/ai/transcribe` (multipart) | transcript string |
| `fetchFreeTalkAttempts({ limit?, cursor?, signal? })` | `GET /api/v1/ai/free-talk/attempts` | `{ attempts, nextCursor }` |
| `saveFreeTalkAttempt(body, audioBlob?)` | `POST /api/v1/ai/free-talk/attempts` (multipart) | Saved attempt row |

#### `_processSSEStream` (internal)

Reads a `Response.body` `ReadableStream`, splits on `\n\n`, parses JSON from `data: {...}` lines, and calls `onChunk`. Throws on `{ type: "error" }` events.

**HTTP 402** from any of the above throws `new Error("Subscription required")` — callers redirect to paywall.

---

### 7.2 `gemini.service.ts` — grading pipeline

#### Grading rubrics

There are 7 per-type rubrics (`GRADING_RUBRICS` constant), one for each `FreeTalkScenarioType`. Each rubric defines 7 `GradingBehaviour` objects with `id`, `name`, and `description`. Full rubric text is reproduced in the code (lines 1746–1810).

#### Grading prompt structure (`buildFreeTalkGradingPrompt`)

The prompt instructs Gemini to:
1. **Relevance check**: classify each of the 7 behaviours as `relevant` or `not_applicable` for this specific scenario.
2. **Score each relevant behaviour**: `full` (1 pt) / `partial` (0.5 pt) / `none` (0 pt).
3. **Write 2–4 sentences** of honest, specific feedback referencing the student's actual words.
4. **Output** the sentinel token `GRADE_JSON` on its own line, immediately followed by a JSON object:

```json
{
  "behaviours": [
    { "id": 1, "result": "full" },
    { "id": 2, "result": "partial" },
    ...
  ]
}
```

#### SSE stream wrapping (`wrapWithGradingMetadata`)

A `TransformStream` sits between the raw Gemini text stream and the HTTP response:
- **Text chunks before `GRADE_JSON`** are forwarded to the client as `{ type: "text", data: "..." }` SSE events.
- **The `GRADE_JSON` line and JSON block** are stripped from the text stream.
- **In `flush()`**: parses the JSON, computes scores, builds the `metadata` object, and emits `{ type: "metadata", data: { fullText, grade: { ... } } }`.

#### TTS

`generateGeminiTTSAudio(text, voiceName="Kore")`:
- Calls Gemini TTS API (`gemini-2.5-flash-preview-tts` primary, fallback to another model)
- Returns raw PCM wrapped in a WAV RIFF header (24 kHz, 16-bit, mono)
- The `/api/v1/ai/free-talk/tts` route returns this buffer directly as `audio/wav`

---

### 7.3 `free-talk-history.ts` — localStorage schema & merge

**Storage key format:** `eklana-free-talk-history:v1:{userId}`

**Entry format (`FreeTalkHistoryEntryV1`):** see §4.3.

**Functions:**

| Function | Description |
|---|---|
| `loadFreeTalkHistory(userId)` | Read & validate array from localStorage; sort newest-first |
| `appendFreeTalkHistoryEntry(userId, entry)` | Prepend new entry to existing array (deduplication is NOT done here) |
| `mapFreeTalkAttemptApiToHistoryEntry(row)` | Convert API row to `FreeTalkHistoryEntryV1` |

**Fallback logic**: Used when `saveFreeTalkAttempt()` API call fails. The attempt is saved locally so the history tab still shows it. When the page next loads, the server entries are fetched and merged, deduplicating by `scenarioId + completedAt` key.

---

### 7.4 `free-talk-scenario-lists.ts` — normalise helper

```typescript
normalizeFreeTalkScenarioStringList(value: unknown): string[]
```

Accepts `null`, `string`, or `string[]`. Splits on `\r\n|\n|\r`, trims, drops empty lines. Used on both client and server to guarantee a clean `string[]` regardless of how data was stored (admins may have pasted multiline text as a single string in older versions).

```typescript
freeTalkStringListToMultiline(lines: string[]): string
```

Joins with `\n` for display in pre-wrap or textarea.

---

## 8. SSE Grading Stream Protocol

The `POST /api/v1/ai/free-talk` endpoint uses the standard SSE wire format:

```
data: {"type":"text","data":"You covered the patient's pain level clearly. "}\n\n
data: {"type":"text","data":"However, you missed mentioning the pending investigations."}\n\n
data: {"type":"metadata","data":{"fullText":"You covered...investigations.","grade":{"overallScore":71,"competencyLevel":"Developing Communicator","behaviours":[...],"rawScore":4.5,"maxScore":7}}}\n\n
```

**Event types:**

| Type | `data` shape | Meaning |
|---|---|---|
| `text` | `string` | Incremental narrative feedback (stream it to UI as markdown) |
| `metadata` | `{ fullText: string, grade: GradeResult }` | Terminal event; contains the complete text + structured grade |
| `error` | `{ message: string }` | Stream-level error — close the stream, show error |

**Client parsing algorithm:**

```
buffer = ""
for each chunk received from body.getReader():
  buffer += decode(chunk)
  while buffer contains "\n\n":
    extract eventString up to first "\n\n"
    if eventString starts with "data: ":
      parse JSON from eventString.slice(6)
      if chunk.type === "error": throw Error(chunk.data.message)
      else: call onChunk(chunk)
```

**Termination:** the stream ends when the `metadata` chunk is emitted (the server closes the `ReadableStream` in the `flush()` callback). The client transitions to the `result` phase on receiving `metadata`.

**Fallback:** if the stream ends without a `metadata` chunk, the client transitions to `result` with whatever `feedbackText` was accumulated and a null `gradeResult`.

---

## 9. Mobile Implementation Guidance

### 9.1 API call sequence

```
On enter FreeTalk Session screen:
  ① GET /api/v1/ai/free-talk/scenarios         → list (cache for navigation)
  ② GET /api/v1/ai/free-talk/greeting?scenarioId={id}  → full scenario
  ③ POST /api/v1/ai/free-talk/tts { text: scenario.situation }  → WAV blob (pre-fetch)
     → play immediately on load (optional: toggle mute)

On "Got it — I'm ready" tap:
  → transition to "responding" phase

On stop recording:
  ④ POST /api/v1/ai/transcribe (multipart, audio blob)  → transcript text
  ⑤ POST /api/v1/ai/free-talk { userResponse: transcript, scenarioId }  → SSE stream
     → parse SSE events, update feedbackText live
     → on metadata event: setGradeResult, transition to "result"

On result phase complete:
  ⑥ POST /api/v1/ai/free-talk/attempts (multipart with audio)
     → on failure: save to MMKV/AsyncStorage

On Hub History tab:
  ⑦ GET /api/v1/ai/free-talk/attempts?limit=50  → merge with local storage
```

---

### 9.2 Audio recording on iOS & Android

The web app uses `MediaRecorder` with `audio/webm;codecs=opus`. On React Native, this is not available. Use **Expo AV** (`expo-av`) or **`react-native-audio-recorder-player`**.

**Recommended formats:**

| Platform | Recommended format | MIME type |
|---|---|---|
| iOS | AAC in M4A container | `audio/m4a` or `audio/aac` |
| Android | AAC in M4A or Ogg Opus | `audio/m4a` or `audio/ogg` |

> The Gemini transcription endpoint (`/api/v1/ai/transcribe`) uses `generateContent` with inline audio — it supports `audio/webm`, `audio/m4a`, `audio/aac`, `audio/ogg`, and most other formats. You do **not** need to convert on the client.

> The TTS `/tts` endpoint returns WAV (24 kHz). iOS `AVAudioPlayer` and Android `MediaPlayer` both handle WAV natively.

**Recording best practice:**

```typescript
import { Audio } from 'expo-av';

await Audio.requestPermissionsAsync();
await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

const recording = new Audio.Recording();
await recording.prepareToRecordAsync({
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
});
await recording.startAsync();

// ...user records...

await recording.stopAndUnloadAsync();
const uri = recording.getURI(); // local file path
```

---

### 9.3 Transcription upload

After stopping recording, upload the file as multipart/form-data to `/api/v1/ai/transcribe`:

```typescript
const formData = new FormData();
formData.append('audio', {
  uri: localFileUri,
  name: 'recording.m4a',
  type: 'audio/m4a',
} as any);

const response = await fetch('/api/v1/ai/transcribe', {
  method: 'POST',
  headers: { /* session cookies handled by cookie jar */ },
  body: formData,
});
const { data } = await response.json();
const transcript: string = data.transcription;
```

Then call the grading stream with `transcript` as `userResponse`.

---

### 9.4 SSE streaming on mobile

React Native's `fetch` API supports streaming via `Response.body` in Expo SDK 50+ (Hermes + JSC both support it via `ReadableStream`). Use the same algorithm as the web `_processSSEStream`:

```typescript
const response = await fetch('/api/v1/ai/free-talk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
  body: JSON.stringify({ userResponse, scenarioId }),
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  let idx;
  while ((idx = buffer.indexOf('\n\n')) !== -1) {
    const event = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 2);
    if (event.startsWith('data: ')) {
      const chunk = JSON.parse(event.slice(6));
      if (chunk.type === 'text') {
        setFeedbackText(prev => prev + chunk.data);
      } else if (chunk.type === 'metadata') {
        setFeedbackText(chunk.data.fullText);
        setGradeResult(chunk.data.grade);
        setPhase('result');
      } else if (chunk.type === 'error') {
        throw new Error(chunk.data.message);
      }
    }
  }
}
```

**Fallback for older Expo:** If `response.body` is unavailable (Expo SDK < 50 without polyfill), use `EventSource` from `react-native-sse` or poll with chunked XHR. Alternatively, consider `@microsoft/fetch-event-source` which works without streaming body support.

---

### 9.5 Attempt persistence (AsyncStorage / MMKV)

The web app uses `localStorage`. On mobile, use **MMKV** (preferred — synchronous, fast) or **AsyncStorage**.

**Key format:** `eklana-free-talk-history:v1:{userId}`

**Schema:** `FreeTalkHistoryEntryV1[]` serialized as JSON — identical to the web schema.

```typescript
import { MMKV } from 'react-native-mmkv';
const storage = new MMKV();

const STORAGE_PREFIX = 'eklana-free-talk-history:v1:';

function loadHistory(userId: string): FreeTalkHistoryEntryV1[] {
  const raw = storage.getString(`${STORAGE_PREFIX}${userId}`);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(isValidEntry) : [];
  } catch { return []; }
}

function appendHistory(userId: string, entry: Omit<FreeTalkHistoryEntryV1, 'v' | 'id' | 'completedAt'>) {
  const existing = loadHistory(userId);
  const newEntry: FreeTalkHistoryEntryV1 = {
    v: 1,
    id: crypto.randomUUID(),
    completedAt: new Date().toISOString(),
    ...entry,
  };
  storage.set(`${STORAGE_PREFIX}${userId}`, JSON.stringify([newEntry, ...existing]));
}
```

**Merge logic** (History screen):
1. Fetch server attempts (GET `/attempts?limit=50`)
2. Load local MMKV entries
3. Build a `Set<string>` of `"${scenarioId}|${completedAt}"` keys from server entries
4. Filter local entries to only those NOT in the set
5. Concat + sort by `completedAt` descending

---

### 9.6 TTS playback

The `/tts` endpoint returns a WAV file. On mobile:

```typescript
import { Audio } from 'expo-av';

async function playTts(text: string) {
  const response = await fetch('/api/v1/ai/free-talk/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) return;

  // Write to a temp file then play, OR use base64 data URI
  const blob = await response.blob();
  const reader = new FileReader();
  reader.readAsDataURL(blob);
  reader.onloadend = async () => {
    const base64 = reader.result as string;
    const { sound } = await Audio.Sound.createAsync({ uri: base64 });
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate(status => {
      if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
    });
  };
}
```

Or use `expo-file-system` to write the WAV to a temp file and pass the URI to `Audio.Sound`.

**Pre-fetch pattern:** kick off the TTS fetch **in parallel** with the scenario JSON fetch. Store the result in state/ref so playback is instant when the scenario loads.

---

### 9.7 Suggested screen & component breakdown

```
FreeTalkStack (Stack Navigator)
├── FreeTalkHubScreen
│   ├── TabBar (Ongoing | History) — custom, not RN Tabs
│   ├── OngoingTab
│   │   └── FlatList → ScenarioCard (navigates to session)
│   └── HistoryTab
│       └── FlatList → HistoryAccordionItem
│           ├── HistoryItemHeader (title, date, score)
│           └── (expanded) GradeResult, AudioPlayer, FeedbackText
│
└── FreeTalkSessionScreen (receives scenarioId via route params)
    ├── SessionHeader (back, scenario type label, progress bar, step label)
    ├── LoadingView
    ├── ReadyView / RespondingView
    │   ├── BackgroundCard (situation text, TTS button, Translate placeholder)
    │   ├── IncludeAccordion (collapsible)
    │   ├── UsefulPhrasesAccordion (collapsible)
    │   └── YourTurnCard (hint text, TTS button, text input toggle)
    ├── GradingView (spinner + streaming feedback Markdown)
    ├── ResultView
    │   ├── ScoreRing (SVG animated circle)
    │   ├── CompetencyBadge
    │   ├── FeedbackCard (Markdown)
    │   ├── BehavioursList (7 rows with icons)
    │   ├── NextButton
    │   ├── TryAgainButton
    │   └── DoneButton
    ├── MicButton (floating, bottom-fixed) — only in responding phase
    └── LeaveConfirmModal (bottom sheet or Alert)
```

**Shared components:**
- `MarkdownText` — use `react-native-markdown-display` to render feedback
- `ScoreRing` — SVG with `react-native-svg` and `Animated` for the stroke animation
- `AudioPlayer` — wrap `expo-av` Sound with play/pause toggle
- `BehaviourRow` — icon (CheckCircle / MinusCircle / XCircle from `lucide-react-native`) + label + score label

**Navigation between scenarios:**  
Keep the scenario list in the screen's state. "Next" increments the index (wrapping), "Try Again" reloads the same index. Both reset all session state (phase, feedbackText, gradeResult, recording state).

**AbortController equivalent on mobile:**  
React Native supports `AbortController` natively. Use it to cancel in-flight `fetch` calls when navigating away or switching scenarios.

**Safe area:**  
Use `react-native-safe-area-context` `useSafeAreaInsets()` for the floating mic button bottom padding (`pb: Math.max(16, insets.bottom)`).
