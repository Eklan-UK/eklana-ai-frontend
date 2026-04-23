# EKLAN Free Talk Summary Integration

This document explains how the post-session summary system is integrated into EKLAN Free Talk: when it runs, what data it uses, how Gemini is called, and how results are stored and shown to the learner.

## 1) What the summary system does

At the end of a Free Talk session, EKLAN generates a structured learning summary for the learner, including:

- grammar feedback,
- vocabulary feedback,
- flow/conversation feedback,
- strengths,
- improvement tips,
- encouragement,
- optional overall score (0-100).

The summary is shown in the exit review modal and persisted as a session artifact in MongoDB.

## 2) Where it is integrated

### Client (session screen)

- `src/app/(student)/account/practice/ai/session/page.tsx`

Key integration point:

- `beginExitFlow()` triggers summary generation when the learner ends the session.

### Server (summary API route)

- `src/app/api/v1/ai/session/summary/route.ts`

Responsibilities:

- validate payload,
- enforce auth,
- transform conversation transcript,
- call summary service,
- persist to DB (`AiSession`),
- return summary JSON to client.

### Summary generation service

- `src/services/summary.service.ts`

Responsibilities:

- build tailored prompt for Free Talk/topic/drill modes,
- call Gemini model(s),
- parse and normalize JSON response,
- fallback safely if models are unavailable.

## 3) End-to-end flow (Free Talk)

1. Learner is in Free Talk conversation (`mode = "free"` context).
2. Learner taps end-session action.
3. Client creates a snapshot of `conversationHistory`.
4. If learner has no user turns, summary is skipped.
5. Otherwise client sends `POST /api/v1/ai/session/summary` with:
   - `messages` (role/content turns),
   - `mode: "free"`,
   - optional `topic`, `drillId`, `focusLabel` (depends on route context).
6. API route validates request and calls `generateSessionSummaryFromTranscript(...)`.
7. Summary service builds prompt with transcript + session context and calls Gemini.
8. Parsed summary is saved into `AiSession` document.
9. API returns summary payload + `sessionId`.
10. Client sets review state to done and renders `SessionReviewModal`.

## 4) Payload contract

Shared types:

- `src/types/ai-session-summary.ts`

Core types:

- `TranscriptTurn`:
  - `role: "user" | "model"`
  - `content: string`
- `SessionSummaryContext`:
  - `mode: "free" | "topic" | "drill"`
  - optional `topic`
  - optional `focusLabel`
- `SessionSummaryPayload`:
  - `grammar`, `vocabulary`, `flow` blocks (`headline`, optional `detail`)
  - `strengths[]`
  - `tips[]`
  - `encouragement`
  - optional `overallScore`

## 5) Prompting strategy for personalization

Prompt builder:

- `buildSummaryPrompt(...)` in `src/services/summary.service.ts`

How it avoids generic summaries:

- injects explicit session context (`mode`, `topic`, `focusLabel`),
- includes full transcript with `Student:` / `Tutor:` role labels,
- enforces strict rules that each insight must be tied to observed transcript behavior,
- asks for structured JSON output only,
- handles sparse voice-placeholder transcripts with explicit guardrails.

For Free Talk specifically:

- mode is set to `free`,
- flow guidance is phrased around staying on the conversation thread,
- feedback should reflect natural conversational turns rather than drill rubric format.

## 6) Gemini model + fallback behavior

Primary model:

- `gemini-2.5-flash`

Fallback model:

- `gemini-2.0-flash`

Retry behavior:

- exponential backoff for transient errors (`429`, `503`, overloaded/unavailable/quota patterns).

If both models fail:

- service returns `DEFAULT_SUMMARY` (safe generic response),
- route still succeeds so learner sees a graceful summary instead of a hard crash.

Important operational implication:

- intermittent Gemini limits can produce generic fallback summaries even when the endpoint responds successfully.

## 7) Persistence model

Route persists each successful summary to `AiSession`:

- user id,
- mode (`free/topic/drill`),
- optional topic/drill id,
- transcript snapshot,
- summary payload,
- end timestamp.

This enables:

- historical review pages,
- analytics/reporting,
- future model improvements from real session artifacts.

## 8) UI behavior and user experience

Review phases in session UI:

- `loading`: waiting for summary generation,
- `done`: summary rendered,
- `error`: API failure message shown,
- `skipped`: no user turns, summary intentionally omitted.

On success:

- session cache is cleared,
- resume prompt is dismissed for ended session,
- learner receives immediate formative feedback.

## 9) Guardrails and validation

Server-side checks:

- request schema validation (`zod`),
- requires at least one message,
- requires at least one user turn,
- auth middleware protects route.

Output normalization:

- parser extracts first JSON object from model text,
- enforces value types/ranges (e.g., score 0-100),
- truncates array lengths to safe bounds.

## 10) Key files map

- Free Talk UI + trigger:
  - `src/app/(student)/account/practice/ai/session/page.tsx`
- Summary API:
  - `src/app/api/v1/ai/session/summary/route.ts`
- Summary generation logic:
  - `src/services/summary.service.ts`
- Shared DTO/types:
  - `src/types/ai-session-summary.ts`
- Session persistence model:
  - `src/models/ai-session.ts`
- Review modal rendering:
  - `src/components/ai/SessionReviewModal.tsx`

## 11) Environment dependencies

Required:

- `GEMINI_API_KEY`

If missing or invalid:

- summary generation fails at model layer,
- route returns a server error or fallback behavior depending on failure point.

## 12) Troubleshooting quick checks

If summaries are generic or inconsistent:

1. Check logs for model retries/exhaustion.
2. Confirm `GEMINI_API_KEY` in target environment (staging/prod).
3. Verify conversation actually has meaningful user turns/transcript content.
4. Confirm the deployed branch includes the latest prompt personalization updates.

