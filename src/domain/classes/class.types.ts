import type { Types } from 'mongoose';

/**
 * Phase 0 — conceptual persistence model for live teaching classes.
 * Mongoose schemas land in Phase 1; this file is the agreed shape.
 */

/** One logical offering: a tutor teaching one or more learners over time. */
export interface ClassSeries {
  _id: Types.ObjectId;
  /** Owning tutor (User with tutor role). */
  tutorId: Types.ObjectId;
  /** Display title; UI may derive primary student label from enrollments. */
  title: string;
  classType: 'group' | 'individual';
  /** IANA timezone for schedule semantics (today / same-week reschedule). */
  timezone: string;
  /** Optional cap for group classes. */
  maxLearners?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Links a learner user to a class series. */
export interface ClassEnrollment {
  _id: Types.ObjectId;
  classSeriesId: Types.ObjectId;
  learnerId: Types.ObjectId;
  enrolledAt: Date;
  status: 'active' | 'withdrawn';
}

/** Single scheduled occurrence (join / attendance / reschedule target). */
export interface ClassSession {
  _id: Types.ObjectId;
  classSeriesId: Types.ObjectId;
  /** Wall-clock instant in UTC. */
  startUtc: Date;
  endUtc: Date;
  /** Google Meet, Zoom, or manual URL from Phase 6. */
  meetingUrl?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  /** Denormalized for queries; optional. */
  tutorId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

/** Per learner per session (Phase 4). */
export interface SessionAttendance {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
  learnerId: Types.ObjectId;
  status: AttendanceStatus;
  joinedAt?: Date;
  leftAt?: Date;
  durationMinutes?: number;
  source: 'join_token' | 'provider_webhook' | 'manual';
  updatedAt: Date;
}

/** Optional workflow before Phase 5 hard-codes reschedule on session. */
export interface RescheduleRequest {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
  requestedByUserId: Types.ObjectId;
  /** Must stay in same calendar week as original session.startUtc (server rule). */
  proposedStartUtc: Date;
  proposedEndUtc: Date;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: Date;
}
