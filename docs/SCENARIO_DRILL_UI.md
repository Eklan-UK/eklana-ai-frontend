# Scenario (Roleplay) Drill — UI Layout (How It Looks)

This document describes **only the learner-facing UI** of the **roleplay** drill (`RoleplayDrill.tsx` — “scenario” practice with scenes and dialogue). It focuses on **what scrolls**, **what stays visible**, and **what is pinned to the screen**.

**Source:** `src/components/drills/RoleplayDrill.tsx` (inside `DrillLayout`, `hideNavigation`).

---

## 1. Overall shell

- **Header:** Standard drill header with the drill **title** and back control (`DrillLayout`).
- **Main card:** A large rounded panel (`rounded-2xl bg-muted/30 p-4 md:p-6`) holds the scenario content.
- **Bottom safe area:** Extra **padding** on the main panel when recording (`pb-24`–`pb-56` depending on state) so content is not hidden **behind** the floating controls.

---

## 2. Before “Let’s Get Started”

- The card shows an **intro bubble** (scenario text, roles, optional swapped-role note) and a small **play/stop** control for intro audio.
- A **fixed** full-width bar at the **bottom of the viewport** holds the primary **“Let’s Get Started”** button (`fixed inset-x-0 bottom-0`, green pill). The main area uses **`flex flex-1 min-h-0 flex-col pb-28`** so content clears that button.

Nothing is in “scene scroll” yet; the session has not started.

---

## 3. After the session starts — top block (does not live inside the chat scroll)

These stack **above** the scrollable conversation, in normal document order:

1. **Role-swapped banner** (only in swapped mode) — short line: who you are playing as.
2. **Progress** — `DrillProgress` **embedded** (no extra card): **“Your lines”** + **current / total** student lines and a **green progress bar** (percentage of your lines completed).
3. **Scenario** — If `drill.context` exists: icon + **“Scenario”** label + body text (emerald styling).
4. **Current scene** — If the scene has a name: **“Current Scene”** + title; if multiple scenes, **“Scene X of Y”** on the right.

This block reads like a **fixed header** for the active scene: it updates when you advance scenes, but it is **not** inside the scrolling transcript.

---

## 4. Scrollable area — “the conversation so far”

```text
<div className="max-h-64 overflow-y-auto py-2">
```

- **Height cap:** `max-h-64` (16rem). Only this region **scrolls vertically**.
- **Content:** Chat-style bubbles for **completed** lines only (`completedMessages`): your lines (right, green gradient) vs partner lines (left, muted), with optional **translation** and your **score %** on your bubbles.
- **Empty state:** Placeholder (“Conversation will appear here”).
- **Auto-scroll:** After updates, `messagesEndRef` is scrolled into view so the latest bubble tends to stay near the **bottom of this box**.

So: **long dialogue history scrolls inside a short window**; it does **not** push the whole page to be miles tall.

---

## 5. “What to say” — always below the scroll box (not inside it)

Whatever happens next is rendered **below** the `max-h-64` scroller, so it is **not** part of the scrolling transcript:

### 5.1 AI’s turn

- Centered **bot** state (loading TTS / playing / idle).
- **“{Name} is speaking…”**
- A light blue card with the **current line text** and optional **translation** (what the AI is saying — for listening, not for the student to record).

### 5.2 Your turn (the line you must say)

- **“Your turn!”** pill (green) + optional **“Switched”** badge.
- **“Say this line”** strip: small label, **TTS** for the line, **bookmark** control.
- **Large quoted line** in the center: `"{currentTurn.text}"` (primary script).
- Optional **translation** under it (italic, muted).

This block uses a **gradient bordered card** (`from-emerald-500/10 to-teal-500/10`, emerald border) so it **visually stands out** from the chat log above.

Below that (still your turn):

- Status hints (mic at bottom, analyzing, preview send/trash, passed state).
- **Score card** when Speechace returned and you have not passed yet (percentage + bar + transcript).
- **Passed celebration** card when score ≥ threshold (confetti elsewhere; here a compact success card + transcript).
- **Continue** / **Retry speaking** buttons (in document flow above the fixed dock, not inside the scroll area).

**Important:** The script card is **`position: static`** (normal flow). It stays **visually “fixed” relative to the story** because the **history is confined** to the small scroll region **above** it — you do not scroll the line **into** the chat history until you tap **Continue** (then it becomes a message in `completedMessages` and appears in the scrollable list next time).

---

## 6. Truly fixed UI — microphone (and optional preview)

When it is **your turn** and the conversation is not fully complete:

- **`fixed inset-x-0 bottom-0`** bar, centered **`max-w-md`**, above the home indicator (`safe-area-inset-bottom`).
- Contains **`RecordingPreviewBar`** when you have a pending clip, then the **circular mic** (record / stop / submit / spinner / check when passed).

Copy in the student section explicitly says: **“Use the microphone fixed at the bottom of the screen to record.”**

So: **viewport-fixed** = **mic dock** (and pre-start CTA), not the “Say this line” card.

---

## 7. Scene break (multi-scene drills only)

When the learner finishes **all lines in a scene** and there is **another scene ahead**, the drill **pauses** instead of auto-advancing:

- A **sky-tinted banner** inside the card: **“Scene complete: {name}”**, preview of the **next scene**, and two actions:
  - **Continue to Next Scene** (primary) — starts the next scene.
  - **Continue Later** (outline) — saves checkpoint server-side and returns to **My Plan** (assigned drills) or the **weekly challenge week** list.
- The **conversation transcript** from the finished scene stays visible in the scroll area above.
- The **mic dock is hidden** during the scene break (no active line to record).
- **Single-scene** drills skip this screen entirely.

On return, saved progress restores the same scene-break screen (or the in-scene position if extended later). Assignment status becomes **in-progress** so **Resume** appears on the home practice card.

---

## 8. When the scenario is finished

- A full-width **emerald banner** inside the card: **“Conversation Complete!”**, role summary, **Review Performance**, **Switch Roles**, **Restart drill**.
- No mic dock until you start again / new flow.

---

## 9. Visual summary (mental model)

```text
┌─────────────────────────────────────┐
│ Header: drill title                  │
├─────────────────────────────────────┤
│ [Your lines progress bar]            │
│ [Scenario text]                      │
│ [Current scene title]                │
├─────────────────────────────────────┤
│ ▲ SCROLL (max-h-64)                  │
│ │ Chat history (completed only)     │
│ ▼                                    │
├─────────────────────────────────────┤
│ YOUR TURN / AI SPEAKING block        │  ← not inside scroll region
│ “Say this line” + big quote          │
│ Score / Continue / Retry             │
└─────────────────────────────────────┘
        ┌───────────────┐
        │ FIXED: Mic    │  ← viewport fixed bottom
        └───────────────┘
```

---

## 10. One-line takeaway

The **scenario drill UI** keeps **context and progress at the top**, puts **past lines in a short, scrollable chat window** (`max-h-64`), and keeps the **current script to say** in a **dedicated card below that window** so it is always the next thing you read—while the **microphone** stays **fixed to the bottom of the screen** for recording.
