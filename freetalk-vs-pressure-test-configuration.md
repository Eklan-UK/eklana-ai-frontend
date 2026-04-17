# Eklan Free Talk vs Pressure Test: Configuration & Architecture

This document explains **why Free Talk can work** with the current setup while **the Pressure Test may still fail or degrade**, how **Gemini** is used differently in each flow, and how **other tools** (TTS, transcription, pronunciation) diverge. It reflects the implementation in this repository as of the documented date.

---

## 1. Why Free Talk works with the current configuration

Free Talk (AI practice session voice mode) is built around **one continuous pipeline** per turn:

1. **Single API surface for “hear → think → speak”**  
   The client sends recorded audio to `POST /api/v1/ai/voice/conversation`, which calls `generateVoiceConversationSSEStream` in `src/services/gemini.service.ts`.

2. **Gemini Live (native audio)**  
   The server uses the **`@google/genai`** client (`GoogleGenAI`) with the **`gemini-2.5-flash-native-audio-latest`** model. Audio is converted to raw PCM (16 kHz) and sent over the **Live API WebSocket**. The same session returns **streaming AI audio** plus **built-in input/output transcription** (no separate “chat then TTS” step for the main loop).

3. **Session reuse**  
   Live sessions are cached per user (`freetalk_<userId>`), so after the first connection, later turns avoid paying the full reconnect cost.

4. **Requirements**  
   For this path to work you need a valid **`GEMINI_API_KEY`** so both `genAI` and `genAINew` initialize. FFmpeg (bundled via `ffmpeg-static`) is used server-side for format conversion.

**In short:** Free Talk aligns with **one high-level feature** (Live native audio): fewer moving parts and fewer distinct Gemini models/API styles in the hot path.

---

## 2. Why the Pressure Test may not work (or feels broken) with the “same” configuration

The Pressure Test is **not** a Live audio loop. It chains **several independent systems**:

| Stage | What happens |
|--------|----------------|
| **AI prompts (text)** | `POST /api/v1/pressure-test/chat` uses **`@google/generative-ai`** (`GoogleGenerativeAI`), model from **`GEMINI_CHAT_MODEL`** (default **`gemini-2.5-flash-lite`**), via **`startChat` + `sendMessageStream`**. Returns **text-only** SSE. |
| **Speaking the AI’s lines** | The UI calls **`POST /api/v1/pressure-test/tts`**, which uses **`generateGeminiTTSAudio`** — a **different** model: **`gemini-2.5-flash-preview-tts`**, via **`generateContent`** with audio output. |
| **Student speech → text** | Primarily **browser Web Speech API**; if empty, fallback to server **`transcribeAudio`** (Gemini **text** model on audio). |
| **End-of-session analysis** | `POST /api/v1/pressure-test/analyze` runs **Gemini `generateContent`** for structured JSON feedback **and** **Speechace** for pronunciation scoring. |

So “Gemini is configured” for Free Talk (Live) does **not** guarantee:

- **`gemini-2.5-flash-preview-tts`** is enabled, in quota, or behaves the same in your project/region (TTS can 500 while Live still works).
- **`gemini-2.5-flash-lite`** chat streaming stays under **rate limits** — the Pressure Test uses **multiple** REST/streaming calls per session (several chat turns + several TTS calls + analysis + optional transcription).
- **Web Speech** produces a good transcript (unsupported browsers, permissions, silence) — the UI may fall back to **`(voice response)`** or server transcription.
- **Pressure-test chat** returns **500** if `GEMINI_API_KEY` is missing (`ConfigError`), whereas some other endpoints degrade more gracefully.

The client even handles **empty chat streams** (e.g. quota) by substituting **fallback text prompts** so the session can continue — which can look like “the AI is wrong” rather than a hard error.

---

## 3. How Gemini AI is used differently

### Free Talk

- **SDK:** `@google/genai` (`GoogleGenAI`).
- **Model:** `gemini-2.5-flash-native-audio-latest` (constant `LIVE_MODEL` in `gemini.service.ts`).
- **Pattern:** WebSocket **Live** session; `responseModalities: [AUDIO]`; `inputAudioTranscription` / `outputAudioTranscription`; PCM streaming in and audio + transcription out.
- **Text-only Gemini** is not used for the core speak-back loop.

### Pressure Test

- **Chat:** `@google/generative-ai` + **`GEMINI_CHAT_MODEL`** (default `gemini-2.5-flash-lite`) — **multiturn chat**, **text streaming** over HTTP/SSE.
- **TTS:** `@google/genai` **`generateContent`** with **`gemini-2.5-flash-preview-tts`** — **not** the Live WebSocket path.
- **Analyze:** `GoogleGenerativeAI` + **`GEMINI_CHAT_MODEL`** — single-shot **`generateContent`** expecting JSON.
- **Optional fallback transcription:** Gemini **text** model + audio inline data (same family as other `generateContent` helpers).

So Pressure Test mixes **Live-style** infrastructure only indirectly (shared `genAINew` for TTS), while its **conversation** is **REST chat**, not native audio Live.

---

## 4. How other tools differ

| Tool | Free Talk | Pressure Test |
|------|-----------|----------------|
| **ElevenLabs / generic TTS route** | Other features may use `/api/v1/tts` (e.g. ElevenLabs when configured). Free Talk **AI voice** in voice mode does **not** use a separate TTS HTTP round-trip for the model reply — it comes from **Live audio**. | Uses **dedicated** `/api/v1/pressure-test/tts` → **Gemini preview TTS** (`generateGeminiTTSAudio`). |
| **Student transcription** | **Gemini Live** input transcription (server-side, same session). | **Web Speech API** first; then optional **`transcribeAudio`** (Gemini). |
| **Pronunciation scoring** | Not part of the default Free Talk voice loop described here. | **Speechace** in `/pressure-test/analyze` (with per-turn fallbacks if a call fails). |
| **MongoDB / persistence** | Drill assignments and drill data where applicable for drill flows. | **PressureTestSession**, **PressureTestRawData**, user **pressureTestLevel** updates. |

---

## 5. Main differences (tabular)

| Aspect | Eklan Free Talk (voice) | Pressure Test |
|--------|-------------------------|---------------|
| **Primary endpoint(s)** | `POST /api/v1/ai/voice/conversation` | `POST /api/v1/pressure-test/chat`, `POST /api/v1/pressure-test/tts`, `POST /api/v1/pressure-test/analyze` |
| **Gemini SDK in hot path** | `@google/genai` (Live) | `@google/generative-ai` (chat + analyze) **and** `@google/genai` (TTS only) |
| **Core model(s)** | Single **Live** model: `gemini-2.5-flash-native-audio-latest` | **Chat/analyze:** `GEMINI_CHAT_MODEL` (`gemini-2.5-flash-lite` by default); **TTS:** `gemini-2.5-flash-preview-tts` |
| **Transport** | WebSocket (Live) + SSE to client | HTTP **chat stream** (SSE) + separate **TTS** `generateContent` + analyze **`generateContent`** |
| **AI voice output** | Streamed **audio** from Live | **Text** from chat → **WAV** from Gemini TTS |
| **User speech → text** | Live **input transcription** (built-in) | **Web Speech** + optional Gemini **transcribe** fallback |
| **Calls per session (order of magnitude)** | ~1 Live pipeline per turn | Multiple **chat** + **TTS** + **analyze** (+ optional **transcribe**) |
| **Failure character** | Connection/stream errors on one pipeline | Partial failure (e.g. TTS fails, chat empty with fallback text, Speechace fails per turn) |
| **Third-party APIs** | Gemini (+ FFmpeg server-side) | Gemini + **Speechace** (analyze) |

---

## 6. Practical takeaway

- **Free Talk** succeeding means: **Live native audio** + key + FFmpeg path is healthy.
- **Pressure Test** additionally needs: **chat** (flash-lite streaming), **preview TTS** (separate model), optional **transcribe**, **Speechace**, and reliable **browser speech** or fallbacks — any of these can fail independently while Free Talk still appears “fine” under the same `.env`.

For debugging Pressure Test specifically, verify **`GEMINI_API_KEY`**, **`GEMINI_CHAT_MODEL`** availability/quotas, **`gemini-2.5-flash-preview-tts`** responses from `/api/v1/pressure-test/tts`, **Speechace** credentials, and **browser speech** support — not only whether Live Free Talk works.
