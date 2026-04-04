# Classes feature — implementation summary

Single reference for what shipped per phase, what the old verify scripts checked, and how Classes code touches MongoDB.

---

## Phase 0 — Foundations

**What was implemented**

- Domain types: `ClassSeries`, `ClassEnrollment`, `ClassSession`, `SessionAttendance`, `RescheduleRequest` in `src/domain/classes/class.types.ts`.
- API-shaped types in `src/domain/classes/class.api.types.ts` (admin list/create/detail, stubs for later phases).
- Barrel export `src/domain/classes/index.ts`.
- `.env.example` entries for classes timezone and optional video providers (`CLASSES_DEFAULT_TIMEZONE`, `GOOGLE_CALENDAR_*`, `ZOOM_*`).

**Auth pattern (for all Classes routes)**

- Browser: `apiClient` uses `withCredentials: true` so session cookies are sent (`src/lib/api/axios.ts`).
- Handlers: use `withRole` from `src/lib/api/middleware.ts` with the right role per route prefix (`admin`, `tutor`, `user`).

**What `verify-phase-0-classes.sh` did**

- Required those domain files and `.env.example`.
- Grepped `class.types.ts` / `class.api.types.ts` for expected type names.
- Ran `npx tsc --noEmit`.

---

## Phase 1 — Admin API + admin UI on real data

**What was implemented**

- Mongoose models: `class-series`, `class-enrollment`, `class-session`.
- `ClassRepository`: create (transaction: series + enrollments + first session with generated `meetingUrl`), `findAdminList`, `findById`, plus helpers used by later phases.
- Routes: `GET/POST /api/v1/admin/classes`, `GET/DELETE /api/v1/admin/classes/:classSeriesId` (DELETE soft-deletes via `isActive: false`).
- Client: `classesAPI` in `src/lib/api.ts`, React Query keys, `useAdminClasses`, `useCreateAdminClass`, `useAdminClassDetail`, DTO helpers under `src/lib/classes/`.
- Admin Classes page uses API instead of mocks.

**What `verify-phase-1-classes.sh` did**

- Checked those files exist, `classesAPI` and `queryKeys.classes` wired, then `tsc --noEmit`.
- Reminder printed: manual smoke with admin cookie on live `GET/POST` admin routes.

---

## Phase 2 — Tutor list + join

**What was implemented**

- `ClassRepository.findTutorList` (sessions for the logged-in tutor, join-window policy in mapper).
- `GET /api/v1/tutor/classes`.
- Tutor UI: `/tutor/classes` with client component; `TutorNav` links to Classes.

**What `verify-phase-2-classes.sh` did**

- File presence, `findTutorList`, `classesAPI.tutorList`, `useTutorClasses`, query key, TutorNav link, `tsc`.

---

## Phase 3 — Learner list + session detail

**What was implemented**

- `GET /api/v1/learner/classes`, `GET /api/v1/learner/sessions/:sessionId` (`findLearnerList`, `findSessionForLearner`).
- Student UI: `/account/classes` and bottom nav entry.

**What `verify-phase-3-classes.sh` did**

- File presence, `findLearnerList`, learner API + hooks, BottomNav, `tsc`.

---

## Phase 4 — Attendance

**What was implemented**

- Model `session-attendance`, `AttendanceRepository` (upsert learner attendance; tutor read aggregated rows).
- `POST /api/v1/learner/sessions/:sessionId/attendance`, `GET /api/v1/tutor/sessions/:sessionId/attendance`.
- Tutor session page for viewing attendance.

**What `verify-phase-4-classes.sh` did**

- File presence, attendance hooks and `classesAPI` methods, `tsc`.

---

## Phase 5 — Same-week reschedule

**What was implemented**

- `src/lib/classes/utc-week.ts`, `RescheduleService` (validates enrollment + same-week rule, updates session `startUtc`/`endUtc`).
- `GET /api/v1/learner/sessions/:sessionId/reschedule-options`, `POST .../reschedule`.

**What `verify-phase-5-classes.sh` did**

- File presence, reschedule hooks and API client, `tsc`.

---

## Phase 6 — Video provider decision (ADR)

**Decision (no separate OAuth required for MVP)**

- Primary path: store a **generic HTTPS `meetingUrl`** on each session at schedule time (e.g. `https://meet.eklan.ai/session-<sessionId>`).
- Optional later: use `GOOGLE_CALENDAR_*` / `ZOOM_*` from `.env.example` to generate links server-side; clients keep reading one `meetingUrl` field.

**What `verify-phase-6-classes.sh` did**

- Checked that the ADR file existed at `docs/adr/0001-classes-video-provider.md` and mentioned “generic meeting URL”. That file is removed; this section replaces it.

---

## Phase 7 — Class session reminders (cron + FCM)

**What was implemented**

- Model `session-reminder-dispatch`, `ClassReminderService` (windows ~60m and ~10m before `startUtc`, idempotent per session/kind), cron route `GET /api/v1/cron/class-session-reminders` (Bearer `CLASS_REMINDER_CRON_SECRET`).
- `NotificationType.CLASS_SESSION_REMINDER` in `src/lib/fcm-trigger.ts`; reads `FCMToken` to push to enrolled learners.

**What `verify-phase-7-classes.sh` did**

- File presence, FCM type grep, `.env.example` cron secret, `tsc`.

---

## Database read / write map (Classes)

Collections align with Mongoose models: `ClassSeries`, `ClassEnrollment`, `ClassSession`, `SessionAttendance`, `SessionReminderDispatch`. `User` and `FCMToken` are read for validation, display, or push.

| Action | HTTP | Route | DB |
|--------|------|-------|-----|
| Admin list classes | `GET` | `/api/v1/admin/classes` | **Read** — `ClassSeries`, `ClassSession`, `ClassEnrollment`, `User` |
| Create class | `POST` | `/api/v1/admin/classes` | **Write** — `ClassSeries`, `ClassEnrollment`, `ClassSession` (+ **Read** `User` to validate tutor/learners) |
| Admin class detail | `GET` | `/api/v1/admin/classes/:id` | **Read** — `ClassSeries`, `ClassSession`, `ClassEnrollment`, `User` |
| Soft-delete class | `DELETE` | `/api/v1/admin/classes/:id` | **Write** — `ClassSeries` (`isActive: false`) |
| Tutor list + join data | `GET` | `/api/v1/tutor/classes` | **Read** — `ClassSeries`, `ClassSession`, `ClassEnrollment` |
| Learner list | `GET` | `/api/v1/learner/classes` | **Read** — same family of collections, scoped to learner |
| Learner session detail | `GET` | `/api/v1/learner/sessions/:sessionId` | **Read** — `ClassSession`, `ClassSeries`, `ClassEnrollment`, `User` |
| Record attendance | `POST` | `/api/v1/learner/sessions/:sessionId/attendance` | **Read** session/series/enrollment; **Write** `SessionAttendance` |
| Tutor view attendance | `GET` | `/api/v1/tutor/sessions/:sessionId/attendance` | **Read** — `ClassSession`, `ClassSeries`, `ClassEnrollment`, `SessionAttendance` |
| Reschedule options | `GET` | `.../reschedule-options` | **Read** — `ClassSession`, `ClassSeries`, `ClassEnrollment` |
| Reschedule | `POST` | `.../reschedule` | **Read** then **Write** — `ClassSession` (`updateOne` on times) |
| Reminder cron | `GET` | `/api/v1/cron/class-session-reminders` | **Read** — `ClassSession`, `ClassSeries`, `ClassEnrollment`, `SessionReminderDispatch`, `FCMToken`; **Write** — `SessionReminderDispatch` after send/skip logic |

**Notes**

- `RescheduleRequest` exists in domain types for optional workflow; reschedule here updates `ClassSession` directly via service.
- No route should expose another user’s `meetingUrl` without enrollment checks (handled in repository/services).

---

*Last consolidated from phased docs and verify scripts (2026).*
