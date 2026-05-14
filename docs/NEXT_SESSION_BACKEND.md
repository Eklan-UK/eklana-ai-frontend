# Next Session — Full Backend Flow

This document explains the complete backend lifecycle of a class session in Eklana: from creation by an admin, through a student finding it on the My Plan / Classes page, all the way to joining, attending, missing, and rescheduling.

---

## 1. Data Models

### ClassSeries (`class_series` collection)
Represents a group of sessions for one class booking.

| Field | Purpose |
|---|---|
| `tutorId` | Which tutor teaches it |
| `title` | Auto-generated or admin-set title |
| `classType` | `group` or `individual` |
| `timezone` | Tutor timezone for display labels |
| `totalSessionsPlanned` | How many sessions are planned in total |
| `scheduleDayLabels` | Human labels like `["Monday", "Wednesday"]` |
| `scheduleStartTime` / `scheduleEndTime` | Display time range (e.g. `09:00 – 10:00`) |
| `recurrenceRule` | `weekly` or `none` |
| `isActive` | Soft-delete flag |

### ClassSession (`class_sessions` collection)
Each individual session row for a series.

| Field | Purpose |
|---|---|
| `classSeriesId` | Links to the parent series |
| `tutorId` | Tutor for this session |
| `startUtc` / `endUtc` | Exact start/end times in UTC |
| `meetingUrl` | Google Meet link (from Google Calendar API) |
| `googleCalendarEventId` | Calendar event ID (for delete/replace on reschedule) |
| `isReschedule` | `true` if this session was moved from its original time |
| `status` | `scheduled` → `in_progress` → `completed` \| `cancelled` |
| `sequenceNumber` | Which session in the series (e.g. session 3 of 10) |

### ClassEnrollment
Links a learner to a series with a status of `active`. This is how the system knows which learners belong to which classes.

### SessionAttendance (`session_attendance` collection)
One row per `sessionId + learnerId`, created when attendance is recorded.

| Field | Purpose |
|---|---|
| `sessionId` | Which session |
| `learnerId` | Which learner |
| `status` | `present`, `late`, or `absent` |
| `source` | `manual` (learner taps Join) or other |
| `joinedAt` | Timestamp when they joined |

---

## 2. Class Creation (Admin)

**Route:** `POST /api/v1/admin/classes`  
**Who:** Admin only

The `ClassRepository.create()` method:

1. **Validates** tutor ID and learner IDs, and checks the tutor has a Google Calendar connection.
2. **Creates a Google Calendar event** with a Google Meet link via the tutor's OAuth refresh token — all enrolled learner emails and the tutor email are added as attendees. The `meetingUrl` comes from this.
3. **If Google Calendar fails**, the class is still saved, but without a `meetingUrl` (a `calendarSyncWarning` is returned).
4. **In a Mongo transaction**, creates three documents atomically:
   - One `ClassSeries` document
   - One `ClassEnrollment` per learner
   - One `ClassSession` for the first (or specified) session

Each subsequent session in a recurring series is added as a separate `ClassSession` document (manually or via admin scheduling).

---

## 3. The Student Sees It — `GET /api/v1/learner/classes`

**Route:** `GET /api/v1/learner/classes?bucket=today|upcoming|completed&limit=50&offset=0`  
**Who:** Authenticated student (`role: user`)

`ClassRepository.findLearnerList()` does the following:

1. Finds all `ClassEnrollment` rows where `learnerId = me` and `status = active`.
2. Loads all active `ClassSeries` the learner is enrolled in.
3. Loads all `ClassSession` rows for those series.
4. Loads all other enrolled users and the tutor for each series.
5. For **each series**, runs `mapSeriesToListItem()` which:
   - Calls `getNextSessionForList()` to find the **next session**.
   - Derives `status` (`upcoming`, `active`, `completed`) and `bucket` (`today`, `upcoming`, `completed`).
   - Builds a flat DTO including `nextSessionLabel`, `nextSessionId`, `nextSessionStartUtc`, `nextSessionIsReschedule`, `meetingUrl`, progress counters, etc.
6. Applies `applyTutorJoinPolicy()` — **strips the `meetingUrl`** from the response if the join window is not open (learner cannot see the meeting link until 15 minutes before start).
7. Optionally filters by `bucket` and applies pagination.

### How `getNextSessionForList` works
```
Sort all sessions by start time (ascending)
→ Return the first one that is NOT cancelled and whose end time is still in the future
→ If none found, fall back to the last non-cancelled session (so the card still shows something)
→ If still none, return null
```

### How class status is derived
| Condition | Status |
|---|---|
| All non-cancelled sessions are `completed` | `completed` |
| Completed count ≥ `totalSessionsPlanned` | `completed` |
| All session end times are in the past | `completed` |
| Next session `status === in_progress` or now is between start/end | `active` |
| Otherwise | `upcoming` |

---

## 4. The "Next Session" Card on My Plan / Drills Page

The `LearnerNextSessionCard` component is embedded in the Drills page and shows the student's most imminent upcoming session across all their enrolled classes.

The client hook `useLearnerClasses()` fetches the list above, then a helper (`pickNextLearnerSession`) picks the **earliest `nextSessionStartUtc`** across all returned classes to show a single "Next Session" card.

The card shows:
- **Starts in…** label (relative time until `nextSessionStartUtc`)
- Session label, reschedule badge if `nextSessionIsReschedule`
- Join button (enabled only within the 15-minute window, controlled by `meetingUrl` presence)

---

## 5. Reminders — Cron Job

**Route:** `GET /api/v1/cron/class-session-reminders` (secured with `CLASS_REMINDER_CRON_SECRET`)

`ClassReminderService.runDueReminders()` runs on a cron schedule and:

1. Looks for sessions whose `startUtc` falls within **T−60 min (±1 min)** or **T−10 min (±1 min)** from now.
2. Skips sessions that already have a `SessionReminderDispatch` record for that `kind` (idempotent — each reminder fires exactly once).
3. For each enrolled learner in that session, sends an **FCM push notification** to all their active device tokens:
   - `"Class starts in about 1 hour"` at T−60
   - `"Class starts in about 10 minutes"` at T−10
   - Notification body shows the class title and links to `/account/classes`.
4. Saves a `SessionReminderDispatch` row to prevent re-firing.

---

## 6. Joining a Session

The join button on the session card is only **enabled** when `meetingUrl` is present in the API response. The server only includes `meetingUrl` when:

```
now >= sessionStartUtc − 15 minutes
AND
now <= sessionEndUtc
```

This is enforced by `tutorMeetingUrlAllowed()` in `class.mapper.ts` before the DTO is returned. The student **cannot** obtain the Google Meet link before the join window opens.

When the student taps **Join Session**:
1. The app opens the `meetingUrl` in a new browser tab.
2. Immediately, it calls `POST /api/v1/learner/sessions/:sessionId/attendance` with `{ status: "present" }`.

### Attendance recording (`AttendanceRepository.recordLearnerAttendance`)
1. Checks the session exists.
2. Checks the series is still active.
3. Checks the learner has an active enrollment.
4. **Upserts** a `SessionAttendance` document (`findOneAndUpdate` with `upsert: true`), setting `status`, `source: manual`, and `joinedAt = now`.

---

## 7. Missed Sessions (Absent)

There is **no explicit "mark as missed" action** from the student side. A session is treated as missed by inference:

- When `GET /api/v1/learner/sessions/past` returns past sessions, `findLearnerPastSessionInstances()` queries `SessionAttendance` for each ended session.
- If **no attendance row** exists for a given `sessionId + learnerId`, the field `learnerAttendance` is returned as `"none"`.
- The frontend (`resolvePastSessionBadge`) treats `"none"` the same as absent/missed and displays an **amber "Missed"** badge on the past session card.

Tutors can also manually set attendance per learner via `POST /api/v1/tutor/sessions/:sessionId/attendance`.

---

## 8. Past Sessions — `GET /api/v1/learner/sessions/past`

`ClassRepository.findLearnerPastSessionInstances()` returns:
1. All ended sessions (`endUtc < now`, not cancelled) in enrolled active series.
2. Sorted **newest first**.
3. For each session, joins the `SessionAttendance` row to expose per-learner attendance.
4. Returns `sessionStatus` (the session-level status) and `learnerAttendance` (`present`, `late`, `absent` from attendance record, or `none` if no record exists).

---

## 9. Rescheduling

### Who can reschedule?
| Role | Endpoint | Restriction |
|---|---|---|
| Learner | `POST /api/v1/learner/sessions/:id/reschedule` | **Blocked** — always returns 403 |
| Tutor | `POST /api/v1/tutor/sessions/:id/reschedule` | Same-week only, own sessions only |
| Admin | `POST /api/v1/admin/sessions/:id/reschedule` | Same-week, full control |
| Admin (direct) | `POST /api/v1/admin/sessions/:id/reschedule-direct` | Any future date, no week restriction |

### Reschedule flow (tutor or admin)
1. **Get options:** `GET reschedule-options` → `RescheduleService.computeRescheduleSlotsForSession()` generates candidate slots by applying offsets from the original time (±2h, ±1d, ±2d), filtered by:
   - Must stay in same UTC Mon–Sun week as original.
   - Must fit tutor's weekly availability windows.
   - Must not conflict with the tutor's other active sessions or pending reservations (respecting buffer minutes).
2. **Reserve a slot:** `POST reserve-slot` → creates a short-lived pessimistic **slot reservation** (a temporary hold on that time) via `SlotReservationService.createRescheduleSlotHold`. Returns `reservationId` and `reservationToken`.
3. **Confirm reschedule:** `POST reschedule` with `{ newStartUtc, newEndUtc, reservationId, reservationToken }`:
   - Verifies the reservation is still valid and matches the requested time.
   - Re-validates the slot (conflicts, availability).
   - **Deletes the old Google Calendar event**.
   - **Creates a new Google Calendar event** with a new Meet link.
   - If the session was already `completed`, **deletes its attendance records** and resets status to `scheduled`.
   - Updates the `ClassSession` document: new times, new `meetingUrl`, new `googleCalendarEventId`, sets `isReschedule: true`.
   - Deletes the slot reservation.

After a reschedule, `nextSessionIsReschedule: true` appears in the API response, and the frontend shows a **"Rescheduled"** badge on the session card.

---

## 10. Full Lifecycle Summary

```
Admin creates class
  └── ClassSeries + ClassEnrollment(s) + ClassSession saved in Mongo (transaction)
  └── Google Calendar event + Meet link created for tutor and learners

Cron job fires (T−60min, T−10min)
  └── FCM push notification sent to enrolled learners

Student opens My Plan / Classes page
  └── GET /api/v1/learner/classes
      └── Finds enrollments → series → sessions → picks next session
      └── meetingUrl hidden until 15 min before start

Student joins (within join window)
  └── App opens meetingUrl in new tab
  └── POST /api/v1/learner/sessions/:id/attendance  →  SessionAttendance upserted as "present"

Session ends with NO join recorded
  └── GET /api/v1/learner/sessions/past returns learnerAttendance: "none"
  └── Frontend shows "Missed" badge

Tutor/Admin reschedules
  └── GET reschedule-options  →  filtered time slots
  └── POST reserve-slot       →  short-lived slot hold
  └── POST reschedule         →  old calendar event deleted, new one created, DB updated, isReschedule: true
```
