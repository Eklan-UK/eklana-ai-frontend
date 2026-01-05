# Complete User Flows: Admin, Tutor, and Learner

## Table of Contents
1. [Admin Flow](#admin-flow)
2. [Tutor Flow](#tutor-flow)
3. [Learner Flow](#learner-flow)
4. [Cross-Role Interactions](#cross-role-interactions)
5. [Data Flow Diagrams](#data-flow-diagrams)

---

## 🔴 ADMIN FLOW

### **Authentication & Entry**
- **Login**: `/auth/login` → Redirects to `/admin/dashboard`
- **Dashboard**: `/admin/dashboard` - Overview of all operations

### **Dashboard Overview** (`/admin/dashboard`)
**Features:**
- **Stats Cards**:
  - Total Active Learners
  - Total Drills
  - Discovery Calls Today
  - Videos Awaiting Review
- **Recent Activity**: Timeline of learner activities
- **Learners Requiring Action**: Table of learners needing attention
- **Quick Actions**: Link to Drill Builder

### **Learner Management**

#### **1. View All Learners** (`/admin/Learners`)
- **Features**:
  - List all learners with search/filter
  - View learner status (Active/Inactive)
  - Quick access to learner profiles
- **Actions**:
  - Click learner → View detailed profile
  - Filter by status, search by name/email

#### **2. Learner Profile** (`/admin/learners/[id]`)
**Sections:**
- **Profile Information**:
  - Name, Email, Signup Date, Status
- **Assigned Drills**:
  - List of all drills assigned to learner
  - Drill type, difficulty, dates
  - Active/Inactive status
- **Pronunciation Analytics**:
  - Overall stats (total assignments, completed, average score, pass rate)
  - Problem areas (top incorrect letters/phonemes)
  - Word-level progress with attempts and best scores
  - Accuracy trends over time

### **Drill Management**

#### **1. Drill Builder** (`/admin/drill`)
**Features:**
- **List All Drills**:
  - Search by title/context
  - Filter by type, difficulty, active status
  - View assigned count, dates, status
- **Actions per Drill**:
  - **Edit**: Modify drill details
  - **Delete**: Remove drill (with confirmation)
  - **View**: See drill details
  - **Assign**: Navigate to assignment page

#### **2. Create Drill** (`/admin/drills/create`)
**Drill Types Supported:**
- Vocabulary
- Roleplay
- Matching
- Definition
- Grammar
- Sentence Writing
- Summary

**Form Fields:**
- Title, Type, Difficulty
- Date, Duration (days)
- Context/Scenario
- Type-specific fields (target sentences, dialogue, pairs, etc.)
- Audio example URL (optional)

**Workflow:**
1. Fill in drill details
2. Select drill type
3. Add type-specific content
4. Save → Creates drill and DrillAssignment records for assigned learners

#### **3. Drill Assignment** (`/admin/drills/assignment`)
**Features:**
- **List All Drills**:
  - Search and filter drills
  - View assignment count
- **Action**: "Assign to Students" button → `/admin/drills/assignment/[drillId]`

#### **4. Assign Drill to Learners** (`/admin/drills/assignment/[drillId]`)
**Workflow:**
1. View drill details (left side)
2. Select learners from list (right side)
   - Search learners
   - Checkbox selection
   - Select All / Deselect All
3. Set optional due date
4. Submit → Creates `DrillAssignment` records
5. Redirects to assignment list

### **Pronunciation Management**

#### **1. Pronunciation List** (`/admin/pronunciations`)
**Features:**
- **List All Pronunciations**:
  - Search by title/text
  - Filter by difficulty, active status
  - Audio playback preview
- **Actions**:
  - "Assign to Students" → `/admin/pronunciations/assignment/[pronunciationId]`
  - "Upload Pronunciation" → `/admin/pronunciations/create`

#### **2. Create Pronunciation** (`/admin/pronunciations/create`)
**Form Fields:**
- Title, Description (optional)
- Text to practice (required)
- Phonetic transcription (optional)
- Difficulty level (beginner/intermediate/advanced)
- Tags (comma-separated, optional)
- **Audio File (OPTIONAL)**:
  - If uploaded: Uses uploaded audio for playback
  - If not uploaded: Automatically uses TTS (Text-to-Speech)
- **Workflow**:
  1. Fill in pronunciation details
  2. Optionally upload audio file
  3. Submit → Creates pronunciation record
  4. Redirects to pronunciations list

#### **3. Assign Pronunciation** (`/admin/pronunciations/assignment/[pronunciationId]`)
**Workflow:**
1. View pronunciation details (left side)
2. Select learners (right side)
   - Search learners
   - Checkbox selection
   - Select All / Deselect All
3. Set optional due date
4. Submit → Creates `PronunciationAssignment` records
5. Redirects to pronunciations list

### **Admin Capabilities Summary**
✅ Create and manage drills
✅ Create and manage pronunciations
✅ Assign drills to learners
✅ Assign pronunciations to learners
✅ View all learners
✅ View learner profiles with analytics
✅ View pronunciation analytics per learner
✅ Edit/Delete drills
✅ Monitor overall system activity

---

## 🟢 TUTOR FLOW

### **Authentication & Entry**
- **Login**: `/auth/login` → Redirects to `/tutor/dashboard`
- **Dashboard**: `/tutor/dashboard` - Overview of tutor's operations

### **Dashboard Overview** (`/tutor/dashboard`)
**Features:**
- **Stats Cards**:
  - Total Drills
  - Active Drills
  - Total Students
  - Completed Today
- **Quick Actions**: "Create New Drill" button
- **Recent Drills**: List of recently created drills
- **Recent Students**: List of assigned students

### **Student Management**

#### **1. View All Students** (`/tutor/students`)
**Features:**
- **Stats**:
  - Total Students
  - Total Completed Drills
  - Active Drills
- **Student List**:
  - Search students
  - View student name, email
  - View progress (completed drills, active drills)
  - Last activity timestamp
  - Progress bar
- **Action**: Click student → View detailed profile

#### **2. Student Profile** (`/tutor/students/[id]`)
**Sections:**
- **Student Information**:
  - Name, Email, Profile details
- **Assigned Drills**:
  - List of drills assigned to this student
  - Drill status and progress
- **Quick Actions**:
  - "Assign New Drill" → `/tutor/drills/create?student=[id]`

### **Drill Management**

#### **1. My Drills** (`/tutor/drills`)
**Features:**
- **List All Created Drills**:
  - Search drills
  - Filter by active/inactive status
  - View drill details (type, difficulty, assigned count)
- **Actions per Drill**:
  - **View**: See drill details
  - **Edit**: Modify drill
  - **Delete**: Remove drill
- **Quick Action**: "Create New Drill" button

#### **2. Create Drill** (`/tutor/drills/create`)
**Features:**
- **Same as Admin** but with tutor context:
  - All drill types supported
  - Can assign to own students during creation
  - File upload, clipboard paste, document parsing
  - Template downloads
  - Auto-save draft functionality
- **Workflow**:
  1. Fill in drill details
  2. Select drill type
  3. Add type-specific content
  4. Select students to assign (from tutor's student list)
  5. Save → Creates drill and DrillAssignment records

#### **3. Drill Detail** (`/tutor/drills/[id]`)
**Features:**
- View complete drill details
- See assigned students
- Edit drill
- Delete drill
- View drill statistics

#### **4. Edit Drill** (`/tutor/drills/[id]/edit`)
**Features:**
- Edit all drill fields
- Update assignments
- Save changes

### **Tutor Capabilities Summary**
✅ Create drills (all types)
✅ Assign drills to own students
✅ View own students
✅ View student profiles
✅ Edit/Delete own drills
✅ View drill statistics
✅ Monitor student progress

---

## 🔵 LEARNER FLOW

### **Authentication & Entry**
- **Login**: `/auth/login` → Redirects to `/account` (dashboard)
- **Onboarding** (if new user): `/account/onboarding` → Multi-step setup

### **Onboarding Flow** (`/account/onboarding`)
**Steps:**
1. **User Type Selection** (`/account/onboarding/user-type`)
2. **Name** (`/account/onboarding/name`)
3. **Nationality** (`/account/onboarding/nationality`)
4. **Language** (`/account/onboarding/language`)
5. **Learning Goals** (`/account/onboarding/learning-goals`)
6. **Complete** → Redirects to dashboard

### **Dashboard** (`/account`)
**Features:**
- **Welcome Section**:
  - Personalized greeting
  - Streak counter
  - Notifications
- **Today's Focus Card**:
  - Active drills summary
  - Quick access to practice
- **Drill Sections**:
  - **Active Drills**: Drills due today or in progress
  - **Upcoming Drills**: Drills scheduled for future
  - **Missed Drills**: Overdue drills
- **Quick Actions**:
  - View all drills
  - Start practice
  - View pronunciations

### **Drill Management**

#### **1. My Drills** (`/account/drills`)
**Features:**
- **Tabs**:
  - **Ongoing**: Active + Missed drills (with count badge)
  - **Upcoming**: Future drills (with count badge)
  - **Completed**: Finished drills (with count badge)
- **Drill Cards**:
  - Title, Type, Difficulty
  - Due date, Status badge
  - Assigned by information
  - **"Start" button** → `/account/drills/[id]?assignmentId=[id]`
- **Filtering**: Based on date-based status logic

#### **2. Drill Practice** (`/account/drills/[id]`)
**Features:**
- **Drill Practice Interface**:
  - Type-specific practice UI
  - Vocabulary: Word matching, sentence practice
  - Roleplay: Interactive dialogue
  - Matching: Pair matching exercises
  - Definition: Word definitions
  - Grammar: Pattern exercises
  - Sentence Writing: Writing practice
  - Summary: Article reading and summarization
- **Progress Tracking**:
  - Completion status
  - Score tracking
  - Time spent
- **Workflow**:
  1. View drill instructions
  2. Complete practice exercises
  3. Submit answers
  4. View results
  5. Mark as completed → Updates DrillAssignment status

### **Pronunciation Management**

#### **1. My Pronunciations** (`/account/pronunciations`)
**Features:**
- **Stats Cards**:
  - Total, Completed, In Progress, Pending
- **Search & Filter**:
  - Search by title/text
  - Filter by status
- **Pronunciation Cards**:
  - Title, Phonetic transcription
  - Text to practice
  - Difficulty badge
  - Status badge
  - Audio playback button
  - Attempt count and best score
  - Due date
  - **"Practice Now" button** → `/account/pronunciations/[pronunciationId]?assignmentId=[id]`

#### **2. Pronunciation Practice** (`/account/pronunciations/[pronunciationId]`)
**Complete Practice Flow:**
1. **View Pronunciation**:
   - Title, Phonetic, Text
   - Description (if available)
   - Status badge (Completed/In Progress)

2. **Audio Playback**:
   - **If audio uploaded**: Play uploaded audio
   - **If no audio**: Automatically use TTS (Text-to-Speech)
   - Controls: Play, Replay, Stop

3. **Recording**:
   - Click "Start Recording"
   - Speak the pronunciation
   - Click "Stop Recording"
   - Preview recorded audio

4. **Submission**:
   - Click "Submit"
   - Audio sent to Speechace API for evaluation
   - Receives score (0-100%)

5. **Feedback & Results**:
   - **If Passed (≥70%)**:
     - Green checkmark
     - Score displayed
     - "Continue to Next" button
     - Assignment marked as completed
   - **If Failed (<70%)**:
     - Orange warning
     - Score displayed
     - **Incorrect letters/phonemes highlighted**
     - Word-level scores shown
     - Text feedback displayed
     - **"Try Again" button** → Retry recording

6. **Retry Logic**:
   - Learner can retry unlimited times
   - Each attempt is tracked
   - Best score is saved
   - Must pass (≥70%) to proceed
   - All attempts stored in `PronunciationAttempt` collection

7. **Attempt History**:
   - View all previous attempts
   - See scores and pass/fail status
   - Track improvement over time

### **Practice Activities**

#### **1. Practice Hub** (`/account/practice`)
**Categories:**
- **Pronunciation**: General pronunciation practice
- **Speaking**: Speaking exercises
- **Listening**: Listening comprehension
- **AI Conversation**: AI-powered conversation practice

#### **2. Pronunciation Practice** (`/account/practice/pronunciation`)
**Features:**
- Pre-defined word list
- TTS playback
- Recording interface
- Speechace evaluation
- Score display

#### **3. Speaking Practice** (`/account/practice/speaking`)
**Features:**
- Speaking exercises
- Recording capabilities
- Feedback system

#### **4. Listening Practice** (`/account/practice/listening`)
**Features:**
- Audio conversations
- Comprehension questions
- Multiple choice answers
- Score tracking

#### **5. AI Conversation** (`/account/practice/ai`)
**Features:**
- Real-time AI conversation
- Voice input/output
- TTS for AI responses
- Conversation history
- Natural language practice

### **Profile & Settings**

#### **1. Profile** (`/account/profile`)
- View profile information
- Edit profile (`/account/profile/edit`)
- Update photo (`/account/profile/photo/capture` or `record-video`)

#### **2. Settings** (`/account/settings`)
**Sections:**
- **General Settings**:
  - Language preferences
  - Theme settings
  - Notifications
- **Lesson Settings** (`/account/settings/lesson`):
  - Voice selection
  - Accent preferences
  - Speed settings
- **Learning Settings**:
  - Goals
  - Learning style
- **Account Settings**:
  - Password change
  - Privacy settings
  - Subscriptions
  - Terms & Conditions

### **Additional Features**

#### **1. Goals** (`/account/goals`)
- Set learning goals
- Track progress

#### **2. Streak** (`/account/streak`)
- View daily practice streak
- Motivation tracking

#### **3. Tracker** (`/account/tracker`)
- Progress tracking
- Activity history

#### **4. Voice Calibration** (`/account/voice-calibration`)
- Calibrate voice settings
- Improve recognition accuracy

### **Learner Capabilities Summary**
✅ View assigned drills
✅ Practice drills (all types)
✅ View assigned pronunciations
✅ Practice pronunciations with audio/TTS
✅ Record and submit pronunciation attempts
✅ Retry until passing (70% threshold)
✅ View attempt history and scores
✅ Track progress and analytics
✅ Access practice activities (speaking, listening, AI)
✅ Manage profile and settings
✅ Set learning goals
✅ Track streaks and progress

---

## 🔄 CROSS-ROLE INTERACTIONS

### **Admin → Learner**
1. **Assign Drills**:
   - Admin creates drill → Assigns to learners → Creates `DrillAssignment`
   - Learner sees drill in `/account/drills`
2. **Assign Pronunciations**:
   - Admin creates pronunciation → Assigns to learners → Creates `PronunciationAssignment`
   - Learner sees pronunciation in `/account/pronunciations`
3. **Monitor Progress**:
   - Admin views learner profile → Sees drill completion, pronunciation analytics
   - Admin can identify problem areas and intervene

### **Tutor → Learner**
1. **Assign Drills**:
   - Tutor creates drill → Assigns to own students → Creates `DrillAssignment`
   - Learner sees drill in `/account/drills`
2. **Monitor Students**:
   - Tutor views student profile → Sees progress and completion
   - Tutor can assign new drills based on performance

### **Learner → System**
1. **Complete Drills**:
   - Learner practices drill → Submits → Creates `DrillAttempt`
   - Updates `DrillAssignment` status to "completed"
2. **Practice Pronunciations**:
   - Learner records pronunciation → Submits → Creates `PronunciationAttempt`
   - Speechace evaluates → Updates `PronunciationAssignment` status
   - Must pass (≥70%) to complete

---

## 📊 DATA FLOW DIAGRAMS

### **Drill Assignment Flow**
```
Admin/Tutor
  ↓
Create Drill
  ↓
Assign to Learners
  ↓
Creates DrillAssignment (status: pending)
  ↓
Learner sees in /account/drills
  ↓
Learner clicks "Start"
  ↓
Practices drill
  ↓
Submits completion
  ↓
Creates DrillAttempt
  ↓
Updates DrillAssignment (status: completed)
```

### **Pronunciation Assignment Flow**
```
Admin
  ↓
Create Pronunciation (with/without audio)
  ↓
Assign to Learners
  ↓
Creates PronunciationAssignment (status: pending)
  ↓
Learner sees in /account/pronunciations
  ↓
Learner clicks "Practice Now"
  ↓
Listens to audio (uploaded or TTS)
  ↓
Records pronunciation
  ↓
Submits attempt
  ↓
Speechace evaluates (score 0-100%)
  ↓
Creates PronunciationAttempt
  ↓
If score ≥ 70%:
  → Updates PronunciationAssignment (status: completed)
  → Learner can proceed
If score < 70%:
  → Shows feedback (incorrect letters/phonemes)
  → Learner must retry
  → Repeat until passing
```

### **Analytics Flow**
```
Learner completes activities
  ↓
Creates DrillAttempt / PronunciationAttempt
  ↓
System tracks:
  - Scores
  - Attempts
  - Incorrect letters/phonemes
  - Completion status
  ↓
Admin/Tutor views learner profile
  ↓
Sees analytics:
  - Overall progress
  - Problem areas
  - Word-level stats
  - Accuracy trends
```

---

## 🎯 KEY FEATURES BY ROLE

### **Admin Exclusive**
- ✅ Create pronunciations
- ✅ View all learners (system-wide)
- ✅ View pronunciation analytics for any learner
- ✅ Manage all drills (not just own)
- ✅ System-wide dashboard

### **Tutor Exclusive**
- ✅ Create drills for own students
- ✅ View own students only
- ✅ Assign drills to assigned students
- ✅ Monitor student progress

### **Learner Exclusive**
- ✅ Practice drills
- ✅ Practice pronunciations with recording
- ✅ Retry pronunciations until passing
- ✅ View own progress and analytics
- ✅ Access practice activities
- ✅ Set learning goals

### **Shared Features**
- ✅ View assigned drills (Admin/Tutor assign, Learner views)
- ✅ View drill details
- ✅ Authentication and session management
- ✅ Profile management

---

## 🔐 AUTHENTICATION & AUTHORIZATION

### **Route Protection**
- **Admin Routes**: `/admin/*` - Requires `admin` role
- **Tutor Routes**: `/tutor/*` - Requires `tutor` role
- **Learner Routes**: `/account/*` - Requires `learner` role

### **API Route Protection**
- All API routes use `withRole` middleware
- Role-based access control enforced
- Session-based authentication (Better Auth)

---

## 📱 RESPONSIVE DESIGN

All pages are responsive:
- **Mobile**: Optimized for mobile devices
- **Tablet**: Adaptive layouts
- **Desktop**: Full-featured interfaces

---

## 🚀 PERFORMANCE OPTIMIZATIONS

- **React Query**: Caching and request deduplication
- **ISR (Incremental Static Regeneration)**: Server components with revalidation
- **Offline Support**: Cached sessions for offline access
- **Optimistic Updates**: Immediate UI feedback
- **Code Splitting**: Lazy loading of components

---

This document provides a complete overview of all user flows across the entire application. Each role has distinct capabilities while maintaining seamless interactions through the shared drill and pronunciation systems.

