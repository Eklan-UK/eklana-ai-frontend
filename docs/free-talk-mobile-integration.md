# Free Talk — Mobile Integration Guide

This document describes the mobile-side changes required to support the updated Free Talk backend behaviour introduced in the "Premature Cutoff Fix + Continue? Flow" backend update.

---

## What Changed on the Backend

| Area | Before | After |
|---|---|---|
| Minimum turns before scenario ends | 3 | **5** |
| Scenario transition | AI auto-transitions to next scenario | AI **asks** the user: *"Would you like to continue with another scenario, or are you happy to stop here?"* |
| `scenarioComplete` signal | Fired at turn 3+ | Fired at turn 5+ only |
| Next scenario hint in metadata | Sent automatically after completion | Still sent with `scenarioComplete: true` — mobile must act on it |

---

## SSE Metadata Shapes (no change to format)

### Greeting response (`GET /api/v1/ai/free-talk/greeting`)
```json
{
  "type": "metadata",
  "data": {
    "fullText": "...",
    "scenarioTitle": "Rapid Response — Deteriorating Patient",
    "hint": "...",
    "usefulPhrases": ["...", "..."]
  }
}
```

### Continuation response — scenario still in progress (`POST /api/v1/ai/free-talk`)
```json
{
  "type": "metadata",
  "data": {
    "fullText": "...",
    "scenarioComplete": false
  }
}
```

### Continuation response — scenario complete (`POST /api/v1/ai/free-talk`)
```json
{
  "type": "metadata",
  "data": {
    "fullText": "...",
    "scenarioComplete": true,
    "scenarioTitle": "<title of the NEXT scenario>",
    "hint": "...",
    "usefulPhrases": ["...", "..."]
  }
}
```

### New scenario intro response (first POST after user taps "Yes")
```json
{
  "type": "metadata",
  "data": {
    "fullText": "...",
    "scenarioTitle": "<same title that was passed as activeScenarioTitle>",
    "hint": "...",
    "usefulPhrases": ["...", "..."]
  }
}
```
> This shape has no `scenarioComplete` key — the mobile app uses `hint || usefulPhrases` being present to decide whether to show the hint modal.

---

## Required Mobile Changes

### 1. Handle `scenarioComplete: true` — Show a Yes/No Modal

When a `metadata` chunk arrives with `scenarioComplete === true`, the AI's spoken message will already contain the question *"Would you like to continue with another scenario…?"*. The app must reinforce this with a modal so the user can make an explicit choice.

**Trigger condition:**
```ts
if (metadata.scenarioComplete === true) {
  showContinueModal({
    nextScenarioTitle: metadata.scenarioTitle,
    hint: metadata.hint,
    usefulPhrases: metadata.usefulPhrases,
  });
}
```

**Modal content:**
- Title: *"Great work!"* (or similar)
- Body: *"Would you like to continue with another scenario?"*
- Button — **Yes, continue**: triggers the next scenario flow (see §2)
- Button — **No, I'm done**: ends the session (navigate away / show summary screen)

> Store `metadata.scenarioTitle`, `metadata.hint`, and `metadata.usefulPhrases` in local state when `scenarioComplete === true` so they are available when the user taps "Yes".

---

### 2. "Yes" Tap — Start the Next Scenario

When the user taps **Yes**:

1. **Show the hint modal** immediately using the `hint` and `usefulPhrases` values saved from the `scenarioComplete` metadata. This gives the learner a heads-up before the new scenario begins.

2. **Send a POST request** to `/api/v1/ai/free-talk` with the new `activeScenarioTitle`:

```json
{
  "userMessage": "Yes, let's continue.",
  "activeScenarioTitle": "<scenarioTitle from metadata>",
  "conversationHistory": []
}
```

> Pass an **empty** `conversationHistory` (or reset it) because this is a fresh scenario. The backend will detect this as a new scenario intro turn and respond with a greeting-shaped SSE stream including another hint modal payload.

3. The metadata from this POST will contain `scenarioTitle + hint + usefulPhrases` (no `scenarioComplete`), which can be used to refresh / confirm the hint modal already shown.

---

### 3. "No" Tap — End the Session

When the user taps **No**:
- Dismiss the modal.
- Navigate away from the Free Talk screen (back to practice home, or show a session summary).
- No API call is needed.

---

### 4. Hint Modal — When to Show

Show the hint modal (with `hint` + `usefulPhrases`) in **two places**:

| Trigger | Source of hint data |
|---|---|
| After `GET /greeting` response completes | `metadata.hint` + `metadata.usefulPhrases` |
| After user taps **Yes** on the continue modal | Values saved from the previous `scenarioComplete` metadata |

The hint modal content remains the same; only the timing of its second appearance changes (it now only shows after explicit user consent via the Yes/No modal, not automatically).

---

### 5. State to Track

Add (or update) the following state variables in the Free Talk screen:

```ts
// Active scenario
activeScenarioTitle: string;          // set from metadata.scenarioTitle on greeting/intro
conversationHistory: ConversationTurn[];

// Pending next scenario (populated when scenarioComplete === true)
pendingNextScenarioTitle: string | null;
pendingNextHint: string | null;
pendingNextUsefulPhrases: string[] | null;

// Modal visibility
showContinueModal: boolean;
showHintModal: boolean;
```

---

### 6. Updated Conversation Flow Diagram

```
GET /greeting
    │
    ▼
[Stream text + audio]
    │
    ▼
metadata { scenarioTitle, hint, usefulPhrases }
    │
    ▼
Show hint modal ──────────────────────────────┐
    │                                          │
    ▼                                          │
User dismisses modal, speaks/types            │
    │                                          │
    ▼                                          │
POST /free-talk (conversationHistory grows)   │
    │                                          │
    ├── metadata { scenarioComplete: false }   │
    │       │                                  │
    │       └── Continue conversation ─────────┘
    │
    └── metadata { scenarioComplete: true,
                   scenarioTitle, hint, usefulPhrases }
            │
            ▼
        Show Yes/No modal
            │
            ├── "No"  → End session
            │
            └── "Yes" → Show hint modal for new scenario
                            │
                            ▼
                        POST /free-talk {
                          userMessage: "Yes, let's continue.",
                          activeScenarioTitle: <next>,
                          conversationHistory: []
                        }
                            │
                            ▼
                        metadata { scenarioTitle, hint, usefulPhrases }
                            │
                            ▼
                        New scenario begins (loop back to top)
```

---

## Checklist

- [ ] On `metadata.scenarioComplete === true`: store next-scenario data, show Yes/No modal
- [ ] Yes tap: show hint modal with stored data, POST with new `activeScenarioTitle` and empty history
- [ ] No tap: end session, no API call
- [ ] Hint modal shown after greeting AND after Yes tap (not automatically after `scenarioComplete`)
- [ ] `activeScenarioTitle` state updated whenever a new scenario begins
- [ ] `conversationHistory` reset to `[]` when a new scenario begins
