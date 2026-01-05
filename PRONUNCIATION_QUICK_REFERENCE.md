# Pronunciation System - Quick Reference & Flow Diagram

## User Flows

### ADMIN FLOW (Creating Problems & Words)

```
┌─────────────────────────────────────────────────────────────┐
│  ADMIN: Create Global Pronunciation Problem                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
      ┌────────────────────────────────┐
      │ /admin/pronunciation-problems  │
      │  (List all problems)           │
      └────────┬───────────────────────┘
               │
               │ [Create New Problem]
               ▼
      ┌────────────────────────────────┐
      │ POST /api/v1/                  │
      │ pronunciation-problems         │
      │                                │
      │ Creates problem with:          │
      │ - Title                        │
      │ - Phonemes                     │
      │ - Difficulty                   │
      │ - isActive = true              │
      └────────┬───────────────────────┘
               │ [Problem Created]
               ▼
      ┌────────────────────────────────────┐
      │ /admin/pronunciation-problems/     │
      │ [slug]                             │  ◄─ THIS PAGE NEEDS TO EXIST
      │                                    │
      │ Shows:                             │
      │ - Problem details                  │
      │ - List of current words            │
      │ - [Add Word] button                │
      └────────┬───────────────────────────┘
               │
               │ [Add Word]
               ▼
      ┌────────────────────────────────┐
      │ Modal: Add Pronunciation Word  │  ◄─ NEEDS COMPONENT
      │                                │
      │ Input:                         │
      │ - Word text                    │
      │ - IPA transcription            │
      │ - Target phonemes              │
      │ - Audio file (or use TTS)      │
      └────────┬───────────────────────┘
               │
               │ [Save]
               ▼
      ┌────────────────────────────────────┐
      │ POST /api/v1/pronunciation-        │
      │ problems/[slug]/words              │
      │                                    │
      │ Uploads:                           │
      │ - Word details                     │
      │ - Audio file to Cloudinary         │
      │ - Audio URL to DB                  │
      └────────┬───────────────────────────┘
               │ [Word Created]
               ▼
      ┌────────────────────────────────┐
      │ Word added to problem           │
      │ Problem now shows word count    │
      │ Admin can add more words        │
      └────────────────────────────────┘
```

### LEARNER FLOW (Practicing & Progress Tracking)

```
┌──────────────────────────────────────────────┐
│ LEARNER: Start Pronunciation Practice       │
└────────────────┬─────────────────────────────┘
                 │
                 ▼
      ┌──────────────────────────────────┐
      │ /account/practice/pronunciation  │
      │ (List all global problems)       │
      │                                  │
      │ GET /api/v1/pronunciation-       │
      │ problems?isActive=true           │
      └────────┬─────────────────────────┘
               │ [Select Problem]
               ▼
      ┌────────────────────────────────────┐
      │ /account/practice/pronunciation/   │
      │ [slug]                             │
      │                                    │
      │ GET /api/v1/pronunciation-        │
      │ problems/[slug]                    │
      │                                    │
      │ Returns:                           │
      │ - Problem details                  │
      │ - All words in problem             │
      │ - Learner's progress               │
      │ - NEXT UNCOMPLETED WORD            │
      └────────┬─────────────────────────┘
               │ [Load Practice UI]
               ▼
      ┌──────────────────────────────────┐
      │ Practice Interface               │
      │                                  │
      │ Shows first uncompleted word:    │
      │ - Word text + IPA                │
      │ - Play audio button              │
      │ - Record button                  │
      │ - Progress bar                   │
      └────────┬──────────────────────────┘
               │ [Record & Submit]
               ▼
      ┌──────────────────────────────────────┐
      │ POST /api/v1/pronunciation-words/    │
      │ [wordId]/attempt                     │
      │                                      │
      │ Request:                             │
      │ - Audio base64                       │
      │ - Passing threshold (default: 70)    │
      │                                      │
      │ Server:                              │
      │ 1. Upload audio to Cloudinary        │
      │ 2. Send to Speechace for evaluation  │
      │ 3. Get accuracy score                │
      │ 4. Track phoneme errors              │
      └────────┬──────────────────────────────┘
               │
               ▼
      ┌────────────────────────────────────┐
      │ Evaluate Score                     │
      │                                    │
      │ IF accuracy >= 70 (passing):       │
      │ ├─ Mark word as PASSED             │
      │ ├─ Save to LearnerPronunciation    │
      │ │  Progress (passed: true)         │
      │ └─ Show success ✓                  │
      │                                    │
      │ IF accuracy < 70 (failing):        │
      │ ├─ Keep as NOT passed              │
      │ ├─ Update attempts counter         │
      │ ├─ Track weak phonemes             │
      │ └─ Show retry option               │
      └────────┬────────────────────────────┘
               │
               ▼
      ┌────────────────────────────────┐
      │ Next Word Logic                │
      │                                │
      │ Passed last word?              │
      │                                │
      │ ├─ YES: Get next uncompleted   │
      │ │       or show completion     │
      │ │       screen                 │
      │ │                              │
      │ └─ NO: Retry current word      │
      └────────┬───────────────────────┘
               │
               ▼
      ┌────────────────────────────────┐
      │ Problem Complete?              │
      │                                │
      │ ├─ YES: Show stats & celebrate │
      │ │                              │
      │ └─ NO: Continue with next word │
      └────────────────────────────────┘


RESUMING LATER (Next Session):
────────────────────────────────

User returns to same problem
     │
     ▼
GET /api/v1/pronunciation-problems/[slug]
     │
Returns:
     │
     ▼
- Problem details
- All words
- THIS USER'S PROGRESS
     │
     ▼
Find FIRST UNCOMPLETED WORD
(where passed !== true)
     │
     ▼
Load practice UI for that word
(seamless resume!) ✓
```

---

## Database Structure

### Pronunciation Problem (Global)
```
PronunciationProblem
├─ _id: ObjectId
├─ title: "Distinguishing R and L"
├─ slug: "distinguishing-r-and-l"
├─ description: "Learn to differentiate..."
├─ phonemes: ["r", "l"]
├─ difficulty: "intermediate"
├─ estimatedTimeMinutes: 10
├─ isActive: true
├─ createdBy: userId
└─ createdAt, updatedAt
```

### Pronunciation Word (Global)
```
PronunciationWord
├─ _id: ObjectId
├─ problemId: problemId (reference)
├─ word: "better"
├─ ipa: "/ˈbɛtər/"
├─ phonemes: ["ɛ", "t", "ə", "r"]
├─ audioUrl: "https://cloudinary.../audio.mp3" (optional)
├─ useTTS: true (if no audio)
├─ order: 1
├─ isActive: true
└─ createdAt, updatedAt
```

### Learner Progress (Per Learner, Per Word)
```
LearnerPronunciationProgress
├─ _id: ObjectId
├─ learnerId: learnerId (reference)
├─ problemId: problemId (reference)
├─ wordId: wordId (reference)
├─
├─ passed: true/false
├─ passedAt: 2026-01-04T...
├─
├─ attempts: 3
├─ accuracyScores: [65, 72, 85]
├─ bestScore: 85
├─ averageScore: 74
├─
├─ weakPhonemes: ["ɛ"]
├─ incorrectLetters: ["e"]
├─
├─ isChallenging: true (attempts > 3 or avgScore < 70)
├─ challengeLevel: "medium"
├─
├─ lastAttemptAt: 2026-01-04T...
└─ createdAt, updatedAt
```

### Pronunciation Attempt (Historical Record)
```
PronunciationAttempt
├─ _id: ObjectId
├─ learnerId: learnerId
├─ wordId: wordId
├─ audioUrl: "https://cloudinary.../attempt_123.mp3"
├─ score: 85
├─ incorrectPhonemes: ["ɛ"]
├─ incorrectLetters: []
├─ evaluationResult: { /* Speechace response */ }
└─ createdAt
```

---

## API Endpoints Status

### ✅ WORKING - Learner Practice
- `GET /api/v1/pronunciation-problems` → List global problems
- `GET /api/v1/pronunciation-problems/[slug]` → Get problem with words + learner progress
- `POST /api/v1/pronunciation-words/[wordId]/attempt` → Submit attempt & track progress

### ✅ PARTIALLY WORKING - Admin Management
- `GET /api/v1/pronunciation-problems/[slug]/words` → List words in problem
- `POST /api/v1/pronunciation-problems/[slug]/words` → Add word (backend ready)
- ❌ No UI to trigger POST

### ❌ MISSING - Admin & Tutor Analytics
- `GET /api/v1/learner-pronunciation-progress` → List all progress
- `GET /api/v1/learner-pronunciation-progress/[learnerId]/[problemId]` → Learner progress on problem
- `PATCH /api/v1/learner-pronunciation-progress/[id]` → Reset/override progress
- `DELETE /api/v1/learner-pronunciation-progress/[id]` → Clear progress

### ❌ MISSING - Word Management
- `PATCH /api/v1/pronunciation-words/[wordId]` → Update word
- `DELETE /api/v1/pronunciation-words/[wordId]` → Delete word

---

## Component Tree

### Admin Side
```
/admin/pronunciation-problems
├─ List all problems
├─ Create new problem
└─ [Problem] - click to edit
    ├─ /admin/pronunciation-problems/[slug]  ◄─ NEEDS TO EXIST
    │   ├─ Show problem details
    │   ├─ List current words
    │   └─ [Add Word] button
    │       └─ Modal: AddPronunciationWord
    │           ├─ Input: word, IPA, phonemes
    │           ├─ Toggle: Use TTS vs Upload
    │           ├─ Audio upload
    │           └─ [Save]
    │
    └─ /admin/pronunciation-analytics  ◄─ NEEDS TO EXIST
        ├─ Show learner progress
        ├─ Problem completion %
        └─ [Learner] - click for details
            └─ /admin/pronunciation-analytics/[learnerId]  ◄─ NEEDS TO EXIST
                ├─ Show progress per problem
                ├─ Show weak phonemes
                ├─ Show accuracy trends
                └─ [Export Report]
```

### Learner Side
```
/account/practice/pronunciation
├─ List all active global problems
└─ [Problem]
    └─ /account/practice/pronunciation/[slug]
        ├─ Problem intro
        ├─ Progress bar
        ├─ Current word:
        │   ├─ Word display
        │   ├─ IPA
        │   ├─ Play audio
        │   ├─ Record
        │   └─ [Submit]
        │
        ├─ Evaluation result:
        │   ├─ Show score
        │   ├─ Show mispronounced phonemes
        │   └─ [Next] or [Retry]
        │
        └─ Completion screen:
            ├─ Stats (accuracy, time)
            └─ [Continue Practicing] or [Back]
```

---

## Key Business Logic

### Progress Persistence
```typescript
// When learner submits attempt:
1. Evaluate pronunciation with Speechace
2. Get accuracy score (0-100)
3. Find or create LearnerPronunciationProgress record
4. Update:
   - attempts += 1
   - accuracyScores.push(score)
   - bestScore = Math.max(bestScore, score)
   - averageScore = sum / attempts
   - lastAttemptAt = now()

5. Check if PASSED (score >= threshold):
   IF passed AND NOT already marked:
   - Set passed = true
   - Set passedAt = now()
   - Mark as complete for this learner

6. Return to learner:
   IF score >= threshold: "✓ Passed! Next word..."
   IF score < threshold: "Try again. Focus on..."
```

### Resume Logic
```typescript
// When learner returns to problem:
1. Get problem with all words
2. For each word, check progress
3. Find words where passed !== true
4. Load FIRST uncompleted word
5. Show practice UI for that word

This ensures:
- Seamless resume
- No skipped words
- Continuous learning journey
```

---

## Testing Checklist

- [ ] Admin can create problem
- [ ] Admin can navigate to problem editor
- [ ] Admin can add multiple words
- [ ] Admin can upload audio or use TTS
- [ ] Learner can see all active problems
- [ ] Learner can start practice
- [ ] Learner can submit pronunciation attempt
- [ ] Speechace evaluation works
- [ ] Score recorded in database
- [ ] Learner marked as passed when score ≥ 70
- [ ] Learner resumes from first uncompleted word
- [ ] Progress persists across sessions
- [ ] Weak phonemes tracked correctly

---

## Quick Start (Implementation Order)

1. **Create Problem Editor UI** (`/admin/pronunciation-problems/[slug]/page.tsx`)
2. **Create Add Word Component** (`AddPronunciationWord.tsx`)
3. **Add missing backend endpoints** (PATCH/DELETE word)
4. **Test admin flow end-to-end**
5. **Create analytics dashboard** (bonus)

Done! System will be fully functional.
