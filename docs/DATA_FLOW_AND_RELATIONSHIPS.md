# Data Flow and Relationships - Complete Documentation

## Table of Contents

1. [Entity Relationship Diagram (ERD)](#entity-relationship-diagram-erd)
2. [Database Models](#database-models)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [API Request/Response Flow](#api-requestresponse-flow)
5. [State Management Flow](#state-management-flow)
6. [Data Relationships](#data-relationships)

---

## 📊 Entity Relationship Diagram (ERD)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA                              │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│    User      │
│──────────────│
│ _id (PK)     │
│ email        │◄──────────┐
│ role         │          │
│ firstName    │          │
│ lastName     │          │
│ isActive     │          │
└──────┬───────┘          │
       │                  │
       │ 1:1              │
       │                  │
       ▼                  │
┌──────────────┐          │
│   Learner    │          │
│──────────────│          │
│ _id (PK)     │          │
│ userId (FK)  │──────────┘
│ tutorId (FK) │──┐
│ status       │  │
│ subjects[]   │  │
└──────┬───────┘  │
       │          │
       │ 1:N      │ 1:N
       │          │
       ▼          ▼
┌──────────────────────────────┐
│   DrillAssignment            │
│──────────────────────────────│
│ _id (PK)                     │
│ drillId (FK)                 │
│ learnerId (FK)               │
│ assignedBy (FK)              │
│ status                        │
│ dueDate                       │
│ completedAt                  │
└──────┬───────────────────────┘
       │
       │ 1:N
       │
       ▼
┌──────────────┐
│ DrillAttempt │
│──────────────│
│ _id (PK)     │
│ drillAssignmentId (FK)       │
│ learnerId (FK)               │
│ drillId (FK)                │
│ score                        │
│ timeSpent                   │
│ vocabularyResults            │
│ roleplayResults              │
│ matchingResults              │
│ ... (type-specific results)  │
└──────────────┘

┌──────────────┐
│    Drill     │
│──────────────│
│ _id (PK)     │
│ title        │
│ type         │
│ difficulty   │
│ date         │
│ createdBy (FK)               │
│ target_sentences[]           │
│ roleplay_scenes[]            │
│ matching_pairs[]             │
│ ... (type-specific fields)   │
└──────────────┘

┌──────────────────────────────┐
│   Pronunciation              │
│──────────────────────────────│
│ _id (PK)                     │
│ title                        │
│ text                         │
│ phonetic                     │
│ difficulty                   │
│ audioUrl (optional)          │
│ useTTS                       │
│ createdBy (FK)               │
│ tags[]                       │
└──────┬───────────────────────┘
       │
       │ 1:N
       │
       ▼
┌──────────────────────────────┐
│ PronunciationAssignment      │
│──────────────────────────────│
│ _id (PK)                     │
│ pronunciationId (FK)         │
│ learnerId (FK)               │
│ assignedBy (FK)              │
│ status                        │
│ attemptsCount                │
│ bestScore                     │
│ lastAttemptAt                 │
└──────┬───────────────────────┘
       │
       │ 1:N
       │
       ▼
┌──────────────────────────────┐
│ PronunciationAttempt         │
│──────────────────────────────│
│ _id (PK)                     │
│ pronunciationAssignmentId (FK)│
│ pronunciationId (FK)         │
│ learnerId (FK)                │
│ textScore                     │
│ fluencyScore                  │
│ passed                        │
│ wordScores[]                  │
│ incorrectLetters[]            │
│ incorrectPhonemes[]            │
│ audioUrl                      │
│ attemptNumber                 │
└──────────────────────────────┘

┌──────────────────────────────┐
│   RecentActivity             │
│──────────────────────────────│
│ _id (PK)                     │
│ userId (FK)                  │
│ type                         │
│ resourceId                   │
│ action                       │
│ metadata                      │
│ createdAt                    │
└──────────────────────────────┘
```

---

## 🗄️ Database Models

### **1. User Model**

```typescript
User {
  _id: ObjectId (PK)
  email: String (unique)
  role: 'admin' | 'learner' | 'tutor'
  firstName: String
  lastName: String
  isActive: Boolean
  avatar: String
  // ... other fields
}
```

**Relationships:**

- `1:1` with `Learner` (via `userId`)
- `1:N` with `Drill` (via `createdBy`)
- `1:N` with `DrillAssignment` (via `assignedBy`)
- `1:N` with `Pronunciation` (via `createdBy`)
- `1:N` with `PronunciationAssignment` (via `assignedBy`)
- `1:N` with `RecentActivity` (via `userId`)

### **2. Learner Model**

```typescript
Learner {
  _id: ObjectId (PK)
  userId: ObjectId (FK → User, unique)
  tutorId: ObjectId (FK → User, optional)
  status: 'active' | 'inactive' | 'on-hold' | 'graduated'
  subjects: String[]
  learningGoals: String[]
  // ... other fields
}
```

**Relationships:**

- `1:1` with `User` (via `userId`)
- `N:1` with `User` (via `tutorId`) - assigned tutor
- `1:N` with `DrillAssignment` (via `learnerId`)
- `1:N` with `DrillAttempt` (via `learnerId`)
- `1:N` with `PronunciationAssignment` (via `learnerId`)
- `1:N` with `PronunciationAttempt` (via `learnerId`)

### **3. Drill Model**

```typescript
Drill {
  _id: ObjectId (PK)
  title: String
  type: 'vocabulary' | 'roleplay' | 'matching' | 'definition' | 'grammar' | 'sentence_writing' | 'summary'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  date: Date
  duration_days: Number
  createdBy: ObjectId (FK → User)
  target_sentences: Array
  roleplay_scenes: Array
  matching_pairs: Array
  // ... type-specific fields
}
```

**Relationships:**

- `N:1` with `User` (via `createdBy`)
- `1:N` with `DrillAssignment` (via `drillId`)
- `1:N` with `DrillAttempt` (via `drillId`)

### **4. DrillAssignment Model**

```typescript
DrillAssignment {
  _id: ObjectId (PK)
  drillId: ObjectId (FK → Drill)
  learnerId: ObjectId (FK → Learner)
  assignedBy: ObjectId (FK → User)
  assignedAt: Date
  dueDate: Date (optional)
  status: 'pending' | 'in-progress' | 'completed' | 'overdue' | 'skipped'
  completedAt: Date (optional)
}
```

**Relationships:**

- `N:1` with `Drill` (via `drillId`)
- `N:1` with `Learner` (via `learnerId`)
- `N:1` with `User` (via `assignedBy`)
- `1:N` with `DrillAttempt` (via `drillAssignmentId`)

**Unique Constraint:** `(drillId, learnerId)` - prevents duplicate assignments

### **5. DrillAttempt Model**

```typescript
DrillAttempt {
  _id: ObjectId (PK)
  drillAssignmentId: ObjectId (FK → DrillAssignment)
  learnerId: ObjectId (FK → Learner)
  drillId: ObjectId (FK → Drill)
  startedAt: Date
  completedAt: Date (optional)
  timeSpent: Number (seconds)
  score: Number (0-100)
  vocabularyResults: Object (optional)
  roleplayResults: Object (optional)
  matchingResults: Object (optional)
  // ... type-specific results
}
```

**Relationships:**

- `N:1` with `DrillAssignment` (via `drillAssignmentId`)
- `N:1` with `Learner` (via `learnerId`)
- `N:1` with `Drill` (via `drillId`)

### **6. Pronunciation Model**

```typescript
Pronunciation {
  _id: ObjectId (PK)
  title: String
  text: String
  phonetic: String (optional)
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  audioUrl: String (optional)
  useTTS: Boolean
  createdBy: ObjectId (FK → User)
  tags: String[]
  isActive: Boolean
}
```

**Relationships:**

- `N:1` with `User` (via `createdBy`)
- `1:N` with `PronunciationAssignment` (via `pronunciationId`)
- `1:N` with `PronunciationAttempt` (via `pronunciationId`)

### **7. PronunciationAssignment Model**

```typescript
PronunciationAssignment {
  _id: ObjectId (PK)
  pronunciationId: ObjectId (FK → Pronunciation)
  learnerId: ObjectId (FK → Learner)
  assignedBy: ObjectId (FK → User)
  assignedAt: Date
  dueDate: Date (optional)
  status: 'pending' | 'in-progress' | 'completed' | 'overdue' | 'skipped'
  completedAt: Date (optional)
  attemptsCount: Number
  bestScore: Number (0-100, optional)
  lastAttemptAt: Date (optional)
}
```

**Relationships:**

- `N:1` with `Pronunciation` (via `pronunciationId`)
- `N:1` with `Learner` (via `learnerId`)
- `N:1` with `User` (via `assignedBy`)
- `1:N` with `PronunciationAttempt` (via `pronunciationAssignmentId`)

**Unique Constraint:** `(pronunciationId, learnerId)` - prevents duplicate assignments

### **8. PronunciationAttempt Model**

```typescript
PronunciationAttempt {
  _id: ObjectId (PK)
  pronunciationAssignmentId: ObjectId (FK → PronunciationAssignment)
  pronunciationId: ObjectId (FK → Pronunciation)
  learnerId: ObjectId (FK → Learner)
  textScore: Number (0-100)
  fluencyScore: Number (0-100, optional)
  passed: Boolean
  passingThreshold: Number (default: 70)
  wordScores: Array
  incorrectLetters: String[]
  incorrectPhonemes: String[]
  audioUrl: String (optional)
  textFeedback: String (optional)
  attemptNumber: Number
}
```

**Relationships:**

- `N:1` with `PronunciationAssignment` (via `pronunciationAssignmentId`)
- `N:1` with `Pronunciation` (via `pronunciationId`)
- `N:1` with `Learner` (via `learnerId`)

### **9. RecentActivity Model**

```typescript
RecentActivity {
  _id: ObjectId (PK)
  userId: ObjectId (FK → User)
  type: String ('drill' | 'pronunciation' | 'practice')
  resourceId: ObjectId
  action: String ('viewed' | 'completed' | 'started')
  metadata: Object (optional)
  createdAt: Date
}
```

**Relationships:**

- `N:1` with `User` (via `userId`)

---

## 🔄 Data Flow Diagrams

### **Drill Assignment Flow**

```
┌─────────────┐
│ Admin/Tutor │
└──────┬──────┘
       │
       │ 1. POST /api/v1/drills
       │    { title, type, difficulty, ... }
       ▼
┌─────────────────────┐
│   Drill Created     │
│   (MongoDB)         │
└──────┬──────────────┘
       │
       │ 2. POST /api/v1/drills/[id]/assign
       │    { learnerIds: [...], dueDate? }
       ▼
┌─────────────────────┐
│ DrillAssignment     │
│ Created (per learner)│
│ status: 'pending'    │
└──────┬──────────────┘
       │
       │ 3. Learner views /account/drills
       │    GET /api/v1/drills/learner/my-drills
       ▼
┌─────────────────────┐
│ Frontend displays    │
│ assigned drills      │
└──────┬──────────────┘
       │
       │ 4. Learner clicks "Start"
       │    Navigate to /account/drills/[id]
       ▼
┌─────────────────────┐
│ Drill Practice UI   │
│ (Type-specific)     │
└──────┬──────────────┘
       │
       │ 5. Learner completes practice
       │    POST /api/v1/drills/[id]/attempt
       │    { answers, timeSpent, ... }
       ▼
┌─────────────────────┐
│ DrillAttempt        │
│ Created             │
│ Updates:            │
│ - DrillAssignment   │
│   status: 'completed'│
│ - completedAt       │
└─────────────────────┘
```

### **Pronunciation Assignment Flow**

```
┌─────────────┐
│    Admin    │
└──────┬──────┘
       │
       │ 1. POST /api/v1/pronunciations
       │    FormData { title, text, audio?, ... }
       │    → Upload audio to Cloudinary (if provided)
       ▼
┌─────────────────────┐
│  Pronunciation      │
│  Created            │
│  - audioUrl (if uploaded)│
│  - useTTS: !audioUrl │
└──────┬──────────────┘
       │
       │ 2. POST /api/v1/pronunciations/[id]/assign
       │    { learnerIds: [...], dueDate? }
       ▼
┌─────────────────────┐
│ Pronunciation       │
│ Assignment Created  │
│ (per learner)       │
│ status: 'pending'    │
└──────┬──────────────┘
       │
       │ 3. Learner views /account/pronunciations
       │    GET /api/v1/pronunciations/learner/my-pronunciations
       ▼
┌─────────────────────┐
│ Frontend displays    │
│ assigned pronunciations│
└──────┬──────────────┘
       │
       │ 4. Learner clicks "Practice"
       │    Navigate to /account/pronunciations/[id]
       ▼
┌─────────────────────┐
│ Pronunciation UI    │
│ - Audio playback    │
│   (uploaded or TTS)  │
│ - Recording interface│
└──────┬──────────────┘
       │
       │ 5. Learner records & submits
       │    POST /api/v1/pronunciations/[id]/attempt
       │    { audioBase64, ... }
       │
       │    Backend:
       │    a. Upload audio to Cloudinary
       │    b. Call Speechace API
       │    c. Process results
       ▼
┌─────────────────────┐
│ PronunciationAttempt│
│ Created             │
│ - textScore         │
│ - passed (≥70%)     │
│ - incorrectLetters  │
│ - incorrectPhonemes │
│
│ Updates:            │
│ - Pronunciation     │
│   Assignment:       │
│   * attemptsCount++ │
│   * bestScore       │
│   * status: 'completed' (if passed)│
└─────────────────────┘
```

### **Analytics Flow**

```
┌─────────────────────────────────────────────────────────┐
│                    DATA COLLECTION                        │
└─────────────────────────────────────────────────────────┘

Learner Activity
    │
    ├──► DrillAttempt
    │    ├── score
    │    ├── timeSpent
    │    └── type-specific results
    │
    └──► PronunciationAttempt
         ├── textScore
         ├── passed
         ├── incorrectLetters
         └── incorrectPhonemes

┌─────────────────────────────────────────────────────────┐
│                    DATA AGGREGATION                       │
└─────────────────────────────────────────────────────────┘

GET /api/v1/pronunciations/learner/[learnerId]/analytics
    │
    ├──► Query PronunciationAttempt
    │    └── Aggregate:
    │        - Average score
    │        - Pass rate
    │        - Top incorrect letters/phonemes
    │        - Daily trends
    │
    ├──► Query PronunciationAssignment
    │    └── Aggregate:
    │        - Total assignments
    │        - Completed count
    │        - In-progress count
    │
    └──► Query DrillAttempt
         └── Aggregate:
             - Completion rate
             - Average scores
             - Time spent

┌─────────────────────────────────────────────────────────┐
│                    DATA PRESENTATION                      │
└─────────────────────────────────────────────────────────┘

Admin/Tutor Dashboard
    │
    ├──► Overall Progress
    │    - Total assignments
    │    - Completion rate
    │    - Average scores
    │
    ├──► Problem Areas
    │    - Incorrect letters
    │    - Incorrect phonemes
    │    - Frequency counts
    │
    ├──► Accuracy Trends
    │    - Daily scores
    │    - Improvement over time
    │
    └──► Word-Level Stats
         - Per pronunciation
         - Attempts per word
         - Best scores
```

---

## 🌐 API Request/Response Flow

### **Request Flow**

```
┌──────────────┐
│   Frontend   │
│  (Next.js)   │
└──────┬───────┘
       │
       │ 1. User Action
       │    (Click, Form Submit)
       ▼
┌──────────────┐
│ React Query  │
│   Hook       │
│ (useMutation)│
└──────┬───────┘
       │
       │ 2. API Client
       │    (apiRequest/apiClient)
       ▼
┌──────────────┐
│ Next.js API  │
│   Route      │
│ /api/v1/...  │
└──────┬───────┘
       │
       │ 3. Middleware
       │    (withRole/withAuth)
       │    - Authentication
       │    - Authorization
       ▼
┌──────────────┐
│   Handler    │
│  Function    │
└──────┬───────┘
       │
       │ 4. Database
       │    (connectToDatabase)
       │    - Mongoose Models
       │    - Queries/Updates
       ▼
┌──────────────┐
│   MongoDB    │
│  Database    │
└──────┬───────┘
       │
       │ 5. External Services
       │    (if needed)
       │    - Cloudinary (file upload)
       │    - Speechace (pronunciation)
       │    - TTS (text-to-speech)
       ▼
┌──────────────┐
│   Response   │
│   JSON       │
│   { code,    │
│     message, │
│     data }   │
└──────┬───────┘
       │
       │ 6. React Query
       │    - Cache update
       │    - UI re-render
       ▼
┌──────────────┐
│   Frontend   │
│   Updated    │
└──────────────┘
```

### **Response Structure**

```typescript
// Success Response
{
  code: 'Success',
  message: 'Operation completed successfully',
  data: {
    // Response data
  }
}

// Error Response
{
  code: 'ValidationError' | 'NotFoundError' | 'ServerError' | 'AuthenticationError',
  message: 'Error description',
  errors?: Array<{ field: string, message: string }> // For validation errors
}
```

---

## 🔄 State Management Flow

### **React Query Flow**

```
┌─────────────────────────────────────────────────────────┐
│                    QUERY FLOW                              │
└─────────────────────────────────────────────────────────┘

Component Mount
    │
    ├──► useQuery Hook
    │    (e.g., useLearnerDrills)
    │
    ├──► Check Cache
    │    └──► If cached & fresh → Return cached data
    │
    ├──► If not cached or stale
    │    └──► Fetch from API
    │         └──► Update cache
    │
    └──► Return data to component

┌─────────────────────────────────────────────────────────┐
│                    MUTATION FLOW                           │
└─────────────────────────────────────────────────────────┘

User Action
    │
    ├──► useMutation Hook
    │    (e.g., useCreateDrill)
    │
    ├──► Optimistic Update (optional)
    │    └──► Update UI immediately
    │
    ├──► API Call
    │    └──► POST/PUT/DELETE
    │
    ├──► On Success
    │    ├──► Invalidate queries
    │    │    └──► Refetch related data
    │    └──► Update cache
    │
    └──► On Error
         └──► Rollback optimistic update
              └──► Show error message
```

### **Authentication State Flow**

```
┌─────────────────────────────────────────────────────────┐
│              AUTHENTICATION STATE (Zustand)               │
└─────────────────────────────────────────────────────────┘

App Initialization
    │
    ├──► AuthStore (Zustand)
    │    └──► Check localStorage
    │         └──► Restore session
    │
    ├──► Background Session Check
    │    └──► GET /api/v1/users/current
    │         └──► Update store
    │
    └──► Route Protection
         └──► AuthGuard
              ├──► If authenticated → Allow access
              └──► If not → Redirect to login
```

---

## 🔗 Data Relationships

### **One-to-One Relationships**

1. **User ↔ Learner**
   - One User can have one Learner profile
   - `Learner.userId` → `User._id` (unique)

### **One-to-Many Relationships**

1. **User → Drill**

   - One User (admin/tutor) can create many Drills
   - `Drill.createdBy` → `User._id`

2. **User → Pronunciation**

   - One User (admin) can create many Pronunciations
   - `Pronunciation.createdBy` → `User._id`

3. **User → DrillAssignment**

   - One User can assign many Drills
   - `DrillAssignment.assignedBy` → `User._id`

4. **User → PronunciationAssignment**

   - One User can assign many Pronunciations
   - `PronunciationAssignment.assignedBy` → `User._id`

5. **Learner → DrillAssignment**

   - One Learner can have many Drill assignments
   - `DrillAssignment.learnerId` → `Learner._id`

6. **Learner → PronunciationAssignment**

   - One Learner can have many Pronunciation assignments
   - `PronunciationAssignment.learnerId` → `Learner._id`

7. **Drill → DrillAssignment**

   - One Drill can be assigned to many Learners
   - `DrillAssignment.drillId` → `Drill._id`

8. **Pronunciation → PronunciationAssignment**

   - One Pronunciation can be assigned to many Learners
   - `PronunciationAssignment.pronunciationId` → `Pronunciation._id`

9. **DrillAssignment → DrillAttempt**

   - One DrillAssignment can have many Attempts
   - `DrillAttempt.drillAssignmentId` → `DrillAssignment._id`

10. **PronunciationAssignment → PronunciationAttempt**
    - One PronunciationAssignment can have many Attempts
    - `PronunciationAttempt.pronunciationAssignmentId` → `PronunciationAssignment._id`

### **Many-to-Many Relationships (via Junction Tables)**

1. **User ↔ Learner (Tutor Assignment)**

   - Many Users (tutors) can be assigned to many Learners
   - Implemented via `Learner.tutorId` → `User._id`
   - Note: Currently one tutor per learner, but can be extended

2. **Drill ↔ Learner (via DrillAssignment)**

   - Many Drills can be assigned to many Learners
   - Junction table: `DrillAssignment`
   - Unique constraint: `(drillId, learnerId)`

3. **Pronunciation ↔ Learner (via PronunciationAssignment)**
   - Many Pronunciations can be assigned to many Learners
   - Junction table: `PronunciationAssignment`
   - Unique constraint: `(pronunciationId, learnerId)`

---

## 📈 Data Aggregation Patterns

### **Learner Progress Calculation**

```javascript
// Get learner's drill progress
DrillAssignment.aggregate([
  { $match: { learnerId } },
  {
    $group: {
      _id: "$status",
      count: { $sum: 1 },
    },
  },
]);

// Get learner's pronunciation analytics
PronunciationAttempt.aggregate([
  { $match: { learnerId } },
  {
    $group: {
      _id: null,
      avgScore: { $avg: "$textScore" },
      passRate: {
        $avg: { $cond: ["$passed", 1, 0] },
      },
      totalAttempts: { $sum: 1 },
    },
  },
]);
```

### **Problem Area Identification**

```javascript
// Find most problematic letters/phonemes
PronunciationAttempt.aggregate([
  { $match: { learnerId } },
  { $unwind: "$incorrectLetters" },
  {
    $group: {
      _id: "$incorrectLetters",
      count: { $sum: 1 },
    },
  },
  { $sort: { count: -1 } },
  { $limit: 10 },
]);
```

---

## 🔐 Data Integrity Constraints

### **Unique Constraints**

1. **User.email** - Unique email addresses
2. **Learner.userId** - One learner profile per user
3. **DrillAssignment (drillId, learnerId)** - No duplicate assignments
4. **PronunciationAssignment (pronunciationId, learnerId)** - No duplicate assignments

### **Referential Integrity**

- All foreign keys reference valid documents
- Cascade delete considerations:
  - Deleting a User → Consider impact on Learner, Drills, Assignments
  - Deleting a Drill → Consider impact on DrillAssignments
  - Deleting a Pronunciation → Consider impact on PronunciationAssignments

### **Indexes for Performance**

**User:**

- `email` (unique)
- `role, isActive`

**Learner:**

- `userId` (unique)
- `tutorId`
- `status`

**Drill:**

- `createdBy, createdAt`
- `type, difficulty`
- `isActive`

**DrillAssignment:**

- `(drillId, learnerId)` (unique compound)
- `learnerId, status, dueDate`
- `assignedBy, assignedAt`

**DrillAttempt:**

- `drillAssignmentId, completedAt`
- `learnerId, completedAt`
- `drillId, completedAt`

**Pronunciation:**

- `createdBy, createdAt`
- `difficulty, isActive`
- `text` (text search)

**PronunciationAssignment:**

- `(pronunciationId, learnerId)` (unique compound)
- `learnerId, status, dueDate`
- `assignedBy, assignedAt`

**PronunciationAttempt:**

- `pronunciationAssignmentId, attemptNumber`
- `learnerId, createdAt`
- `pronunciationId, passed`
- `learnerId, passed, createdAt`

---

## 🎯 Data Flow Summary

### **Creation Flow**

```
Admin/Tutor → Creates Drill/Pronunciation
           → Assigns to Learners
           → Creates Assignment Records
           → Learners see in their dashboard
```

### **Practice Flow**

```
Learner → Views Assignment
       → Starts Practice
       → Completes Exercise
       → Submits Attempt
       → Creates Attempt Record
       → Updates Assignment Status
       → Analytics Updated
```

### **Analytics Flow**

```
System → Collects Attempt Data
      → Aggregates Statistics
      → Calculates Progress
      → Identifies Problem Areas
      → Displays to Admin/Tutor
```

---

This comprehensive documentation covers all data relationships, flows, and patterns in the application. Use this as a reference for understanding how data moves through the system and how entities relate to each other.
