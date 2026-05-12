# Mobile Handoff — Practice Section

> **Prerequisites**: Read `MOBILE_README.md` first for auth, error envelope, shared types, and stack conventions.

---

## 1. Overview

The Practice section is the core learning engine. It contains:

1. **Eklan Free Talk** — AI-driven open conversation via text or voice
2. **Pressure Test** — Timed 3-turn scenario practice with analysis
3. **Pronunciation Practice** — Word/sentence scoring via SpeechAce
4. **Listening Drills** — Redirects to drill runner in My Plan
5. **Bookmark Practice** — Re-practice saved bookmark text with pronunciation scoring

The bottom-nav "Practice" tab maps to `/account/practice`.

---

## 2. Sub-Sections and Routes

| Web Route | Mobile Screen | Description |
|-----------|---------------|-------------|
| `/account/practice` | `practice/index.tsx` | Hub: Free Talk + Pressure Test cards |
| `/account/practice/ai` | `practice/free-talk/index.tsx` | Session picker: topics, roles, completed drills |
| `/account/practice/ai/session` | `practice/free-talk/session.tsx` | Main AI chat room (voice + text) |
| `/account/practice/ai/summaries` | `practice/free-talk/summaries.tsx` | Past session summaries list |
| `/account/practice/ai/pressure-test` | `practice/pressure-test/index.tsx` | Pressure test picker + history |
| `/account/practice/ai/pressure-test/chat` | `practice/pressure-test/chat.tsx` | Live timed pressure test |
| `/account/practice/pronunciation` | `practice/pronunciation/index.tsx` | Pronunciation problems list |
| `/account/practice/pronunciation/[slug]` | `practice/pronunciation/[slug].tsx` | Word-by-word pronunciation practice |
| `/account/practice/listening` | `practice/listening/index.tsx` | Listing drills → navigates to my-plan drill |
| `/account/practice/bookmark/[id]` | `practice/bookmark/[id].tsx` | Bookmark text pronunciation practice |

---

## 3. Auth

All endpoints require `Authorization: Bearer <token>`. See `MOBILE_README.md`.

---

## 4. API Endpoints

### 4.1 AI Free Talk / Session

All paths under `/api/v1/ai/...`. All use Bearer auth.

| Method | Path | Content-Type | Body | Response | Notes |
|--------|------|-------------|------|----------|-------|
| GET (SSE) | `/ai/drill-practice/greeting` | — | Query: `drillId`, `scenarioId?`, `vocab?` (JSON string), `reversed?` | SSE stream: `text`, `audio` (base64 PCM), `metadata`, `done` | Opening greeting for drill-linked session |
| POST (SSE) | `/ai/drill-practice` | `application/json` | `{ drillId, userMessage, conversationHistory[], temperature?, freeTalkContext? }` | SSE stream: `text`, `audio`, `done`, `error` | Drill-linked text turn |
| POST (SSE) | `/ai/chat` | `application/json` | `{ messages[], temperature?, maxTokens?, systemInstruction? }` | SSE stream: `text` chunks, `done` | Free / topic text chat |
| POST (SSE) | `/ai/voice/conversation` | `multipart/form-data` | `audio` (blob), `conversationHistory` (JSON string), `context?` | SSE stream: `text`, `audio` (PCM), `metadata`, `done` | Free Talk voice turn |
| POST (SSE) | `/ai/drill-practice/voice` | `multipart/form-data` | `drillId`, `audio`, `conversationHistory`, `temperature?`, `freeTalkContext?` | SSE stream: same pattern | Drill voice turn |
| POST | `/ai/session/summary` | `application/json` | `{ messages[], mode: 'free'\|'topic'\|'drill', topic?, drillId?, focusLabel? }` | `{ code: 'Success', data: SessionSummaryPayload }` | Call after session ends |
| GET | `/ai/session/summaries` | — | Query: `limit` (default 30), `offset?` | `{ code: 'Success', data: { summaries: SessionRow[] } }` | |

### 4.2 TTS

| Method | Path | Body | Response | Notes |
|--------|------|------|----------|-------|
| POST | `/tts` | `{ text: string, voice?: string }` | `{ audioUrl: string }` or raw `audio/mpeg` | Cached; prefer `audioUrl` for playback |
| GET | `/tts` | Query: `text`, `voice` | Cache probe response | |
| POST | `/ai/tts/generate` | `{ text, voice? }` | Raw `audio/mpeg` | ElevenLabs-backed |
| GET | `/ai/tts/voices` | — | `{ voices: Voice[] }` | Available ElevenLabs voices |

### 4.3 Pressure Test

| Method | Path | Body | Response | Notes |
|--------|------|------|----------|-------|
| POST (SSE) | `/pressure-test/chat` | `{ messages[], level: 1–20, turnNumber: 1–3, drillId?, sessionId?, isNewSession?, metadata? }` | SSE stream | AI response for each turn |
| POST | `/pressure-test/analyze` | `{ level, drillId?, turns[], scenarioId? }` | `{ code: 'Success', data: AnalysisResult }` | After 3 turns, get feedback |
| POST | `/pressure-test/tts` | `{ text: string, voice? }` | Raw `audio/wav` | Gemini TTS for pressure test |
| GET | `/pressure-test/sessions` | Query: `limit` (10) | `{ code: 'Success', data: PTHistory }` | Past sessions |

### 4.4 Pronunciation Practice

| Method | Path | Body / Query | Response | Notes |
|--------|------|-------------|----------|-------|
| GET | `/pronunciation-problems` | `difficulty?`, `isActive?` | `{ code: 'Success', data: { problems: PronunciationProblem[] } }` | |
| GET | `/pronunciation-problems/:slug` | `wordLimit?` | `{ code: 'Success', data: { problem: PronunciationProblemDetail } }` | |
| POST | `/speechace/score` | `{ text, audioBase64, questionInfo? }` | `{ code, message, data: SpeechaceResponse }` | Immediate UI scoring |
| POST | `/pronunciation-words/:wordId/attempt` | `{ audioBase64, passingThreshold?: 70 }` | `{ code, data: AttemptResult }` | Persists attempt + updates progress |

### 4.5 Bookmark Practice

| Method | Path | Response |
|--------|------|----------|
| GET | `/bookmarks/:id` | `{ bookmark: Bookmark }` |

---

## 5. TypeScript Types

```ts
// types/practice.ts

// Session Summary
export type AiSessionMode = 'free' | 'topic' | 'drill';

export interface TranscriptTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface SessionSummaryPayload {
  grammar: string;
  vocabulary: string;
  flow: string;
  strengths: string;
  tips: string;
  encouragement: string;
  overallScore?: number;
}

export interface SessionRow {
  id: string;
  mode: AiSessionMode;
  topic?: string;
  summary: SessionSummaryPayload;
  endedAt: string;
}

// SpeechAce
export interface PhoneScore {
  phone: string;
  score: number;
}

export interface SyllableScore {
  letters: string;
  phoneScoreList: PhoneScore[];
  quality_score: number;
}

export interface WordScore {
  word: string;
  phoneScoreList?: PhoneScore[];
  syllableScoreList?: SyllableScore[];
  quality_score: number;
}

export interface TextScore {
  text: string;
  wordScoreList: WordScore[];
  quality_score: number;
}

export interface SpeechaceResponse {
  code: string;
  message: string;
  data: {
    text_score: TextScore;
  };
}

// Pronunciation Problems
export interface PronunciationProblem {
  _id: string;
  slug: string;
  title: string;
  difficulty: string;
  wordCount: number;
  isActive: boolean;
}

export interface PronunciationWord {
  _id: string;
  word: string;
  phonetic: string;
  sentence: string;
  audioUrl?: string;
  userProgress?: { score: number; attempts: number; lastPracticed: string };
}

export interface PronunciationProblemDetail extends PronunciationProblem {
  words: PronunciationWord[];
}

// Bookmark
export interface Bookmark {
  _id: string;
  content: string;
  translation?: string;
  context?: string;
  type: string;
}

// Pressure Test
export interface PTTurn {
  turnNumber: number;
  aiPrompt: string;
  studentResponseText: string;
  latencyMs: number;
  speedSuccess?: boolean;
  audioDurationMs?: number;
  audioBase64?: string;
}

export interface PTSession {
  _id: string;
  score?: number;
  level: number;
  createdAt: string;
  turns: PTTurn[];
}

export interface PTHistory {
  sessions: PTSession[];
  total: number;
}
```

---

## 6. Screen Breakdown

### 6.1 Practice Hub (`practice/index.tsx`)

Two cards only:
1. **Eklan Free Talk** → navigate to `practice/free-talk/index`
2. **Eklan Pressure Test** → navigate to `practice/pressure-test/index`

Pronunciation and Listening are NOT linked from the hub on web. Consider adding them as secondary cards on mobile for discoverability.

### 6.2 Free Talk Picker (`practice/free-talk/index.tsx`)

```ts
// Loads completed roleplay/scenario drills to offer as "practice contexts"
const { data: completedDrills } = useQuery(
  ['learner-drills', { status: 'completed' }],
  () => drillAPI.getLearnerDrills({ status: 'completed' })
);
```

**UI elements:**
- "Free topic" card → session with `mode: 'free'`
- Topic picker → session with `mode: 'topic'`
- List of completed scenario drills → session with `mode: 'drill', drillId`
- Role reversal toggle (`reversed=1`)
- Link to past summaries → `practice/free-talk/summaries`

**Navigate to session:**
```ts
router.push({
  pathname: '/practice/free-talk/session',
  params: {
    drillId: selectedDrill?._id,
    scenarioId: selectedScenario?._id,
    topic: selectedTopic,
    mode: 'drill' | 'topic' | 'free',
    reversed: isReversed ? '1' : undefined,
  }
});
```

### 6.3 AI Session Screen (`practice/free-talk/session.tsx`)

**This is the most complex screen.** It manages:
- Mic recording (voice mode) or text input (text mode)
- SSE streaming from AI
- TTS audio playback of AI responses
- Conversation history management
- Exit summary generation

#### Session setup

```ts
// On mount, fetch drill greeting if drillId provided
const greetingSSE = await fetchSSE(`/ai/drill-practice/greeting?drillId=${drillId}`);
// OR start with empty conversation for free mode
```

#### Voice turn flow

```ts
// 1. Record audio
const { uri } = await recordAudio();
const base64 = await uriToBase64(uri);

// 2. Build FormData
const formData = new FormData();
formData.append('audio', { uri, type: 'audio/m4a', name: 'recording.m4a' } as any);
formData.append('conversationHistory', JSON.stringify(conversationHistory));
if (drillId) formData.append('drillId', drillId);

// 3. POST SSE
const chunks = await fetchSSEMultipart('/ai/voice/conversation', formData);
// or '/ai/drill-practice/voice' for drill-linked

// 4. Collect text + audio (PCM base64) from chunks
// 5. Play PCM audio via expo-av (write to temp file or use buffer)
```

#### Text turn flow

```ts
// 1. Send message
const payload = {
  messages: conversationHistory,
  temperature: 0.8,
};

// 2. SSE stream
for await (const chunk of fetchSSE('/ai/chat', 'POST', payload)) {
  if (chunk.text) appendToLastMessage(chunk.text);
  if (chunk.done) break;
}

// 3. After AI response, generate TTS
const { audioUrl } = await apiClient.post('/tts', {
  text: extractSpeakablePhrase(aiResponse),
  voice: userVoicePreference,
});
await playAudio(audioUrl);
```

#### SSE parsing helper

```ts
function parseSSELine(line: string): { type: string; [key: string]: unknown } | null {
  if (!line.startsWith('data: ')) return null;
  try {
    return JSON.parse(line.slice(6));
  } catch {
    return null;
  }
}
```

#### Exit and summary

```ts
// On session end
const summary = await apiClient.post('/ai/session/summary', {
  messages: conversationHistory,
  mode: sessionMode,
  topic: sessionTopic,
  drillId,
  focusLabel,
});
// Navigate to summary display screen
router.push({ pathname: '/practice/free-talk/summary-result', params: { summary: JSON.stringify(summary.data) } });
```

#### Microphone permission

```ts
import { Audio } from 'expo-av';
const { status } = await Audio.requestPermissionsAsync();
if (status !== 'granted') {
  Alert.alert('Microphone Permission', 'Please allow microphone access to use voice mode.');
  return;
}
await Audio.setAudioModeAsync({
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
});
```

#### iOS audio unlock

The web app has iOS-specific audio context unlock. On mobile this is handled automatically by `expo-av` when `playsInSilentModeIOS: true` is set.

### 6.4 Session Summaries (`practice/free-talk/summaries.tsx`)

```ts
const { data } = useQuery(
  ['session-summaries', { limit: 30 }],
  () => apiClient.get('/ai/session/summaries?limit=30').then(r => r.data.data.summaries)
);
```

Render with `FlashList`. Each row shows: mode badge, topic, date, truncated summary snippet. Tap to expand in a modal.

### 6.5 Pressure Test Picker (`practice/pressure-test/index.tsx`)

```ts
const { data: drills } = useQuery(['learner-drills'], fetchLearnerDrills);
const { data: history } = useQuery(['pressure-test-sessions'], () =>
  apiClient.get('/pressure-test/sessions?limit=10').then(r => r.data.data)
);
```

Two tabs: **Practice** (scenario drill list) | **History** (past PT sessions).

Navigate to chat:
```ts
router.push({
  pathname: '/practice/pressure-test/chat',
  params: { drillId: selectedDrill._id, level: userLevel }
});
```

### 6.6 Pressure Test Chat (`practice/pressure-test/chat.tsx`)

Three turns, timed. Each turn:

```ts
// 1. Fetch AI turn (SSE)
const chunks = await fetchSSE('/pressure-test/chat', 'POST', {
  messages: history,
  level: studentLevel,
  turnNumber: currentTurn,   // 1, 2, or 3
  drillId,
  sessionId,
  isNewSession: currentTurn === 1,
});

// 2. Play WAV TTS for AI prompt
const wavResponse = await apiClient.post('/pressure-test/tts', { text: aiText }, { responseType: 'arraybuffer' });
await playWavBuffer(wavResponse.data);

// 3. Record student response with timer
// 4. After 3 turns, call analyze:
const analysis = await apiClient.post('/pressure-test/analyze', {
  level: studentLevel,
  drillId,
  turns: recordedTurns,
});
```

**Fallback TTS**: If `/pressure-test/tts` fails, use `expo-speech` (`Speech.speak(text)`).

### 6.7 Pronunciation List (`practice/pronunciation/index.tsx`)

```ts
const { data } = useQuery(['pronunciation-problems'], () =>
  apiClient.get('/pronunciation-problems').then(r => r.data.data.problems)
);
```

`FlashList` of problems with difficulty badge and word count. Tap → `practice/pronunciation/[slug]`.

### 6.8 Pronunciation Practice (`practice/pronunciation/[slug].tsx`)

```ts
const { slug } = useLocalSearchParams();
const { data } = useQuery(['pronunciation-problem', slug], () =>
  apiClient.get(`/pronunciation-problems/${slug}`).then(r => r.data.data.problem)
);
```

Word-by-word flow:
1. Play word audio (`word.audioUrl`) using `expo-av`.
2. User records pronunciation.
3. Convert recording to base64.
4. Score via SpeechAce:

```ts
// Immediate score for UI (does not persist)
const score = await apiClient.post('/speechace/score', {
  text: word.word,
  audioBase64: base64,
});

// Persist attempt and update progress
const attempt = await apiClient.post(`/pronunciation-words/${word._id}/attempt`, {
  audioBase64: base64,
  passingThreshold: 70,
});
```

5. Show word breakdown from `SpeechaceResponse.data.text_score.wordScoreList`.
6. Next word until all done → navigate to completed screen.

**Audio format note**: The web app uses WebM/Opus. The backend passes audio to SpeechAce which accepts various formats. Use `expo-av` default (`m4a`) — test with your SpeechAce plan to confirm acceptance. If issues arise, use a wav encoder.

### 6.9 Listening (`practice/listening/index.tsx`)

```ts
const { data: drills } = useQuery(['learner-drills'], fetchLearnerDrills);
const listeningDrills = drills?.filter(d => d.type === 'listening') ?? [];
```

Tap → navigate to `my-plan/drills/[id]` (the drill runner). This is just a filtered view into My Plan.

### 6.10 Bookmark Practice (`practice/bookmark/[id].tsx`)

```ts
const { id } = useLocalSearchParams();
const { data } = useQuery(['bookmark', id], () =>
  apiClient.get(`/bookmarks/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.data.bookmark)
);
```

Practice the bookmark text with pronunciation scoring via `/speechace/score`.

---

## 7. Third-Party Service Architecture

| Service | Direction | Mobile Impact |
|---------|-----------|---------------|
| **Google Gemini** | Always server-side (API key never on client) | Call via `/api/v1/ai/*` endpoints — no changes needed |
| **ElevenLabs** | Always server-side | Call via `/api/v1/tts` and `/api/v1/ai/tts/generate` |
| **SpeechAce** | Server-side via `/api/v1/speechace/score` (preferred) | Use the backend proxy — never expose API key on device |

**Important**: `speechace-direct.service.ts` in the web app contains a hardcoded fallback key. **Do not use it or replicate it on mobile.**

---

## 8. Audio Implementation (Mobile)

### Recording setup

```ts
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

let recording: Audio.Recording | null = null;

export async function startRecording() {
  await Audio.requestPermissionsAsync();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });
  const { recording: rec } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );
  recording = rec;
}

export async function stopRecording(): Promise<string> {
  if (!recording) throw new Error('No active recording');
  await recording.stopAndUnloadAsync();
  const uri = recording.getURI()!;
  recording = null;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
}
```

### Sending audio as FormData

```ts
const formData = new FormData();
formData.append('audio', {
  uri: recordingUri,
  name: 'recording.m4a',
  type: 'audio/m4a',
} as unknown as Blob);
formData.append('conversationHistory', JSON.stringify(history));
```

### Playing MP3/AAC from URL

```ts
import { Audio } from 'expo-av';

export async function playAudioFromUrl(url: string) {
  const { sound } = await Audio.Sound.createAsync(
    { uri: url },
    { shouldPlay: true }
  );
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      sound.unloadAsync();
    }
  });
}
```

### Playing PCM (from Gemini Live stream)

PCM chunks arrive as base64 in SSE events. Write to a temp `.wav` file with a WAV header prepended, then play with `Audio.Sound`:

```ts
import * as FileSystem from 'expo-file-system';

export async function playPCMBase64(base64Pcm: string, sampleRate = 24000) {
  const pcmBytes = Buffer.from(base64Pcm, 'base64');
  const wavBuffer = addWavHeader(pcmBytes, sampleRate, 1, 16);
  const uri = FileSystem.cacheDirectory + `pcm_${Date.now()}.wav`;
  await FileSystem.writeAsStringAsync(uri, wavBuffer.toString('base64'), {
    encoding: FileSystem.EncodingType.Base64,
  });
  await playAudioFromUrl(uri);
}
```

---

## 9. Expo Router File Structure

```
app/(student)/practice/
├── index.tsx                        ← Practice hub
├── free-talk/
│   ├── index.tsx                    ← Session picker
│   ├── session.tsx                  ← AI chat session
│   ├── summaries.tsx                ← Past summaries
│   └── summary-result.tsx           ← Show summary after session
├── pressure-test/
│   ├── index.tsx                    ← Picker + history
│   └── chat.tsx                     ← Live timed chat
├── pronunciation/
│   ├── index.tsx                    ← Problem list
│   ├── [slug].tsx                   ← Word practice
│   └── completed.tsx                ← Completion screen
├── listening/
│   └── index.tsx                    ← Filter to listening drills
└── bookmark/
    └── [id].tsx                     ← Bookmark pronunciation practice
```

---

## 10. State Management

```ts
// Session state (local to session screen — use useState + useRef, not React Query)
const conversationHistory = useRef<TranscriptTurn[]>([]);
const sessionMode = useRef<AiSessionMode>('free');
const isRecording = useRef(false);
const audioQueue = useRef<Audio.Sound[]>([]);

// Persisted
useQuery(['session-summaries'], fetchSummaries)       // stale: 60s
useQuery(['pronunciation-problems'], fetchProblems)   // stale: 5min
useQuery(['learner-drills', { status: 'completed' }]) // stale: 60s
useQuery(['pressure-test-sessions'])                  // stale: 30s
```

---

## 11. Edge Cases & Error Handling

| Scenario | Handling |
|----------|---------|
| Mic permission denied | Show alert with link to system settings |
| SSE connection drops mid-session | Retry once; if fails, show "Connection lost" with option to resume |
| TTS endpoint fails | Continue without audio; show text only |
| SpeechAce score ≤ 0 | Show "Unable to score — please try again" |
| Pressure test timer runs out before response | Auto-submit what was recorded |
| `/daily-focus/today` path from home linking here | Accept `dailyFocusId` param, route to appropriate flow |
| Audio file > 10MB | Compress before upload or warn user to keep responses shorter |

---

## 12. Acceptance Checklist

- [ ] Practice hub shows Free Talk and Pressure Test cards
- [ ] Free Talk session starts with greeting for drill-linked mode
- [ ] Voice mode: mic records → sends to backend → AI text + audio streams back
- [ ] Text mode: message sends → AI text streams → TTS audio plays
- [ ] Session summary generated after exit and persisted
- [ ] Past summaries list loads and displays correctly
- [ ] Pressure test: 3 timed turns → analysis result shown
- [ ] Pronunciation list loads with difficulty filters
- [ ] Word-by-word pronunciation: record → score displayed → progress saved
- [ ] Listening filter shows only listening drills and navigates to drill runner
- [ ] Bookmark practice loads bookmark content and scores pronunciation
- [ ] Microphone permission requested gracefully
- [ ] SSE parsing handles all chunk types: `text`, `audio`, `metadata`, `done`, `error`
- [ ] PCM audio plays correctly (24kHz, mono, 16-bit)
- [ ] No API keys exposed to client
