# Classes feature — implementation summary

Single reference for what shipped per phase, what the old verify scripts checked, and how Classes code touches MongoDB. Includes **tutor teaching hours** (weekly availability + reschedule filtering).

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

- `GET /api/v1/learner/classes`, `GET /api/v1/learner/sessions/:sessionId` (`findLearnerList`, `findSessionForLearner`). Session payload includes **`tutorId`** for downstream learner APIs (e.g. tutor hours).
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
- **Tutor availability (follow-on):** same-week offset candidates are **filtered** so each slot must fall inside the tutor’s **weekly windows** (IANA `timezone` on the tutor’s availability record), respect **block/open day exceptions**, and avoid overlapping the tutor’s **other sessions** (with optional **buffer minutes** between sessions). See **Tutor availability** below.

**What `verify-phase-5-classes.sh` did**

- File presence, reschedule hooks and API client, `tsc`.

---

## Tutor availability (teaching hours)

**Purpose**

- Tutors define **when they can teach**; learners only get reschedule options inside those windows, and learners with an active enrollment can **read** a summary of those hours on the session screen.

**Data model**

- Collection `tutor_availabilities` — Mongoose model `src/models/tutor-availability.ts`: `tutorId` (unique), `timezone` (IANA), `weeklyRules` (`weekday` 0–6 Sun–Sat, `startMin` / `endMin` minutes local), `exceptions` (`date` `YYYY-MM-DD`, `kind` `block` | `open`), `bufferMinutes`.

**Timezone rules**

- Weekly rules and exception **dates** are interpreted in **`TutorAvailability.timezone`**. This is separate from `ClassSeries.timezone` (still used for list buckets / same-week UTC policy elsewhere). Document both when debugging “why isn’t this slot offered?”.

**Backward compatibility**

- **No** `TutorAvailability` document for a tutor → reschedule options are **not** filtered by teaching hours (same as offset-only behavior). Conflict checks still apply with buffer **0**.
- Document exists with **empty** `weeklyRules` → tutor has explicitly saved “no windows”; learners get **no** reschedule slots until they add windows.

**APIs**

- `GET` / `PATCH` `/api/v1/tutor/availability` — authenticated **tutor** reads/updates their own record (`src/app/api/v1/tutor/availability/route.ts`).
- `GET` `/api/v1/learner/tutors/:tutorId/availability` — **learner** only if they have an **active enrollment** in any **active** series taught by that tutor (`src/app/api/v1/learner/tutors/[tutorId]/availability/route.ts`).

**Domain helpers**

- `src/domain/tutor-availability/availability-window.ts` — fits interval in weekly rules + exceptions.
- `src/domain/tutor-availability/session-conflict.ts` — overlap with buffer vs other `ClassSession` rows for the same tutor.
- `RescheduleService.getLearnerRescheduleSlots` and `rescheduleSession` apply both filters (`src/domain/classes/reschedule.service.ts`).

**UI**

- Tutor: `/tutor/availability` — weekly windows, timezone, exceptions, buffer; linked from **Hours** in `src/components/layout/TutorNav.tsx`.
- Learner: session detail `src/app/(student)/account/classes/[sessionId]/learner-session-client.tsx` shows teaching hours when rules exist; `GET /api/v1/learner/sessions/:sessionId` includes **`tutorId`** for fetching that summary.

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

Collections align with Mongoose models: `ClassSeries`, `ClassEnrollment`, `ClassSession`, `SessionAttendance`, `SessionReminderDispatch`, **`TutorAvailability`**. `User` and `FCMToken` are read for validation, display, or push.

| Action | HTTP | Route | DB |
|--------|------|-------|-----|
| Admin list classes | `GET` | `/api/v1/admin/classes` | **Read** — `ClassSeries`, `ClassSession`, `ClassEnrollment`, `User` |
| Create class | `POST` | `/api/v1/admin/classes` | **Write** — `ClassSeries`, `ClassEnrollment`, `ClassSession` (+ **Read** `User` to validate tutor/learners) |
| Admin class detail | `GET` | `/api/v1/admin/classes/:id` | **Read** — `ClassSeries`, `ClassSession`, `ClassEnrollment`, `User` |
| Soft-delete class | `DELETE` | `/api/v1/admin/classes/:id` | **Write** — `ClassSeries` (`isActive: false`) |
| Tutor list + join data | `GET` | `/api/v1/tutor/classes` | **Read** — `ClassSeries`, `ClassSession`, `ClassEnrollment` |
| Tutor availability (own) | `GET` / `PATCH` | `/api/v1/tutor/availability` | **Read** / **Write** — `TutorAvailability` |
| Learner tutor hours | `GET` | `/api/v1/learner/tutors/:tutorId/availability` | **Read** — `TutorAvailability`, `ClassSeries`, `ClassEnrollment` (enrollment gate) |
| Learner list | `GET` | `/api/v1/learner/classes` | **Read** — same family of collections, scoped to learner |
| Learner session detail | `GET` | `/api/v1/learner/sessions/:sessionId` | **Read** — `ClassSession`, `ClassSeries`, `ClassEnrollment`, `User` |
| Record attendance | `POST` | `/api/v1/learner/sessions/:sessionId/attendance` | **Read** session/series/enrollment; **Write** `SessionAttendance` |
| Tutor view attendance | `GET` | `/api/v1/tutor/sessions/:sessionId/attendance` | **Read** — `ClassSession`, `ClassSeries`, `ClassEnrollment`, `SessionAttendance` |
| Reschedule options | `GET` | `.../reschedule-options` | **Read** — `ClassSession`, `ClassSeries`, `ClassEnrollment`; optional **`TutorAvailability`**; **Read** other tutor `ClassSession` rows for overlap + buffer |
| Reschedule | `POST` | `.../reschedule` | **Read** then **Write** — `ClassSession` (`updateOne` on times); validates **`TutorAvailability`** + conflicts |
| Reminder cron | `GET` | `/api/v1/cron/class-session-reminders` | **Read** — `ClassSession`, `ClassSeries`, `ClassEnrollment`, `SessionReminderDispatch`, `FCMToken`; **Write** — `SessionReminderDispatch` after send/skip logic |

**Notes**

- `RescheduleRequest` exists in domain types for optional workflow; reschedule here updates `ClassSession` directly via service.
- No route should expose another user’s `meetingUrl` without enrollment checks (handled in repository/services).
- Learner **tutor availability** route returns 404 if the learner is not enrolled with that tutor (no calendar enumeration).

---

*Last consolidated from phased docs and verify scripts (2026); tutor availability section added to match current code.*
