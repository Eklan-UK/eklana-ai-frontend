# Mobile Handoff — My Plan (Drills)

> **Prerequisites**: Read `MOBILE_README.md` first for auth, error envelope, shared types, and stack conventions.

---

## 1. Overview

**My Plan** is the student's personal drill plan, assigned by their tutor. It lives at the "My Plan" tab in the bottom nav.

The full flow is:
1. **Listing** — tabbed list of all assigned drills (Ongoing / Reviewed / Completed)
2. **Drill Runner** — type-specific interactive drill
3. **Completion** — success screen with attempt history

Drills support 12 types: `vocabulary`, `pronunciation`, `roleplay`, `matching`, `definition`, `grammar`, `sentence_writing`, `sentence`, `summary`, `listening`, `fill_blank`, `key_phrases`.

See [KEY_PHRASES_DRILL.md](./KEY_PHRASES_DRILL.md) for the full Key Phrases runner spec.

---

## 2. Web Routes → Mobile Screens

| Web Route | Mobile Screen | Description |
|-----------|---------------|-------------|
| `/account/drills` | `my-plan/index.tsx` | Tabbed drill listing |
| `/account/drills/[id]` | `my-plan/drills/[id].tsx` | Drill runner (type-specific) |
| `/account/drills/[id]/completed` | `my-plan/drills/[id]/completed.tsx` | Post-completion summary |

---

## 3. Auth

All endpoints require `Authorization: Bearer <token>`. See `MOBILE_README.md`.

---

## 4. API Endpoints

| Method | Path | Auth | Query / Body | Response | Notes |
|--------|------|------|-------------|----------|-------|
| GET | `/drills/learner/my-drills` | Yes | `status?`, `limit?` (default 100), `offset?` | `{ code: 'Success', data: { drills: LearnerDrill[], pagination } }` | Main listing |
| GET | `/drills/:drillId` | Yes | `assignmentId?` | `{ code: 'Success', data: { drill: DrillDetail, assignment?: DrillAssignment } }` | Full drill data |
| POST | `/drills/:drillId/complete` | Yes | See `completeSchema` below | `{ code: 'Success', data: { attempt, streakUpdated? } }` | Completes assignment |
| GET | `/drills/assignments/:assignmentId/attempts` | Yes | `limit?`, `offset?` | `{ code: 'Success', data: { attempts: DrillAttempt[] } }` | Post-completion history |
| POST | `/speechace/score` | Yes | `{ text, audioBase64, questionInfo? }` | `{ code, data: SpeechaceResponse }` | Pronunciation scoring |
| POST | `/pronunciations/drill-attempt` | Yes | `{ text, audioBase64, drillId?, drillType, passingThreshold? }` | `{ code: 'Success', data: { attempt } }` | Persist pronunciation attempt |

---

## 5. Complete Drill Request Schema (`completeSchema`)

This is the body for `POST /drills/:drillId/complete`:

```ts
interface CompleteDrillBody {
  drillAssignmentId: string;      // required — ObjectId of the assignment
  score: number;                   // 0–100
  timeSpent: number;               // seconds, ≥ 0
  platform?: 'web' | 'ios' | 'android';  // always pass on mobile!
  deviceInfo?: Record<string, unknown>;

  // Only one of the following should be populated per drill type:
  vocabularyResults?: VocabularyResult[];
  pronunciationResults?: PronunciationResult[];
  roleplayResults?: RoleplayResult[];
  matchingResults?: MatchingResult[];
  definitionResults?: DefinitionResult[];
  grammarResults?: GrammarResult[];
  sentenceWritingResults?: SentenceWritingResult[];
  sentenceResults?: SentenceResult[];
  summaryResults?: SummaryResult[];
  listeningResults?: ListeningResult[];
  fillBlankResults?: FillBlankResult[];
  keyPhrasesResults?: KeyPhrasesResult;
  performanceReviewSnapshot?: PerformanceSnapshot;
}
```

**Always include `platform: 'ios'` or `platform: 'android'`** — the backend uses this for analytics.

---

## 6. TypeScript Types

```ts
// types/drills.ts

// Drill types enum
export type DrillType =
  | 'vocabulary'
  | 'pronunciation'
  | 'roleplay'
  | 'matching'
  | 'definition'
  | 'grammar'
  | 'sentence_writing'
  | 'sentence'
  | 'summary'
  | 'listening'
  | 'fill_blank'
  | 'key_phrases';

// Assignment status
export type AssignmentStatus = 'pending' | 'in-progress' | 'completed' | 'overdue' | 'skipped';

// Plan tab (derived client-side from assignment status + reviewStatus)
export type DrillPlanTab = 'ongoing' | 'reviewed' | 'completed';

// Learner drill (from my-drills listing)
export interface LearnerDrill {
  _id: string;
  title: string;
  type: DrillType;
  difficulty: string;
  date?: string;
  duration_days?: number;
  context?: string;
  audio_example_url?: string;
  status: AssignmentStatus;
  dueDate?: string;
  completedAt?: string;
  assignmentId: string;
  latestAttempt?: {
    score?: number;
    timeSpent?: number;
    reviewStatus?: 'pending' | 'reviewed';
    correct?: number;
    total?: number;
  };
}

// Full drill detail (from /drills/:id)
export interface DrillDetail {
  _id: string;
  title: string;
  type: DrillType;
  difficulty: string;
  context?: string;
  audio_example_url?: string;

  // Per-type payload fields:
  target_sentences?: VocabSentence[];
  pronunciation_items?: PronunciationItem[];
  roleplay_scenes?: RoleplayScene[];
  matching_pairs?: MatchingPair[];
  definition_items?: DefinitionItem[];
  grammar_items?: GrammarItem[];
  sentence_writing_items?: SentenceWritingItem[];
  sentence_drill_word?: string;
  sentence_drill_audio_url?: string;
  article_title?: string;
  article_content?: string;
  article_audio_url?: string;
  listening_drill_title?: string;
  listening_drill_content?: string;
  listening_drill_audio_url?: string;
  fill_blank_items?: FillBlankItem[];
  key_phrase_items?: KeyPhraseItem[];

  // Legacy
  roleplay_dialogue?: { speaker: string; text: string; translation?: string }[];
  student_character_name?: string;
  ai_character_names?: string[];
  drill_intro?: string;
}

// Per-type data shapes
export interface VocabSentence {
  word: string;
  wordTranslation?: string;
  text: string;
  translation?: string;
  wordAudioUrl?: string;
  sentenceAudioUrl?: string;
}

export interface PronunciationItem {
  sound: string;
  word: string;
  sentence: string;
  soundAudioUrl?: string;
  wordAudioUrl?: string;
  sentenceAudioUrl?: string;
}

export interface RoleplayScene {
  scene_name: string;
  context?: string;
  dialogue: {
    speaker: 'student' | 'ai_0' | 'ai_1' | 'ai_2' | 'ai_3';
    text: string;
    translation?: string;
    audioUrl?: string;
  }[];
}

export interface MatchingPair {
  left: string;
  right: string;
  leftTranslation?: string;
  rightTranslation?: string;
  leftAudioUrl?: string;
  rightAudioUrl?: string;
}

export interface DefinitionItem {
  word: string;
  hint: string;
  audioUrl?: string;
}

export interface GrammarItem {
  pattern: string;
  hint: string;
  example: string;
  patternAudioUrl?: string;
  exampleAudioUrl?: string;
}

export interface SentenceWritingItem {
  word: string;
  hint: string;
  audioUrl?: string;
}

export interface FillBlankItem {
  sentence: string;
  translation?: string;
  audioUrl?: string;
  blanks: {
    position: number;
    correctAnswer: string;
    options: string[];   // ≥ 2 options
    hint?: string;
  }[];
}

export interface KeyPhraseItem {
  prompt: string;
  respondentName?: string;
  options: string[];       // ≥ 2 options
  correctAnswer: string;   // must match one of options
  promptAudioUrl?: string;
}

export interface KeyPhrasesResult {
  items: Array<{
    prompt: string;
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    pronunciationScore?: number;
    textScore?: Record<string, unknown>;
    attempts: number;
  }>;
  totalItems: number;
  correctItems: number;
  score: number;
}

// DrillAssignment
export interface DrillAssignment {
  _id: string;
  drillId: string;
  learnerId: string;
  assignedBy: string;
  dueDate?: string;
  status: AssignmentStatus;
  completedAt?: string;
}

// DrillAttempt
export interface DrillAttempt {
  _id: string;
  drillId: string;
  learnerId: string;
  assignmentId: string;
  score: number;
  timeSpent: number;
  platform?: string;
  createdAt: string;
  reviewStatus?: 'pending' | 'reviewed';
  vocabularyResults?: unknown[];
  pronunciationResults?: unknown[];
  grammarResults?: unknown[];
  sentenceResults?: unknown[];
  summaryResults?: unknown[];
  listeningResults?: unknown[];
  fillBlankResults?: unknown[];
  keyPhrasesResults?: KeyPhrasesResult;
}
```

---

## 7. Plan Tab Logic (Client-Side)

```ts
export function getDrillPlanTab(drill: LearnerDrill): DrillPlanTab {
  if (drill.status !== 'completed') return 'ongoing';
  if (drill.latestAttempt?.reviewStatus === 'reviewed') return 'reviewed';
  return 'completed';
}
```

---

## 8. Screen Breakdown

### 8.1 My Plan Listing (`my-plan/index.tsx`)

```ts
const { data, isLoading } = useQuery(
  ['learner-drills', { limit: 100 }],
  () => apiClient.get('/drills/learner/my-drills?limit=100').then(r => r.data.data)
);

const tabs = {
  ongoing: data?.drills.filter(d => getDrillPlanTab(d) === 'ongoing') ?? [],
  reviewed: data?.drills.filter(d => getDrillPlanTab(d) === 'reviewed') ?? [],
  completed: data?.drills.filter(d => getDrillPlanTab(d) === 'completed') ?? [],
};
```

**UI layout:**

```
SafeAreaView
└── View (flex: 1)
    ├── Header "My Plans"
    ├── TabBar (Ongoing | Reviewed | Completed) with counts
    └── FlashList
        └── DrillRow (per drill)
```

**DrillRow navigation:**

```ts
function navigateToDrill(drill: LearnerDrill) {
  const path = drill.status === 'completed'
    ? `/my-plan/drills/${drill._id}/completed?assignmentId=${drill.assignmentId}`
    : `/my-plan/drills/${drill._id}?assignmentId=${drill.assignmentId}`;
  router.push(path);
}
```

**DrillRow display:**
- Drill title + type badge
- Status chip (Ongoing / Due: [date] / Completed / Overdue)
- Score from `latestAttempt.score` if completed
- Review status badge if `reviewStatus === 'reviewed'`

**Empty state per tab:**
- Ongoing: "No drills assigned yet. Your tutor will assign drills soon."
- Completed: "No completed drills yet. Start practicing!"

Also load next class session at top of screen:

```ts
// If classes API is available in mobile
const { data: classes } = useQuery(['learner-classes'], fetchLearnerClasses);
```

### 8.2 Drill Runner (`my-plan/drills/[id].tsx`)

```ts
const { id } = useLocalSearchParams<{ id: string; assignmentId?: string }>();
const { data } = useQuery(
  ['drill', id],
  () => apiClient.get(`/drills/${id}?assignmentId=${assignmentId}`).then(r => r.data.data)
);
```

Based on `data.drill.type`, render the appropriate drill component:

```ts
function renderDrillComponent(drill: DrillDetail, assignment: DrillAssignment) {
  switch (drill.type) {
    case 'vocabulary':     return <VocabularyDrill drill={drill} assignment={assignment} />;
    case 'pronunciation':  return <PronunciationDrill drill={drill} assignment={assignment} />;
    case 'roleplay':       return <RoleplayDrill drill={drill} assignment={assignment} />;
    case 'matching':       return <MatchingDrill drill={drill} assignment={assignment} />;
    case 'definition':     return <DefinitionDrill drill={drill} assignment={assignment} />;
    case 'grammar':        return <GrammarDrill drill={drill} assignment={assignment} />;
    case 'sentence_writing':
    case 'sentence':       return <SentenceDrill drill={drill} assignment={assignment} />;
    case 'summary':        return <SummaryDrill drill={drill} assignment={assignment} />;
    case 'listening':      return <ListeningDrill drill={drill} assignment={assignment} />;
    case 'fill_blank':     return <FillBlankDrill drill={drill} assignment={assignment} />;
    case 'key_phrases':    return <KeyPhrasesDrill drill={drill} assignment={assignment} />;
    default:               return <Text>Unsupported drill type</Text>;
  }
}
```

**If `assignmentId` is not in params** (e.g. linked from bookmarks without it):

```ts
// Fallback: load learner drills and find matching assignment
const { data: allDrills } = useQuery(['learner-drills'], fetchLearnerDrills);
const assignmentId = allDrills?.drills.find(d => d._id === drillId)?.assignmentId;
```

### 8.3 Drill Completion Call

All drill components call this when the student finishes:

```ts
const completeMutation = useMutation({
  mutationFn: (body: CompleteDrillBody) =>
    apiClient.post(`/drills/${drillId}/complete`, body),
  onSuccess: (res) => {
    queryClient.invalidateQueries(['learner-drills']);
    router.replace({
      pathname: `/my-plan/drills/${drillId}/completed`,
      params: { assignmentId },
    });
  },
  onError: (err) => {
    Alert.alert('Error', extractErrorMessage(err));
  },
});

// Call with:
completeMutation.mutate({
  drillAssignmentId: assignmentId,
  score: calculateScore(),
  timeSpent: elapsedSeconds,
  platform: Platform.OS === 'ios' ? 'ios' : 'android',
  vocabularyResults: results,  // or whichever type applies
});
```

### 8.4 Completed Screen (`my-plan/drills/[id]/completed.tsx`)

```ts
const { assignmentId } = useLocalSearchParams();
const { data } = useQuery(
  ['drill-attempts', assignmentId],
  () => apiClient.get(`/drills/assignments/${assignmentId}/attempts`).then(r => r.data.data.attempts)
);

const latestAttempt = data?.[0];
```

Display:
- Score ring / percentage
- Time spent
- Review status (if grammar/sentence/summary — needs tutor review)
- "Practice More" → back to listing
- "Continue" → navigate to Practice tab

---

## 9. Drill Component Implementations

### Vocabulary Drill

Show each `target_sentence` one at a time:
1. Play `wordAudioUrl` → student hears the word
2. Play `sentenceAudioUrl` → student hears context sentence
3. Student records pronunciation of word
4. Score with SpeechAce:

```ts
const score = await apiClient.post('/speechace/score', {
  text: sentence.word,
  audioBase64,
});
// Also persist:
await apiClient.post('/pronunciations/drill-attempt', {
  text: sentence.word,
  audioBase64,
  drillId: drill._id,
  drillType: 'vocabulary',
  passingThreshold: 70,
});
```

5. Collect `vocabularyResults`, compute average score, call `complete`.

### Pronunciation Drill

Same as Vocabulary but uses `pronunciation_items`. Each item: `sound` → `word` → `sentence`.

### Roleplay Drill

Linear dialogue through `roleplay_scenes[].dialogue`:
- AI lines: play `audioUrl` via `expo-av`
- Student lines: student reads or records; optionally score with SpeechAce

On completion, collect `roleplayResults` with any performance data.

### Matching Drill

Drag-and-drop or tap-to-match pairs. Play `leftAudioUrl` / `rightAudioUrl` when items are tapped.

Count correct matches. On completion:
```ts
const matchingResults = {
  pairs: selectedPairs,
  correct: correctCount,
  total: drill.matching_pairs.length,
};
```

### Definition Drill

Given `hint`, student types or selects the `word`. Show `audioUrl` after answering.

### Grammar Drill

Present each `grammar_item.pattern`. Student writes an example sentence. Submitted for tutor review (`reviewStatus: 'pending'`).

```ts
grammarResults: [{
  pattern: item.pattern,
  studentExample: enteredText,
}]
```

### Sentence Drill / Sentence Writing

- `sentence`: Student practices `sentence_drill_word` — record pronunciation, play `sentence_drill_audio_url`.
- `sentence_writing`: Present each `sentence_writing_item`; student writes a sentence using the given `word`.

Both types require tutor review.

### Summary Drill

Student reads `article_content` (optionally plays `article_audio_url`), then writes a summary. Submitted for tutor review.

### Listening Drill

Play `listening_drill_audio_url`. Student listens and answers comprehension questions. Complete with `listeningResults`.

### Fill Blank Drill

For each `fill_blank_item`:
- Show `sentence` with blanks
- Play `audioUrl` if present
- Student selects correct answers from `blanks[].options`

```ts
fillBlankResults: [{
  itemIndex: idx,
  selectedAnswers: { blankPosition: selectedOption }[],
  correct: boolean,
}]
```

**Known issue**: The backend's `completeDrill` domain service currently does not map `fillBlankResults` into the persisted attempt data, though the API schema accepts it. Track this with backend team for a fix.

### Key Phrases Drill

Multiple-choice situational responses plus spoken production. See **[`KEY_PHRASES_DRILL.md`](./KEY_PHRASES_DRILL.md)** for the full flow, scoring, and API payload.

Summary:

1. For each `key_phrase_item`: show prompt (+ `promptAudioUrl`), learner picks an option, records themselves saying the **selected option**.
2. Score via `POST /speechace/score` with `text: selectedOption` (not the prompt).
3. Advance only when choice is correct **and** pronunciation ≥ **65%** (`PASS_THRESHOLD`).
4. After all questions: performance review → `POST /drills/:id/complete` with `keyPhrasesResults` and `performanceReviewSnapshot`.
5. **Do not** call `POST /pronunciations/drill-attempt` (unlike vocabulary/pronunciation drills).

```ts
const score = await apiClient.post('/speechace/score', {
  text: selectedOption,
  audioBase64,
});

completeMutation.mutate({
  drillAssignmentId: assignmentId,
  score: avgScore,
  timeSpent: elapsedSeconds,
  platform: Platform.OS === 'ios' ? 'ios' : 'android',
  keyPhrasesResults: {
    items: resultList,
    totalItems: items.length,
    correctItems,
    score: avgScore,
  },
  performanceReviewSnapshot: { /* see KEY_PHRASES_DRILL.md */ },
});
```

---

## 10. Audio Playback in Drills

Drill payloads carry `*AudioUrl` fields (Cloudinary CDN URLs). Play them with `expo-av`:

```ts
async function playDrillAudio(url: string) {
  await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
  const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
  sound.setOnPlaybackStatusUpdate(status => {
    if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
  });
}
```

Always unload sounds when the component unmounts:
```ts
useEffect(() => {
  return () => { sound?.unloadAsync(); };
}, []);
```

---

## 11. Expo Router File Structure

```
app/(student)/my-plan/
├── index.tsx                       ← Tabbed drill listing
└── drills/
    ├── [id].tsx                    ← Drill runner (type-dispatch)
    └── [id]/
        └── completed.tsx           ← Completion screen

components/drills/
├── VocabularyDrill.tsx
├── PronunciationDrill.tsx
├── RoleplayDrill.tsx
├── MatchingDrill.tsx
├── DefinitionDrill.tsx
├── GrammarDrill.tsx
├── SentenceDrill.tsx
├── SummaryDrill.tsx
├── ListeningDrill.tsx
├── FillBlankDrill.tsx
├── KeyPhrasesDrill.tsx
├── shared/
│   ├── DrillLayout.tsx             ← Common screen wrapper (header, progress bar, exit)
│   ├── DrillProgress.tsx           ← Step indicator
│   ├── DrillCompletionScreen.tsx   ← Score ring
│   ├── RecordingBar.tsx            ← Record/stop UI
│   └── PronunciationBreakdown.tsx  ← SpeechAce word score visualizer
```

---

## 12. State Management

```ts
// React Query
queryKeys.learnerDrills           → invalidate after complete mutation
queryKeys.drill(id)               → prefetch on DrillRow hover/press
['drill-attempts', assignmentId]  → load in completed screen

// Local state (within drill screen)
const [currentStep, setCurrentStep] = useState(0);
const [results, setResults] = useState([]);
const startTime = useRef(Date.now());
const elapsedSeconds = () => Math.floor((Date.now() - startTime.current) / 1000);
```

---

## 13. Performance Notes

- Use `FlashList` for the drill listing (can have 100+ items).
- Implement `React.memo` on `DrillRow` — it won't re-render if the drill data didn't change.
- Prefetch drill detail on `DrillRow` long-press or visible mount:

```ts
const prefetch = useQueryClient();
function onDrillVisible(drillId: string) {
  prefetch.prefetchQuery(['drill', drillId], () => fetchDrill(drillId));
}
```

- Audio URLs are CDN-served — they cache well. Preload `wordAudioUrl` on the step before it's needed.

---

## 14. Edge Cases & Error Handling

| Scenario | Handling |
|----------|---------|
| `assignmentId` missing | Fetch from learner drills listing and find match |
| Drill not found (404) | Show "Drill not found" screen with back button |
| Complete call fails | Show error alert; preserve results in local state for retry |
| `fillBlankResults` not persisted | Cosmetic only — score still saves; await backend fix |
| Tutor-reviewed types (grammar, sentence, summary) | Show "Awaiting review" badge on completion screen |
| Streak update | Backend handles automatically on `score ≥ 70` for `role === 'user'` |
| Overdue drills | Display with red "Overdue" badge; still allow completion |
| Audio URL missing | Show play button in disabled/greyed state |

---

## 15. Acceptance Checklist

- [ ] Drill listing loads with Ongoing / Reviewed / Completed tabs
- [ ] Drill row navigates to runner with correct `assignmentId` in params
- [ ] All 12 drill types render in the runner (including `key_phrases`)
- [ ] Audio plays correctly for all drill types that have audio URLs
- [ ] Pronunciation drills record audio, score via SpeechAce, and persist attempt
- [ ] Key phrases: multiple choice + Speechace on selected option; **no** `POST /pronunciations/drill-attempt`; complete with `keyPhrasesResults` (see [KEY_PHRASES_DRILL.md](./KEY_PHRASES_DRILL.md))
- [ ] `POST /drills/:id/complete` sent with correct body including `platform`
- [ ] Completion screen shows score and attempt history
- [ ] React Query cache invalidated after completion (listing refreshes)
- [ ] Tutor-reviewed types show "awaiting review" status
- [ ] FlashList renders 100+ drills smoothly
- [ ] Audio unloads correctly on component unmount (no memory leaks)
- [ ] `drillAssignmentId` always included in complete body
