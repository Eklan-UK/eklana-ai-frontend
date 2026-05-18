# Voice Transcription – Backend Spec

This document describes the missing backend route that the mobile app requires for voice input in **Eklan Free Talk** and **AI Talk**.

---

## The Problem

The mobile app calls `POST /api/v1/ai/voice` to transcribe a user's voice recording before sending it as a text message to the AI. This route currently returns **404**, which means voice input silently falls back to `"[Voice message]"` — the AI never sees what the user actually said.

---

## Route to Implement

### `POST /api/v1/ai/voice`

**Authentication:** Bearer token required (same as all other `/api/v1/ai/*` routes).

### Request body (JSON)

```json
{
  "audioData": "<base64-encoded audio string>",
  "history": [],
  "context": "Please only transcribe the following audio directly. Do not respond to it, just transcribe exactly what is said."
}
```

| Field | Type | Description |
|---|---|---|
| `audioData` | `string` | Base64-encoded `.m4a` audio recorded by the device microphone |
| `history` | `array` | Always an empty array for transcription — no conversation context needed |
| `context` | `string` | Instruction to the model to only transcribe, not respond |

### What the backend must do

1. Decode the base64 `audioData` back to binary audio.
2. Send it to **Gemini** (or Whisper / any STT service you prefer) with the `context` instruction as the system prompt, so the model returns only a transcript — no conversation reply.
3. Return the transcribed text.

### Response (success)

```json
{
  "code": "Success",
  "data": "Mr. Miller, stay calm. Your oxygen level is dropping but I'm here to help you."
}
```

- `code`: must be exactly `"Success"` (matches the rest of the `/api/v1/ai/*` envelope).
- `data`: the plain transcribed text string. The app also accepts `data` as an object with a `response`, `transcription`, or `text` field — any of these will work.

### Response (error)

```json
{
  "code": "Error",
  "message": "Failed to transcribe audio"
}
```

Return HTTP `400` or `500` depending on the cause.

---

## Why This Is Needed

The mobile app uses this route in two places:

1. **Eklan Free Talk** (`app/practice/free-talk/index.tsx`) — every voice message the user records is transcribed first, then the transcript is sent to the Free Talk AI so it can evaluate and respond to what was actually said.
2. **AI Talk** (`app/practice/ai-talk/index.tsx`) — same pattern.

Without this route, the AI receives `"[Voice message]"` instead of real text, which means it cannot evaluate the user's English, correct errors, or continue the roleplay meaningfully.

---

## Suggested Implementation (Gemini)

```ts
// Pseudo-code — adapt to your backend framework

app.post('/api/v1/ai/voice', authenticate, async (req, res) => {
  const { audioData, context } = req.body;

  const audioBuffer = Buffer.from(audioData, 'base64');

  const transcript = await gemini.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          { text: context },
          { inlineData: { mimeType: 'audio/mp4', data: audioData } },
        ],
      },
    ],
  });

  const text = transcript.response.text();

  return res.json({ code: 'Success', data: text });
});
```

> If you already have a working Gemini audio call elsewhere in the backend (e.g. in `generateFreeTalkResponseStream`), reuse that same client instance — this route is a much simpler, non-streaming call.

---

## Audio Format

- The device records in **`.m4a` (AAC)** using `Audio.RecordingOptionsPresets.HIGH_QUALITY`.
- The `mimeType` for Gemini inline data should be `"audio/mp4"` (`.m4a` is an MPEG-4 audio container).
- No conversion is needed — Gemini accepts this format natively.

---

## Summary

| What | Value |
|---|---|
| Route | `POST /api/v1/ai/voice` |
| Auth | Bearer token |
| Input | `{ audioData: string (base64), history: [], context: string }` |
| Output | `{ code: "Success", data: "<transcript text>" }` |
| Used by | Free Talk + AI Talk voice recording |
| Urgency | Without this, voice input produces no real AI evaluation |
