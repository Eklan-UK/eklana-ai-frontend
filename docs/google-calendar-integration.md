# Google Calendar Integration (Eklana)

This document explains how Google Calendar is integrated in Eklana, how it powers Google Meet class links, and the technology behind the implementation.

## 1) What this integration does

The Google Calendar integration enables tutors to:

- connect their Google account via OAuth,
- store a reusable refresh token,
- allow admins to schedule classes that auto-create Google Calendar events,
- generate Google Meet links for each scheduled session,
- invite tutor + learners as attendees.

In short: **Tutor connects once, admin schedules classes, system creates Meet-backed events automatically.**

## 2) High-level architecture

Core modules:

- OAuth and state signing:
  - `src/lib/api/google-calendar-oauth.ts`
- Connection storage and lookup:
  - `src/lib/api/google-calendar-connection.ts`
- Event + Meet creation:
  - `src/lib/api/google-calendar-events.ts`
- Tutor OAuth routes:
  - `src/app/api/v1/tutor/google-calendar/connect/route.ts`
  - `src/app/api/v1/tutor/google-calendar/callback/route.ts`
  - `src/app/api/v1/tutor/google-calendar/status/route.ts`
  - `src/app/api/v1/tutor/google-calendar/disconnect/route.ts`
- Classes scheduling logic that consumes the integration:
  - `src/domain/classes/class.repository.ts`
  - `src/app/api/v1/admin/classes/route.ts`

## 3) OAuth flow (connect)

### Step A: Tutor starts connect

`GET /api/v1/tutor/google-calendar/connect`

- Requires role `tutor`.
- Verifies Google OAuth client config exists.
- Builds redirect URI dynamically from request host (supports multi-host deployments).
- Signs a short-lived `state` token (HMAC, 10-minute TTL).
- Redirects to Google OAuth consent URL.

Scope requested:

- `https://www.googleapis.com/auth/calendar.events`

OAuth params include:

- `access_type=offline` (needed for refresh token),
- `prompt=consent`,
- `include_granted_scopes=true`.

### Step B: Google returns callback

`GET /api/v1/tutor/google-calendar/callback`

- Reads `code`, `state`, and provider errors.
- Verifies `state` signature and expiration.
- Exchanges authorization code for tokens using `google-auth-library` `OAuth2Client`.
- Stores `refresh_token` via `upsertGoogleCalendarRefreshToken()`.
- Redirects back to `/tutor/settings` with URL flags:
  - `?calendar=connected`
  - or `?calendar=error&reason=...`

Important behavior:

- If Google does not return a new refresh token, callback checks existing stored connection.
- If one already exists, it still treats connection as successful.

## 4) Token storage model

Stored in Mongo collection:

- `google_calendar_connections`

Managed by `src/lib/api/google-calendar-connection.ts`.

Key capabilities:

- Upsert refresh token by `userId`
- Read refresh token by `userId`
- Delete connection (disconnect)
- Return normalized connection status map for users

Implementation detail:

- It supports multiple legacy token key shapes (`refreshToken`, `refresh_token`, nested token paths), making migration/backward-compat more resilient.

## 5) Event creation + Meet link generation

When admin schedules a class, `ClassRepository.create()`:

1. Validates tutor + learners + session times.
2. Confirms tutor is connected to Google Calendar.
3. Loads tutor refresh token.
4. Calls `createGoogleCalendarEventWithMeetLink()` with:
   - summary (if the admin leaves the title blank, defaults to `Class N (<learner display names>)` where _N_ is the session index in the series (1 for the first session); long rosters are truncated)
   - UTC start/end
   - timezone
   - attendees (tutor + learners)
5. Receives:
   - `eventId`
   - `meetingUrl` (Meet link)
6. Persists class series/session in Mongo:
   - **Weekly recurring** (`recurrenceRule === 'weekly'`): `meetingUrl` on both `class_series` and `class_sessions` (shared link for the program).
   - **One-time / non-weekly**: `meetingUrl` on the session only (unchanged).

### Two calendar paths

| Flow | Function | Meet link |
|------|----------|-----------|
| First session of a weekly series, one-time class, or weekly backfill | `createGoogleCalendarEventWithMeetLink()` | **New** link via `conferenceData.createRequest` |
| Reschedule / future session for weekly series with existing link | `createGoogleCalendarEventWithExistingMeetLink()` | **Reuses** series `meetingUrl` (no `createRequest`) |

`createGoogleCalendarEventWithMeetLink()` uses:

- `googleapis` Calendar v3 client,
- OAuth2 credentials with refresh token,
- `conferenceData.createRequest` with `hangoutsMeet`,
- robust extraction of meeting URL from either:
  - `hangoutLink`, or
  - `conferenceData.entryPoints` video URI.

`createGoogleCalendarEventWithExistingMeetLink()` inserts a new calendar event (new `eventId` for reminders) but attaches the **existing** Meet URI via `hangoutLink` and `conferenceData.entryPoints` — no new conference room.

### Reschedule behavior

`RescheduleService.applyRescheduleToCalendarAndDb()`:

- **Weekly series with `class_series.meetingUrl`:** reuses the shared link; old per-session calendar event is deleted, new event created with same Meet URL.
- **Weekly series without series link** (legacy / calendar failed on create): mints a new link, then **backfills** `class_series.meetingUrl` for future reschedules.
- **Non-weekly:** new Meet link on every reschedule (unchanged).

Read paths (`class.mapper.resolveSessionMeetingUrl`, learner/tutor session APIs) prefer `class_series.meetingUrl` for weekly programs so UIs stay consistent even if a session row has a stale link.

## 6) Validation and failure handling

The classes repository maps Google failures into actionable product messages.

Examples:

- Network/timeout/TLS errors -> "Could not reach Google Calendar..."
- Invalid grant / revoked / expired token -> "Tutor must reconnect Google Calendar..."
- Generic unknown failures -> fallback generic "Could not create a Google Meet link..."

This keeps admin UX understandable and gives clear next steps.

## 7) Status and disconnect APIs

### Status

`GET /api/v1/tutor/google-calendar/status`

- Returns `{ connected: boolean }` for the authenticated tutor.
- Used by Tutor Settings and scheduling UI guards.

### Disconnect

`DELETE /api/v1/tutor/google-calendar/disconnect`

- Deletes stored connection rows for tutor `userId`.
- Returns `{ disconnected: true }`.

## 8) Security model

- OAuth `state` is signed with server secret (`BETTER_AUTH_SECRET` or `JWT_ACCESS_SECRET`) and expires in 10 minutes.
- State signature check uses timing-safe comparison.
- Routes are protected by role middleware (`withRole`).
- Refresh tokens are never exposed in API responses.
- OAuth callback redirects to trusted resolved base URL.

## 9) Required environment variables

Core vars:

- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`

Also required for secure state signing:

- `BETTER_AUTH_SECRET` or `JWT_ACCESS_SECRET`

Deployment note:

- The OAuth redirect URI must match what is configured in Google Cloud Console, and should resolve to:
  - `/api/v1/tutor/google-calendar/callback`

## 10) Tech stack behind this integration

- **Next.js App Router** route handlers
- **TypeScript**
- **MongoDB** (native collection access through existing DB connection)
- **Mongoose connection layer**
- **google-auth-library** (OAuth token exchange)
- **googleapis** Calendar API v3
- **Node.js crypto** (signed OAuth state)

## 11) Operational notes

- Calendar connect is tutor-scoped; admin scheduling depends on tutor having a valid connection.
- If staging behaves differently from local, first check:
  - OAuth client ID/secret present in that environment,
  - callback URI configured correctly in Google Cloud,
  - tutor refresh token exists in `google_calendar_connections`,
  - state-signing secret present.

