# Classes Implementation (Eklana)

This document explains how the Classes feature works end-to-end: scheduling, delivery, attendance, and rescheduling, plus the core tech and files behind each part.

## 1) Feature overview

The Classes system is built around three roles:

- `admin`: schedules classes and manages class series.
- `tutor`: views assigned classes, teaches sessions, tracks attendance.
- `learner` (`user` role): views enrolled classes, joins sessions, records attendance, and can reschedule within policy.

At a data level, classes are modeled as:

- **Class series** (the course/group metadata),
- **Enrollments** (who is in the series),
- **Sessions** (time-bound teachable events with a Meet URL),
- **Attendance rows** (per session + learner),
- **Reminder dispatch records** (to avoid duplicate push reminders).

## 2) Core architecture

### Domain layer

Primary business logic lives in:

- `src/domain/classes/class.repository.ts`
- `src/domain/classes/reschedule.service.ts`
- `src/domain/classes/attendance.repository.ts`
- `src/domain/classes/class-reminder.service.ts`
- `src/domain/classes/class.mapper.ts`

This layer handles validation, scheduling invariants, role-aware filtering, and transformation to API DTOs.

### API layer

Role-scoped API routes expose class operations:

- Admin class CRUD/list/detail:
  - `src/app/api/v1/admin/classes/route.ts`
  - `src/app/api/v1/admin/classes/[classSeriesId]/route.ts`
- Tutor class list:
  - `src/app/api/v1/tutor/teaching-classes/route.ts`
- Learner class list:
  - `src/app/api/v1/learner/classes/route.ts`
- Attendance:
  - `src/app/api/v1/learner/sessions/[sessionId]/attendance/route.ts`
  - `src/app/api/v1/tutor/sessions/[sessionId]/attendance/route.ts`
- Reschedule:
  - `src/app/api/v1/learner/sessions/[sessionId]/reschedule-options/route.ts`
  - `src/app/api/v1/learner/sessions/[sessionId]/reschedule/route.ts`

All routes use auth/role middleware (`withRole`) and centralized error handling (`withErrorHandler`).

### Frontend data layer

React Query hooks in:

- `src/hooks/useClasses.ts`

These hooks wrap `classesAPI`/`tutorAPI`, handle caching, and invalidate relevant queries after mutations (schedule, delete, attendance, reschedule, etc.).

## 3) Data model

Mongoose models:

- `src/models/class-series.ts`
  - Tutor, class metadata, recurrence, timezone, active flag.
- `src/models/class-session.ts`
  - Session start/end UTC, meeting URL, status, sequence number.
- `src/models/class-enrollment.ts`
  - Active/withdrawn enrollment per learner per series.

Supporting models:

- `src/models/session-attendance.ts` (used by attendance repository),
- `src/models/session-reminder-dispatch.ts` (idempotent reminder sends),
- `src/models/fcm-token.ts` (push delivery targets).

## 4) Scheduling flow (admin)

When admin schedules a class (`POST /api/v1/admin/classes`):

1. Validate payload (IDs, times, class type, recurrence fields).
2. Verify tutor exists and has connected Google Calendar.
3. Verify learner IDs are valid `user` accounts.
4. Fetch tutor Google refresh token.
5. Create Google Calendar event + Google Meet link.
6. In a Mongo transaction:
   - create series,
   - create enrollments,
   - create first session with returned `meetingUrl`.
7. Return a mapped DTO for admin list UI.

Main implementation: `ClassRepository.create()` in `src/domain/classes/class.repository.ts`.

## 5) Google Calendar + Meet integration

Meet link generation is done via:

- `src/lib/api/google-calendar-events.ts`

It uses `googleapis` with tutor refresh token + app OAuth client:

- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`

It inserts an event with `conferenceData.createRequest` (`hangoutsMeet`) and extracts:

- `hangoutLink` or video `entryPoint`.

If this fails, repository logic maps technical errors into user-facing, actionable messages (network issues vs revoked/expired OAuth token).

## 6) Listing and access rules

`ClassRepository` provides role-aware list builders:

- `findAdminList()`
- `findTutorList()`
- `findLearnerList()`

Common behavior:

- scans active series,
- loads sessions + active enrollments,
- resolves tutor/learner profiles,
- maps to DTOs and bucket filters (`today`, `upcoming`),
- paginates after mapping.

Tutor/learner list paths apply join policy (`applyTutorJoinPolicy`) to avoid exposing join URLs outside allowed windows.

## 7) Attendance flow

### Learner attendance

- `POST /api/v1/learner/sessions/[sessionId]/attendance`
- Calls `AttendanceRepository.recordLearnerAttendance()`.
- Upserts one row per `(sessionId, learnerId)`.
- Default status is `present` (or `late` if requested), source `manual`.

### Tutor attendance roster

- `GET /api/v1/tutor/sessions/[sessionId]/attendance`
- Calls `AttendanceRepository.listForTutorSession()`.
- Returns enrolled learners with attendance status (`absent` if no row).

## 8) Rescheduling flow

Handled by `RescheduleService` in `src/domain/classes/reschedule.service.ts`.

Policy enforced:

- learner must be enrolled in active class,
- session must be reschedulable (not completed/cancelled),
- same duration as original session,
- must remain in same **UTC week** as original start,
- must be future time,
- must fit tutor weekly availability/exceptions,
- must not conflict with tutor sessions (including buffer minutes).

Endpoints:

- options: `GET /api/v1/learner/sessions/[sessionId]/reschedule-options`
- apply: `POST /api/v1/learner/sessions/[sessionId]/reschedule`

## 9) Reminder system

`ClassReminderService` (`src/domain/classes/class-reminder.service.ts`) sends FCM reminders around:

- ~60 minutes before start,
- ~10 minutes before start.

It records dispatch rows per `(sessionId, kind)` to prevent duplicate sends.

## 10) Time handling

- Session timestamps are stored in UTC (`startUtc`, `endUtc`).
- Weekly reschedule policy uses UTC week helpers:
  - `src/lib/classes/utc-week.ts`
- Tutor availability matching is timezone-aware through tutor availability services.

## 11) Reliability and safety patterns

- Transactional class creation (series + enrollments + first session).
- Role middleware on API routes.
- Explicit validation and typed DTOs.
- Soft delete for series (`isActive=false`) rather than destructive deletion.
- Defensive messaging for third-party Calendar failures.
- Query invalidation in hooks to keep admin/tutor/learner views synchronized.

## 12) Tech stack behind Classes

- **Next.js App Router** API routes
- **TypeScript**
- **MongoDB + Mongoose**
- **Google Calendar API (`googleapis`)** for Meet event creation
- **React Query** for client caching/mutations
- **FCM** for reminder notifications
- **Zod** for API input validation

