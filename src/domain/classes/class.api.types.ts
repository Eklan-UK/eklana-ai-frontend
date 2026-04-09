/**
 * Phase 0 — JSON/API contract for Classes features (aligned with phased plan).
 * Handlers in Phase 1+ return these shapes; client uses apiClient `/api/v1`.
 */

/** --- Shared enums (aligned with admin UI `ClassType`) --- */
export type ApiClassType = 'group' | 'individual';

/** Drawer payload (aligned with `ClassDrawerDetailPartial` in admin classes UI). */
export interface ClassDrawerDetailPartialDTO {
  sessionNumber?: number;
  sessionTotal?: number;
  sessionDateLong?: string;
  sessionTimeRange?: string;
  recurring?: boolean;
  meetingUrl?: string;
  blockCompleted?: number;
  blockTotal?: number;
  nextSessionFull?: string;
  participants?: { initials: string; name: string; role: 'Student' | 'Tutor' }[];
}

export type ClassBucket = 'today' | 'upcoming';

export type ApiClassStatus = 'active' | 'completed' | 'upcoming';

/** --- GET /api/v1/admin/classes --- */
export interface AdminClassesQuery {
  bucket?: ClassBucket;
  limit?: number;
  offset?: number;
}

/** One row for admin list + cards (maps to TeachingClass via mapper). */
export interface AdminClassListItemDTO {
  id: string;
  /** Series title when set (prefer for learner-facing headings). */
  title?: string;
  studentLabel: string;
  extraStudents: number;
  tutorName: string;
  tutorId: string;
  classType: ApiClassType;
  participants: { initials: string; userId?: string }[];
  scheduleDays: string;
  timeRange: string;
  completedSessions: number;
  totalSessions: number;
  nextSessionLabel: string;
  /** Next session Mongo id (for learner deep links). */
  nextSessionId?: string;
  nextSessionStartUtc?: string;
  status: ApiClassStatus;
  bucket: ClassBucket;
  meetingUrl?: string;
  drawer?: ClassDrawerDetailPartialDTO;
}

export interface AdminClassesResponse {
  code?: string;
  message?: string;
  data?: {
    classes: AdminClassListItemDTO[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore?: boolean;
    };
  };
}

/** GET /api/v1/tutor/teaching-classes — same row shape as admin list; scoped to the tutor; `meetingUrl` only inside join window. */

/** GET /api/v1/learner/classes — enrolled series only; join window applies to `meetingUrl`. */

/** --- POST /api/v1/admin/classes --- */
export interface CreateAdminClassBody {
  tutorId: string;
  learnerIds: string[];
  title?: string;
  classType: ApiClassType;
  /** IANA, e.g. America/New_York */
  timezone: string;
  /** First session or recurrence anchor — ISO 8601 strings. */
  firstSessionStart: string;
  firstSessionEnd: string;
  /** Optional recurrence; Phase 1 may only persist first session. */
  recurrence?: {
    rule: 'weekly' | 'none';
    daysOfWeek?: number[];
    totalSessions?: number;
  };
  /** Persisted for list cards (schedule step). */
  scheduleDayLabels?: string[];
  scheduleStartTime?: string;
  scheduleEndTime?: string;
  /** Overrides recurrence.totalSessions when set. */
  totalSessionsPlanned?: number;
}

export interface CreateAdminClassResponse {
  code?: string;
  message?: string;
  data?: {
    classSeriesId: string;
    sessionIds: string[];
    class: AdminClassListItemDTO;
  };
}

/** --- GET /api/v1/admin/classes/:id --- */
export interface AdminClassDetailDTO {
  id: string;
  series: {
    id: string;
    title: string;
    tutorId: string;
    tutorName: string;
    classType: ApiClassType;
    timezone: string;
  };
  enrollments: {
    learnerId: string;
    displayName: string;
    initials: string;
  }[];
  sessions: {
    id: string;
    startUtc: string;
    endUtc: string;
    status: string;
    meetingUrl?: string;
  }[];
  drawerDefaults?: ClassDrawerDetailPartialDTO;
}

export interface AdminClassDetailResponse {
  code?: string;
  message?: string;
  data?: AdminClassDetailDTO;
}

/** --- GET /api/v1/learner/classes (Phase 3) --- */
export interface LearnerClassesResponse {
  data?: { classes: AdminClassListItemDTO[] };
}

/** --- GET /api/v1/sessions/:id/reschedule-options (Phase 5) --- */
export interface RescheduleOptionsResponse {
  data?: {
    slots: { startUtc: string; endUtc: string }[];
  };
}

/** --- POST /api/v1/sessions/:id/reschedule (Phase 5) --- */
export interface RescheduleBody {
  newStartUtc: string;
  newEndUtc: string;
}

/** --- Attendance (Phase 4) --- */
export interface SessionAttendanceItemDTO {
  learnerId: string;
  displayName: string;
  status: import('./class.types').AttendanceStatus;
  joinedAt?: string;
  source?: 'join_token' | 'provider_webhook' | 'manual';
}

export interface TutorSessionAttendanceResponse {
  data?: {
    sessionId: string;
    attendance: SessionAttendanceItemDTO[];
  };
}
