# AI-Assisted Drill Creation — Full Implementation

## UI Description & Technical Reference

This document describes what the tutor and admin see in the full AI-Assisted Drill Creation dashboard. The existing AI generation modal, drill builder, and chatbot sidebar do not change — this is the navigation layer that wraps them.

* **MVP Reference:** See `docs/ai-drill-generator.md`
* **Backend Implementation:** See `docs/ai-drill-creation-full-implementation.md` for information regarding the new endpoints.

---

## 1. Student List Page

When the tutor opens the **Students** section from the sidebar, they see a list of all students currently assigned to them by the admin.

* **UI Layout:** Each student appears as a card showing their name, profile picture, current week number, and a button to open their page. A search bar sits at the top to filter students by name.
* **Permissions:** Admins see all students in the system, not just their own.

### Routing & Data
* **Routes:**
  * Tutor Version: `/tutor/students`
  * Admin Version: `/admin/students`
* **Data Sources:**
  * Tutor: `GET /api/v1/tutor/students` (returns only students assigned to the logged-in tutor)
  * Admin: `GET /api/v1/users?role=learner`

> **Notes for Dev:**
> Tutor-student assignments live in the `tutor_assignments` collection via the `TutorAssignment` model. Use `getActiveLearnerIdsForTutor` from `src/domain/tutor-assignments/tutor-assignment.service.ts` to fetch the correct list.

---

## 2. Student Page

Clicking a student opens their individual profile page. This page dynamically toggles between two states depending on whether the student's context has been configured.

* **Routes:**
  * `/tutor/students/[studentId]`
  * `/admin/students/[studentId]`

### State A — First Time Setup
If the tutor has never set up this student's context, a configuration form blocks the main view. A short message explains that this information helps the AI personalize drills for this student and only needs to be completed once.

* **Form Fields:**
  * **Native Language** (Text input, Required — e.g., Korean)
  * **Professional Role** (Text input, Required — e.g., ICU Nurse)
  * **Hospital Unit** (Text input, Required — e.g., Rapid Response Unit)
  * **Country** (Text input, Required — e.g., United States)
  * **Proficiency Level** (Dropdown, Required — Beginner / Intermediate / Advanced)
  * **Goals** (Textarea, Required — what the student wants to improve)
  * **Simulation Weaknesses** (Textarea, Optional — weaknesses from the simulation test. *Note: Will be auto-populated in the future once simulation tests are automated.*)
* **Lifecycle Actions:**
  * **Check if context exists:** `GET /api/v1/students/[studentId]/context` (returns a `404` error if not set up yet).
  * **On Save:** Send a `POST /api/v1/students/[studentId]/context`. On success, transition immediately to State B without a full page reload.

### State B — Weekly Work View
Once context exists, the student page reveals all work assigned to that student, grouped systematically by week.

* **Week Calculation:** Weeks are calculated automatically from the student's `subscriptionActivatedAt` timestamp. Week 1 accounts for days 1–7, Week 2 accounts for days 8–14, etc. New weeks appear automatically over time without manual intervention.
* **UI Behavior:** The current week is expanded by default. Past weeks render collapsed but can be toggled open.
* **Weekly Elements:**
  * The week number and calendar date range.
  * All drills assigned that week (showing a type badge, difficulty badge, and status indicator).
  * The Weekly Challenge for that week if one has already been generated.
  * A **Create Drill** button.
* **Status Indicators:**
  * `Completed`: Student has finished the drill.
  * `In Progress`: Student has started but not finished.
  * `Pending`: Assigned but not yet started.
  * `Overdue`: Due date has passed and the drill remains uncompleted.
* **Item Types in the Weekly List:**
  * `type: 'drill_assignment'`: A regular drill assigned manually by the tutor.
  * `type: 'weekly_challenge'`: The system-generated weekly challenge for that week.
* **Data Constraints:** There is no limit on drills per week. The tutor can assign as many drills of any type as needed within a single week block.
* **Data Source:** `GET /api/v1/students/[studentId]/weeks` (returns an `items` array per week containing both types).
* **Anchor Point:** The weekly challenge assignment is anchored to the `weekStartDate` field, not its `createdAt` timestamp.

#### Edit Context Button
* Displayed at the top of State B.
* Opens the context form pre-filled with existing values.
* **On Save:** Fires a `POST /api/v1/students/[studentId]/context` (acts as an upsert, updating the record in place).

---

## 3. Creating a Drill from the Student Page

When the tutor clicks **Create Drill** inside a specific week block, the existing `AIGenerationModal` opens with the context locked to the current student.

1. **Modal Component:** `src/components/drills/AIGenerationModal.tsx` (re-use with zero foundational changes).
2. **Behavior:** Pass the `studentId` as a pre-selected, locked value. The tutor cannot change the target student from here.
3. **Downstream Flow:** Standard creation process follows (fill out the form -> AI generates -> preview screen appears with chatbot sidebar -> tutor refines and assigns).
4. **Placement:** Once assigned, the drill automatically places itself in the correct week tracking layout based on its `assignedAt` value.

### Network Requests
* **Save Drill:** `POST /api/v1/drills`
* **Assign Drill:** `POST /api/v1/drills/[drillId]/assignments`

---

## 4. Weekly Challenge in the Weekly View

Each week's automatically generated Weekly Challenge appears seamlessly in the weekly work view timeline alongside regular drills. 

* Tutors can track its completion status and see if the student has finished it.
* Weekly Challenges are strictly generated by the system, not created by the tutor. They appear autonomously.
* **Data Source:** `WeeklyChallenge` documents fetched by `learnerId`. The specific week number is calculated directly from the `weekStartDate` field, and returned as `type: 'weekly_challenge'` items in the weeks endpoint response payload.

---

## 5. Full Item Shape from Weeks Endpoint

A `GET /api/v1/students/[studentId]/weeks` call returns data structured as follows:

```json
{
  "weeks": [
    {
      "weekNumber": 1,
      "items": [
        {
          "type": "drill_assignment",
          "assignmentId": "...",
          "drillId": "...",
          "title": "...",
          "drillType": "vocabulary",
          "difficulty": "intermediate",
          "topic": "...",
          "part": "...",
          "status": "pending",
          "assignedAt": "...",
          "dueDate": "...",
          "completedAt": null
        },
        {
          "type": "weekly_challenge",
          "challengeId": "...",
          "weekStartDate": "...",
          "status": "ready",
          "totalEstimatedMinutes": 20,
          "drillSequence": [...]
        }
      ]
    }
  ]
}