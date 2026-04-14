# Pronunciation System Restructure - Implementation Plan

## Overview
Restructure pronunciation system from flat structure to hierarchical Problem → Word structure with enhanced challenge tracking.

## New Schema Design

### 1. PronunciationProblem Model
```typescript
{
  _id: ObjectId,
  title: "R–L Distinction",
  slug: "r-l-distinction", // URL-friendly identifier
  description: "Practice differentiating R and L sounds",
  phonemes: ["r", "l"], // Target phonemes for this problem
  difficulty: "beginner" | "intermediate" | "advanced",
  estimatedTimeMinutes: 5,
  createdBy: ObjectId (ref: User),
  isActive: true,
  order: 0, // Display order
  createdAt,
  updatedAt
}
```

### 2. PronunciationWord Model
```typescript
{
  _id: ObjectId,
  word: "Really",
  ipa: "/ˈrɪəli/",
  phonemes: ["r", "l"], // Phonemes in this word
  problemId: ObjectId (ref: PronunciationProblem),
  difficulty: "beginner" | "intermediate" | "advanced",
  audioUrl?: string, // Optional uploaded audio
  audioFileName?: string,
  useTTS: boolean, // Use TTS if no audio
  order: 0, // Order within problem
  createdBy: ObjectId (ref: User),
  isActive: true,
  createdAt,
  updatedAt
}
```

### 3. LearnerPronunciationProgress Model
```typescript
{
  _id: ObjectId,
  learnerId: ObjectId (ref: Learner),
  problemId: ObjectId (ref: PronunciationProblem),
  wordId: ObjectId (ref: PronunciationWord),
  
  // Attempt tracking
  attempts: 4,
  accuracyScores: [62, 71, 84, 92], // All attempt scores
  bestScore: 92,
  averageScore: 77.25,
  
  // Challenge indicators
  isChallenging: boolean, // true if attempts > 3 or averageScore < 70
  challengeLevel: "low" | "medium" | "high", // Based on attempts & scores
  
  // Phoneme-level tracking
  weakPhonemes: ["r"], // Phonemes with low scores
  incorrectLetters: ["r", "l"], // Letters frequently mispronounced
  
  // Status
  passed: true,
  passedAt: Date,
  lastAttemptAt: Date,
  
  createdAt,
  updatedAt
}
```

### 4. ProblemAssignment Model (NEW - for assigning problems to learners)
```typescript
{
  _id: ObjectId,
  problemId: ObjectId (ref: PronunciationProblem),
  learnerId: ObjectId (ref: Learner),
  assignedBy: ObjectId (ref: User),
  assignedAt: Date,
  dueDate?: Date,
  status: "pending" | "in-progress" | "completed" | "overdue",
  completedAt?: Date,
  
  // Aggregated progress
  totalWords: 10,
  wordsCompleted: 7,
  averageAccuracy: 82.5,
  totalAttempts: 24,
  weakPhonemes: ["r", "θ"],
  
  createdAt,
  updatedAt
}
```

### 5. PronunciationAttempt Model (Enhanced)
```typescript
{
  _id: ObjectId,
  learnerId: ObjectId (ref: Learner),
  problemId: ObjectId (ref: PronunciationProblem),
  wordId: ObjectId (ref: PronunciationWord),
  progressId: ObjectId (ref: LearnerPronunciationProgress),
  
  // Speechace results
  textScore: number,
  fluencyScore?: number,
  passed: boolean,
  passingThreshold: number,
  
  // Detailed scores
  wordScores: Array<{
    word: string,
    score: number,
    phonemes: Array<{
      phoneme: string,
      score: number
    }>
  }>,
  
  // Problem areas
  incorrectLetters: string[],
  incorrectPhonemes: string[],
  
  // Audio
  audioUrl?: string,
  
  // Metadata
  attemptNumber: number, // Sequential within word
  createdAt,
  updatedAt
}
```

## Enhanced Challenge Tracking

### Challenge Indicators
```typescript
// Calculate challenge level for a word
function calculateChallengeLevel(progress: LearnerPronunciationProgress) {
  const highAttempts = progress.attempts > 3;
  const lowAccuracy = progress.averageScore < 70;
  const persistentErrors = progress.weakPhonemes.length > 0;
  
  if (highAttempts && lowAccuracy) return "high";
  if (highAttempts || lowAccuracy) return "medium";
  if (persistentErrors) return "low";
  return null; // No challenge
}

// Identify challenging words for a learner
function getChallengingWords(learnerId: ObjectId) {
  return LearnerPronunciationProgress.find({
    learnerId,
    isChallenging: true,
    passed: false // Still struggling
  }).sort({ attempts: -1, averageScore: 1 });
}
```

## API Endpoints

### Problem Management (Admin)
- `GET /api/v1/pronunciation-problems` - List all problems
- `POST /api/v1/pronunciation-problems` - Create problem
- `GET /api/v1/pronunciation-problems/:id` - Get problem with words
- `PUT /api/v1/pronunciation-problems/:id` - Update problem
- `DELETE /api/v1/pronunciation-problems/:id` - Delete problem

### Word Management (Admin)
- `GET /api/v1/pronunciation-problems/:problemId/words` - List words in problem
- `POST /api/v1/pronunciation-problems/:problemId/words` - Add word to problem
- `PUT /api/v1/pronunciation-words/:id` - Update word
- `DELETE /api/v1/pronunciation-words/:id` - Delete word
- `PUT /api/v1/pronunciation-words/:id/reorder` - Reorder words

### Problem Assignment (Admin/Tutor)
- `POST /api/v1/pronunciation-problems/:id/assign` - Assign problem to learners
- `GET /api/v1/pronunciation-problems/learner/my-problems` - Get learner's assigned problems

### Learner Practice
- `GET /api/v1/pronunciation-problems/:slug` - Get problem for practice
- `POST /api/v1/pronunciation-words/:wordId/attempt` - Submit word attempt
- `GET /api/v1/pronunciation-words/:wordId/progress` - Get word progress

### Analytics
- `GET /api/v1/pronunciation-problems/:id/analytics` - Problem-level analytics
- `GET /api/v1/learners/:learnerId/pronunciation-challenges` - Get challenging words
- `GET /api/v1/learners/:learnerId/pronunciation-progress` - Overall progress

## Frontend Routes

### Admin
- `/admin/pronunciation-problems` - List all problems
- `/admin/pronunciation-problems/create` - Create new problem
- `/admin/pronunciation-problems/[id]` - View/edit problem + manage words
- `/admin/pronunciation-problems/[id]/assign` - Assign problem to learners

### Learner
- `/account/practice/pronunciation` - **Problem selection page** (NEW)
- `/account/practice/pronunciation/[slug]` - **Problem practice page** (NEW)
  - Shows problem description
  - Lists words in order
  - Word-by-word practice interface
  - Progress tracking
  - Challenge indicators

## Migration Strategy

### Phase 1: Add New Models (Non-Breaking)
1. Create new models alongside existing ones
2. Keep existing Pronunciation system working
3. Add new admin UI for problems/words

### Phase 2: Dual Support
1. Support both old and new systems
2. Allow admins to choose which to use
3. Migrate existing pronunciations to problems/words

### Phase 3: Full Migration
1. Deprecate old Pronunciation model
2. Migrate all data
3. Remove old code

## Key Features

### Challenge Tracking Logic
```typescript
// After each attempt, update challenge indicators
async function updateChallengeIndicators(progressId: ObjectId) {
  const progress = await LearnerPronunciationProgress.findById(progressId);
  
  // Calculate metrics
  const avgScore = progress.accuracyScores.reduce((a, b) => a + b, 0) / progress.attempts;
  const isChallenging = progress.attempts > 3 || avgScore < 70;
  
  // Determine challenge level
  let challengeLevel = null;
  if (progress.attempts > 5 && avgScore < 60) challengeLevel = "high";
  else if (progress.attempts > 3 || avgScore < 70) challengeLevel = "medium";
  else if (progress.weakPhonemes.length > 0) challengeLevel = "low";
  
  // Update progress
  progress.isChallenging = isChallenging;
  progress.challengeLevel = challengeLevel;
  progress.averageScore = avgScore;
  await progress.save();
  
  // Update problem assignment if all words completed
  await updateProblemAssignment(progress.problemId, progress.learnerId);
}
```

### Problem Progress Aggregation
```typescript
async function getProblemProgress(problemId: ObjectId, learnerId: ObjectId) {
  const progress = await LearnerPronunciationProgress.find({
    problemId,
    learnerId
  });
  
  const totalWords = await PronunciationWord.countDocuments({ problemId, isActive: true });
  const wordsCompleted = progress.filter(p => p.passed).length;
  const totalAttempts = progress.reduce((sum, p) => sum + p.attempts, 0);
  const avgAccuracy = progress.reduce((sum, p) => sum + p.averageScore, 0) / progress.length;
  
  // Aggregate weak phonemes
  const weakPhonemes = [...new Set(
    progress.flatMap(p => p.weakPhonemes)
  )];
  
  return {
    totalWords,
    wordsCompleted,
    wordsInProgress: progress.filter(p => !p.passed).length,
    averageAccuracy: avgAccuracy,
    totalAttempts,
    weakPhonemes,
    challengingWords: progress.filter(p => p.isChallenging).length
  };
}
```

## Benefits of This Approach

1. **Better Organization**: Problems group related words logically
2. **Scalability**: Admins can create unlimited problems/words
3. **Challenge Tracking**: Identify words learners struggle with
4. **Progressive Learning**: Sequential word practice within problems
5. **Rich Analytics**: Track at word, problem, and overall levels
6. **Admin Control**: Full control over content structure
7. **Learner Experience**: Clear progression through problems

## Implementation Priority

1. **High Priority**:
   - Create new models
   - Admin UI for problem/word management
   - Problem selection page for learners
   - Word practice interface

2. **Medium Priority**:
   - Challenge tracking logic
   - Problem assignment system
   - Analytics endpoints

3. **Low Priority**:
   - Migration from old system
   - Advanced analytics dashboard
   - Problem recommendations based on challenges

