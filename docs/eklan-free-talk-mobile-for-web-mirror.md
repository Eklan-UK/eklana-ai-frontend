# Eklan Free Talk — What the mobile app does (mirror this on web)

This document summarizes the **current Eklan Free Talk implementation in this Expo/React Native repo** so you can reproduce the same behavior, API usage, and gating on the web app.

For backend contract details, also read:

- `eklan-free-talk-backend-spec.md` — server routes, prompts, scenario rules  
- `free-talk-mobile-integration.md` — SSE metadata shapes and the **continue / hint** flow after the “premature cutoff” backend update  

---

## 1. Entry, routing, and Pro gating

| Item | Mobile implementation |
|------|-------------------------|
| **Practice entry** | `app/(tabs)/practice.tsx` — card **“Eklan Free Talk”** (`Speak about anything`). |
| **Navigate** | `router.push("/practice/free-talk")` only if `useIsSubscribed()` is true; otherwise `router.push("/premium")`. |
| **Screen guard** | `app/practice/free-talk/index.tsx` uses `useFocusEffect`: if `!isSubscribed`, `router.replace("/premium")` so deep links cannot bypass paywall. |
| **Pro detection** | `hooks/useIsSubscribed.ts` — merges React Query cache `USER_CURRENT_KEY` (`user-current`) with auth store user, then `utils/subscription.ts` → `isProSubscriber()`. Pro = `isSubscribed === true` **or** (if explicit flag absent) `subscriptionPlan === "premium"`. |

**Web parity:** Same subscription source of truth as mobile (`/users/current` or equivalent + session user), same double gate (list + screen).

---

## 2. API calls the screen relies on

All requests use the shared API client (`lib/api.ts`) with Bearer auth — same base URL as the rest of the app.

| Action | Method | Path | Body |
|--------|--------|------|------|
| **Initial scenario** | `GET` | `/api/v1/ai/free-talk/greeting` | none (`ai.service` uses XHR GET for SSE) |
| **Turns** | `POST` | `/api/v1/ai/free-talk` | JSON: `{ userMessage, conversationHistory?, activeScenarioTitle? }` |
| **Voice → text** | `POST` | `/api/v1/ai/voice` | JSON: `{ audioData: base64, history: [], context: "Please only transcribe…" }` — see `ai.service.transcribeAudio` |

Service wrappers: `services/ai.service.ts` — `streamFreeTalkGreeting`, `streamFreeTalkMessage`.

---

## 3. SSE stream handling

Transport: `_processSSEStreamXHR` — `GET` when body is null, `POST` otherwise; `Accept: text/event-stream`; parses SSE into typed chunks.

**Chunk types** the Free Talk UI cares about:

| `type` | UI behavior |
|--------|-------------|
| `text` | Append to the in-flight AI bubble for that request. |
| `audio` | Forward base64 chunks to `AudioStreamPlayer.addCompressedChunkBase64` (native playback pipeline; on web you’ll use Web Audio / MediaSource or whatever your web stack already uses for other AI streams). |
| `metadata` | Append `data.fullText` to `conversationHistory` as `{ role: "model", content }`; read `scenarioTitle`, `scenarioComplete`, `hint`, `usefulPhrases` per flow below. |

After each stream completes, mobile calls `streamPlayerRef.current?.flush()` so buffered TTS finishes playing.

---

## 4. Conversation history shape and POST body

- **Shape:** `Array<{ role: "user" | "model"; content: string }>` — aligned with Gemini-style turns.
- **Important:** When calling `streamFreeTalkMessage`, mobile passes **`conversationHistory: history.slice(0, -1)`** — the **last** user turn is omitted from the array because it is already sent as **`userMessage`**. Mirror this on web to avoid duplicating the latest user message on the server.

---

## 5. `activeScenarioTitle` (scenario anchoring)

State: `activeScenarioTitle: string | null`.

- Set from **`metadata.scenarioTitle`** on the greeting stream and when the backend returns a new scenario title in non-complete responses.
- **Every** `POST /api/v1/ai/free-talk` includes `activeScenarioTitle` when known so the backend does not pick a new scenario mid-thread (see comments in `ai.service.streamFreeTalkMessage`).

---

## 6. Hint modal (`ScenarioHintModal` behavior)

Component: `components/practice/ScenarioHintModal.tsx` — bottom sheet with **scenario title**, **“Your Response”** (`hint`), **“Useful Phrases”** (bulleted list), **Got it** dismiss.

**When it opens (mobile):**

1. **After greeting** — when metadata includes `hint` or `usefulPhrases` (with `scenarioTitle`).
2. **Immediately when user taps “Yes, continue”** on the continue modal — using **stashed** `pendingNextScenarioTitle`, `pendingNextHint`, `pendingNextUsefulPhrases` from the `scenarioComplete` metadata (before the POST returns).

Metadata on the follow-up POST may repeat hint fields; mobile uses that to **confirm** `activeScenarioTitle` when `scenarioComplete` is false and hint fields appear (see `processStreamResponse` metadata branch).

---

## 7. `scenarioComplete` → Yes/No modal → next scenario

When **`metadata.scenarioComplete === true`**:

1. Store **`scenarioTitle`** (this is the **next** scenario’s title), **`hint`**, **`usefulPhrases`** into pending state.
2. Show **`showContinueModal`** — title **“Great work!”**, body **“Would you like to continue with another scenario?”**, buttons **“Yes, continue”** / **“No, I'm done”**.
3. **No** — dismiss modal, stop audio player, `router.back()` (no API call).
4. **Yes** — `handleContinueYes`:
   - Close continue modal; open hint modal with pending hint data (if any).
   - Set `activeScenarioTitle` to pending next title; **clear** `conversationHistory` to `[]` in state, then set a **new** history containing only `{ role: "user", content: "Yes, let's continue." }`.
   - Append a visible user message **“Yes, let's continue.”** to the chat list.
   - Call `processStreamResponse("Yes, let's continue.", newHistory, nextTitle)` so the POST sends the synthetic user line, **empty prior model turns in the sliced history**, and **`activeScenarioTitle`** = next scenario.
   - `incrementTurn()` from `useAiUsageStore` (see §9).

This matches the flow documented in `free-talk-mobile-integration.md`.

---

## 8. Text vs voice input

| Mode | Behavior |
|------|----------|
| **Text** | Optional row: keypad icon toggles `TextInput`; send trims input; on send, stops stream player + any TTS playback for other messages. |
| **Mic** | `expo-av` recording; on stop: status row “analyzing”; `transcribeAudio(uri, "en")`; user bubble shows `🎤 [Voice] ${transcribed}` or fallback **“🎤 [Voice message]”** if transcription fails; **`conversationHistory` uses raw transcript** (`transcribed` or `"[Voice message]"`) without the emoji prefix. |
| **Permissions** | `MicPermissionModal`; deny → switch to text input and focus field. |

---

## 9. AI usage counter (local)

`store/ai-usage-store.ts` — `incrementTurn()` on: each user text send, each voice send, and each **“Yes, let's continue.”** continuation. Persisted with Zustand + AsyncStorage (`eklan-ai-usage`). Limit is set high (100) — mostly telemetry / future gating, not a hard UX cap in this screen.

**Web parity:** If the web app tracks turns the same way for analytics or limits, mirror these call sites.

---

## 10. Other UX details worth matching

- **Initializing:** placeholder **“Preparing your scenario…”** until first greeting chunks arrive.
- **Loading:** `StatusMessage` type `analyzing` while waiting for AI reply.
- **Leave:** back opens a modal — **“Leave this session?”** / progress not saved / **Leave** vs **Keep going**; confirm stops audio and `router.back()`.
- **Greeting failure:** fallback AI message: *“Hello! I'm ready to practise with you. Tap the mic to begin.”*
- **Stream error:** replace failed AI bubble with *“Sorry, I had trouble responding. Please try again.”*
- **Stack:** `app/practice/_layout.tsx` registers `free-talk/index` with `headerShown: false`; screen draws its own header **“Eklan Free Talk”** with back chevron.

---

## 11. Web-specific differences (you implement)

| Concern | Mobile | Web |
|---------|--------|-----|
| SSE | `XMLHttpRequest` + manual parse | `fetch` stream / `EventSource` if applicable, or shared HTTP client |
| Audio | `AudioStreamPlayer` (PCM → WAV temp files → `expo-av`) | Browser audio decode/queue consistent with your other streamed AI voice |
| Mic | `expo-av` + file URI | `MediaRecorder` + upload or same `/api/v1/ai/voice` base64 contract |
| Storage | AsyncStorage for usage store | `localStorage` / session-only as you prefer |

---

## 12. File map (mobile)

| Area | File |
|------|------|
| Screen | `app/practice/free-talk/index.tsx` |
| AI API | `services/ai.service.ts` (`streamFreeTalkGreeting`, `streamFreeTalkMessage`, `transcribeAudio`) |
| Streamed TTS playback | `lib/audio-stream-player.ts` |
| Hint UI | `components/practice/ScenarioHintModal.tsx` |
| Mic prompt UI | `components/practice/MicPermissionModal.tsx` |
| Messages | `components/practice/AIMessage.tsx`, `UserMessage.tsx`, `StatusMessage.tsx` |
| Practice tab | `app/(tabs)/practice.tsx` |
| Pro hook | `hooks/useIsSubscribed.ts`, `utils/subscription.ts` |
| Turn counter | `store/ai-usage-store.ts` |

---

## 13. Quick parity checklist for web

- [ ] Pro gate on entry + on route (replace to paywall if unpaid).  
- [ ] `GET …/free-talk/greeting` on mount; handle `text` / `audio` / `metadata`.  
- [ ] Track `activeScenarioTitle`; send on every POST.  
- [ ] POST body: `userMessage` + `conversationHistory` **excluding** duplicated last user turn (use `slice(0, -1)` pattern).  
- [ ] On `scenarioComplete: true`: stash next scenario fields → Yes/No modal.  
- [ ] Yes: hint modal from stash → reset history → synthetic **“Yes, let's continue.”** POST with new `activeScenarioTitle` and empty prior history.  
- [ ] No: exit without POST.  
- [ ] Hint modal after greeting and after Yes (not auto right after complete without Yes).  
- [ ] Voice: transcribe via `/api/v1/ai/voice`, then POST transcript; graceful fallback string.  
- [ ] Optional: increment turn counter on same events as mobile.
