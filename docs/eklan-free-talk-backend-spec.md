# Eklan Free Talk – Backend Implementation Spec

This document describes everything the backend must implement for the **Eklan Free Talk** feature to work with the mobile app.

---

## Overview

The mobile app calls two endpoints. Both stream responses over **Server-Sent Events (SSE)**. The app already has the SSE consumer wired up — the backend just needs to produce the right stream format.

---

## SSE Stream Format

Every chunk the backend emits must follow this exact format:

```
data: {"type":"text","data":"Hello, I'm..."}\n\n
data: {"type":"audio","data":"<base64-encoded WAV chunk>"}\n\n
data: {"type":"metadata","data":{...}}\n\n
```

- `type: "text"` — a piece of the AI's spoken text. The app appends these together in the chat bubble as they arrive.
- `type: "audio"` — a base64-encoded compressed audio chunk (WAV). The app plays these gaplessly via its `AudioStreamPlayer`. Send these **interleaved with text chunks** so audio starts before the full text is done.
- `type: "metadata"` — sent **once at the end** of the stream. Contains the full text and any scenario data the app needs (see field specs below).

**Headers required:**

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Authentication:** The app sends a `Bearer` token in the `Authorization` header on every request.

---

## Endpoint 1 — Scenario Greeting

### `GET /api/v1/ai/free-talk/greeting`

Called when the user first opens the Eklan Free Talk screen. No request body.

### What the backend must do

1. **Pick a scenario** from the Eklan Free Talk scenario bank (see scenario format below). Either pick randomly or cycle through them session-by-session.
2. **Build a system prompt** that instructs the AI to:
   - Act as an ICU nursing trainer / evaluator named Eklan.
   - Read the **Situation** text from the chosen scenario naturally and clearly, as if setting the scene for the user.
   - Not yet ask for the user's response — just present the scenario.
   - Keep tone calm, professional, and encouraging.
3. **Stream the AI response** as `text` + `audio` chunks.
4. **End with a `metadata` chunk** containing:

```json
{
  "type": "metadata",
  "data": {
    "fullText": "<the complete AI spoken text>",
    "scenarioTitle": "Sudden Oxygen Drop",
    "hint": "Calm the patient. Explain what is happening. Call for help if necessary.",
    "usefulPhrases": [
      "Stay calm.",
      "Your oxygen level is dropping.",
      "Take slow, deep breaths.",
      "I'm calling the respiratory therapist."
    ]
  }
}
```

The `hint` and `usefulPhrases` values power the **hint modal** the app shows after the AI finishes speaking. They must be included — if they are missing, the modal will not appear.

### Example AI opening (what it should say)

> "Good morning. I'm going to present a clinical scenario for you to practise. Mr. Miller's oxygen saturation has suddenly dropped from 96% to 82%. He looks frightened and is beginning to breathe rapidly. He has just grabbed at his oxygen mask. How would you respond?"

---

## Endpoint 2 — User Message

### `POST /api/v1/ai/free-talk`

Called every time the user sends a voice or text response during the scenario.

### Request body

```json
{
  "userMessage": "Mr. Miller, stay calm. Your oxygen level is dropping but I'm here to help you.",
  "conversationHistory": [
    { "role": "model", "content": "<AI's previous message text>" },
    { "role": "user", "content": "<user's previous message>" }
  ]
}
```

- `conversationHistory` is the full turn-by-turn history **excluding the current message**. The app sends it so the AI remembers the whole conversation.
- `userMessage` is what the user just said (transcribed from voice or typed).

### What the backend must do

1. **Evaluate** the user's response in context of the scenario.
2. **Respond as Eklan** — give natural conversational feedback and continue the role-play. Examples:
   - Acknowledge what the user did well.
   - Correct any missing steps gently.
   - Continue the scenario if there's more to play out (e.g. patient escalates, new information arrives).
3. **Stream the AI reply** as `text` + `audio` chunks.
4. **End with a `metadata` chunk**:

```json
{
  "type": "metadata",
  "data": {
    "fullText": "<the complete AI reply text>",
    "scenarioComplete": false
  }
}
```

### When a scenario is complete

When the AI determines the scenario has been fully played out (all key responses handled), set `scenarioComplete: true` in the metadata and **optionally include the next scenario's hint data** so the app can pre-load it into the hint modal:

```json
{
  "type": "metadata",
  "data": {
    "fullText": "<closing remark + transition prompt>",
    "scenarioComplete": true,
    "scenarioTitle": "Airway Obstruction",
    "hint": "Explain the problem. Encourage coughing. Prepare suction equipment.",
    "usefulPhrases": [
      "There may be an airway obstruction.",
      "Keep coughing slowly.",
      "We need to suction your airway.",
      "You're doing well."
    ]
  }
}
```

The AI's spoken text at this point should ask the user whether to continue with another scenario or end the session. For example:

> "Well done — you handled that situation effectively. Would you like to continue with another scenario, or would you prefer to stop here?"

The app does not parse the user's continue/stop reply — it simply sends it as the next `userMessage`. The backend should detect intent ("yes", "continue", "stop", "end", etc.) and either:
- Start a new scenario (pick the next one) and stream it, or
- Close the session warmly.

---

## Scenario Bank

The backend must store (or load at startup) the scenarios from `eklan-free-talk.md`. Each scenario has this structure:

```ts
interface Scenario {
  title: string;       // e.g. "Sudden Oxygen Drop"
  situation: string;   // What the AI reads aloud
  hint: string;        // "Your Response" guidance shown in the hint modal
  usefulPhrases: string[];
}
```

**All 10 scenarios** from `eklan-free-talk.md`:

| # | Title | Situation summary |
|---|---|---|
| 1 | Sudden Oxygen Drop | SpO2 drops 96→82%, patient frightened, breathing rapidly |
| 2 | Airway Obstruction | Patient coughing heavily, mucus suspected |
| 3 | Patient Panic During Ventilator Removal | Patient anxious post-extubation, "I can't breathe!" |
| 4 | Alcohol Withdrawal Symptoms | Patient irritable, demands alcohol, refuses treatment |
| 5 | Emergency Team Communication | Condition worsening rapidly, must brief ICU team |
| 6 | Medication Questions | Patient worried about side effects |
| 7 | CRRT Dialysis Concern | Mrs. Thompson nervous about CRRT machine |
| 8 | Family Member Anxiety | Daughter worried after emergency |
| 9 | Refusing Breathing Exercises | Patient too tired to continue |
| 10 | Overnight Monitoring | Patient asks why staff keep checking overnight |

---

## System Prompt Guidelines

The AI must be instructed to:

- **Role:** Act as Eklan, an ICU English practice tutor. Speak as if role-playing with the user in a real clinical setting.
- **Tone:** Calm, professional, encouraging. Not robotic.
- **On greeting:** Read the Situation text naturally as a scenario setup. End with an implicit or explicit prompt for the user to respond.
- **On user reply:** Evaluate fluency, appropriateness, and clinical correctness of the English response. Give constructive feedback. Continue the scene if appropriate.
- **Language:** Always respond in English only, regardless of what language the user writes in.
- **Speed:** Keep responses concise — this is a fast-paced conversation. Avoid long monologues.
- **Scenario end:** When all key steps have been practised, wrap up warmly and ask the user to continue or stop.

### Example system prompt (adapt as needed)

```
You are Eklan, an ICU English language practice tutor. You present realistic clinical scenarios to help nurses practise communicating clearly in emergency situations.

Current scenario: {scenarioTitle}
Situation: {situationText}

Your job:
1. On the first turn, read the situation naturally and invite the user to respond.
2. On follow-up turns, evaluate what the user said, acknowledge what was good, gently correct gaps, and continue the roleplay.
3. When the scenario is complete, congratulate the user and ask if they want another scenario or to stop.
4. Keep all responses brief and conversational. Speak in clear, natural clinical English.
```

---

## Audio Requirements

- Audio chunks must be **base64-encoded compressed WAV** (same format used by the existing `topic-practice` and `drill-practice` endpoints).
- Chunks should be sent every **~400ms** of audio (matching the `AudioStreamPlayer` buffer size the app already uses).
- The app's `AudioStreamPlayer` calls `flush()` after the stream ends to play any remaining buffered audio — make sure all audio chunks are sent before closing the stream.

---

## Error Handling

If the AI call fails or any error occurs:

- Return HTTP `500` with JSON: `{ "success": false, "message": "..." }`
- Do **not** send a partial SSE stream followed by an HTTP error — pick one. The app handles a failed stream by showing a fallback message.

---

## Summary of what the app expects

| Moment | App action | Backend must provide |
|---|---|---|
| Screen opens | Calls `GET /api/v1/ai/free-talk/greeting` | SSE stream: situation text + audio + metadata with `scenarioTitle`, `hint`, `usefulPhrases` |
| User responds | Calls `POST /api/v1/ai/free-talk` with `userMessage` + history | SSE stream: evaluation + continuation text + audio + metadata with `scenarioComplete: false` |
| Scenario ends | Same POST call, AI decides it's done | metadata with `scenarioComplete: true` + next scenario's `hint` and `usefulPhrases` (optional) |
| User says continue | Next POST call with "yes" / "continue" etc. | Pick next scenario, stream its situation as the AI response |
| User says stop | Next POST call with "stop" / "end" etc. | Stream a warm closing message, `scenarioComplete: false` (session just ends naturally) |
