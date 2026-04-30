import { Types } from 'mongoose';
import ClassSession, { type IClassSession } from '@/models/class-session';
import ClassSeries, { type IClassSeries } from '@/models/class-series';
import ClassEnrollment from '@/models/class-enrollment';
import SessionAttendance from '@/models/session-attendance';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { ValidationError, ForbiddenError } from '@/lib/api/response';
import { getGoogleCalendarRefreshTokenForUser } from '@/lib/api/google-calendar-connection';
import {
  createGoogleCalendarEventWithMeetLink,
  deleteGoogleCalendarEvent,
} from '@/lib/api/google-calendar-events';
import { validationMessageForGoogleCalendarEventFailure } from '@/domain/classes/class.repository';
import { buildClassSessionCalendarTitle } from '@/domain/classes/class-calendar-titles';
import { SlotReservationService } from '@/domain/classes/slot-reservation.service';
import {
  utcWeekRangeContaining,
  isUtcInstantInSameWeekAs,
  isUtcRangeWithinWeek,
} from '@/lib/classes/utc-week';
import {
  filterSlotsByAvailability,
  utcIntervalFitsWeeklyAvailability,
} from '@/domain/tutor-availability/availability-window';
import {
  findTutorSessionConflict,
  findTutorReservationConflict,
  loadTutorActiveSessionsExcluding,
  loadTutorActiveReservationIntervalsExcluding,
  proposedOverlapsTutorSessions,
} from '@/domain/tutor-availability/session-conflict';
import { TutorAvailabilityRepository } from '@/domain/tutor-availability/tutor-availability.repository';
import type {
  AvailabilityException,
  WeeklyAvailabilityRule,
} from '@/models/tutor-availability';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Candidate offsets from original start (same duration); all must stay in the same UTC week. */
const OPTION_OFFSETS_MS = [
  0,
  2 * HOUR_MS,
  -2 * HOUR_MS,
  DAY_MS,
  -DAY_MS,
  2 * DAY_MS,
  -2 * DAY_MS,
];

export class RescheduleService {
  /**
   * Admin may reschedule a session for an active series (no enrollment check), except cancelled.
   */
  async assertAdminMayAccessSession(
    sessionId: string,
  ): Promise<{ session: IClassSession; series: IClassSeries }> {
    if (!Types.ObjectId.isValid(sessionId)) {
      throw new ValidationError('Invalid session ID');
    }
    const session = await ClassSession.findById(sessionId).lean();
    if (!session) {
      throw new ValidationError('Session not found');
    }
    const series = await ClassSeries.findById(session.classSeriesId).lean();
    if (!series?.isActive) {
      throw new ValidationError('Class not available');
    }
    if (session.status === 'cancelled') {
      throw new ValidationError('Session cannot be rescheduled');
    }
    return {
      session: session as unknown as IClassSession,
      series: series as unknown as IClassSeries,
    };
  }

  async assertLearnerMayAccessSession(
    sessionId: string,
    learnerId: Types.ObjectId,
  ): Promise<{ session: IClassSession; series: IClassSeries }> {
    if (!Types.ObjectId.isValid(sessionId)) {
      throw new ValidationError('Invalid session ID');
    }
    const session = await ClassSession.findById(sessionId).lean();
    if (!session) {
      throw new ValidationError('Session not found');
    }
    const series = await ClassSeries.findById(session.classSeriesId).lean();
    if (!series?.isActive) {
      throw new ValidationError('Class not available');
    }
    const enr = await ClassEnrollment.findOne({
      classSeriesId: series._id,
      learnerId,
      status: 'active',
    }).lean();
    if (!enr) {
      throw new ValidationError('Not enrolled in this class');
    }
    if (session.status === 'cancelled') {
      throw new ValidationError('Session cannot be rescheduled');
    }
    return {
      session: session as unknown as IClassSession,
      series: series as unknown as IClassSeries,
    };
  }

  /**
   * Tutor may reschedule only sessions they teach (same series rules as admin).
   */
  async assertTutorMayAccessSession(
    sessionId: string,
    tutorUserId: Types.ObjectId,
  ): Promise<{ session: IClassSession; series: IClassSeries }> {
    const { session, series } = await this.assertAdminMayAccessSession(sessionId);
    if (session.tutorId.toString() !== tutorUserId.toString()) {
      throw new ForbiddenError('You are not the assigned tutor for this session');
    }
    return { session, series };
  }

  buildRescheduleOptions(originalStart: Date, originalEnd: Date, now: Date = new Date()): {
    startUtc: string;
    endUtc: string;
  }[] {
    const durationMs = originalEnd.getTime() - originalStart.getTime();
    if (durationMs <= 0) {
      return [];
    }
    const { weekStartUtc, weekEndUtc } = utcWeekRangeContaining(originalStart);
    const seen = new Set<string>();
    const out: { startUtc: string; endUtc: string }[] = [];

    for (const off of OPTION_OFFSETS_MS) {
      const ns = new Date(originalStart.getTime() + off);
      const ne = new Date(ns.getTime() + durationMs);
      if (ns.getTime() <= now.getTime()) continue;
      if (!isUtcInstantInSameWeekAs(ns, originalStart)) continue;
      if (!isUtcRangeWithinWeek(ns, ne, weekStartUtc, weekEndUtc)) continue;
      const key = ns.toISOString();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ startUtc: ns.toISOString(), endUtc: ne.toISOString() });
    }

    out.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
    return out;
  }

  /**
   * When offset-based candidates miss tutor windows, scan the same UTC week in small steps
   * and keep starts where the full interval fits weekly rules (same as validation on save).
   */
  private buildGridSlotsInWeekFromRules(
    originalStart: Date,
    originalEnd: Date,
    now: Date,
    rules: WeeklyAvailabilityRule[],
    exceptions: AvailabilityException[],
    timeZone: string,
  ): { startUtc: string; endUtc: string }[] {
    const durationMs = originalEnd.getTime() - originalStart.getTime();
    if (durationMs <= 0 || rules.length === 0) {
      return [];
    }
    const { weekStartUtc, weekEndUtc } = utcWeekRangeContaining(originalStart);
    const seen = new Set<string>();
    const out: { startUtc: string; endUtc: string }[] = [];
    const stepMs = 5 * 60 * 1000;
    const endScan = weekEndUtc.getTime() - durationMs;
    for (let t = weekStartUtc.getTime(); t <= endScan; t += stepMs) {
      const ns = new Date(t);
      const ne = new Date(t + durationMs);
      if (ns.getTime() <= now.getTime()) continue;
      if (!isUtcInstantInSameWeekAs(ns, originalStart)) continue;
      if (!isUtcRangeWithinWeek(ns, ne, weekStartUtc, weekEndUtc)) continue;
      if (!utcIntervalFitsWeeklyAvailability(ns, ne, rules, exceptions, timeZone)) continue;
      const key = ns.toISOString();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ startUtc: key, endUtc: ne.toISOString() });
    }
    out.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
    return out.slice(0, 100);
  }

  private static readonly RESCHEDULE_WEEK_POLICY =
    'UTC Monday–Sunday week containing the original session start (MVP). Slots also respect tutor availability and session buffer.';

  private async computeRescheduleSlotsForSession(
    session: IClassSession,
    now: Date = new Date(),
  ): Promise<{
    slots: { startUtc: string; endUtc: string }[];
    weekPolicy: string;
  }> {
    const start = new Date(session.startUtc);
    const end = new Date(session.endUtc);
    let slots = this.buildRescheduleOptions(start, end, now);

    const avRepo = new TutorAvailabilityRepository();
    const avDoc = await avRepo.findByTutorId(session.tutorId as Types.ObjectId);

    const bufferMs = (avDoc?.bufferMinutes ?? 0) * 60 * 1000;

    if (avDoc) {
      const rules = avDoc.weeklyRules ?? [];
      if (rules.length === 0) {
        slots = [];
      } else {
        slots = filterSlotsByAvailability(
          slots,
          rules,
          avDoc.exceptions ?? [],
          avDoc.timezone,
        );
        if (slots.length === 0) {
          slots = this.buildGridSlotsInWeekFromRules(
            start,
            end,
            now,
            rules,
            avDoc.exceptions ?? [],
            avDoc.timezone,
          );
        }
      }
    }

    const filtered: { startUtc: string; endUtc: string }[] = [];
    if (slots.length > 0) {
      const existingIntervals = await loadTutorActiveSessionsExcluding(
        session.tutorId as Types.ObjectId,
        session._id as Types.ObjectId,
      );
      const resIntervals = await loadTutorActiveReservationIntervalsExcluding(
        session.tutorId as Types.ObjectId,
        session._id as Types.ObjectId,
        now,
      );
      for (const s of slots) {
        const ns = new Date(s.startUtc);
        const ne = new Date(s.endUtc);
        if (proposedOverlapsTutorSessions(existingIntervals, ns, ne, bufferMs)) {
          continue;
        }
        if (proposedOverlapsTutorSessions(resIntervals, ns, ne, bufferMs)) {
          continue;
        }
        filtered.push(s);
      }
    }

    return {
      slots: filtered,
      weekPolicy: RescheduleService.RESCHEDULE_WEEK_POLICY,
    };
  }

  /**
   * Validates a proposed time for reschedule (no Google Calendar, no DB write). Used for reserve and apply.
   */
  async assertSlotValidForReschedule(
    session: IClassSession,
    newStartUtc: Date,
    newEndUtc: Date,
  ): Promise<void> {
    const origStart = new Date(session.startUtc);
    const origEnd = new Date(session.endUtc);
    const durationMs = origEnd.getTime() - origStart.getTime();
    const expectedEnd = new Date(newStartUtc.getTime() + durationMs);
    if (Math.abs(expectedEnd.getTime() - newEndUtc.getTime()) > 1000) {
      throw new ValidationError('End time must match original session duration');
    }
    if (newStartUtc.getTime() <= Date.now()) {
      throw new ValidationError('New start must be in the future');
    }
    if (!isUtcInstantInSameWeekAs(newStartUtc, origStart)) {
      throw new ValidationError('Reschedule must stay within the same week (UTC) as the original session');
    }
    const { weekStartUtc, weekEndUtc } = utcWeekRangeContaining(origStart);
    if (!isUtcRangeWithinWeek(newStartUtc, newEndUtc, weekStartUtc, weekEndUtc)) {
      throw new ValidationError('Session must fall within the same calendar week (UTC)');
    }

    const avRepo = new TutorAvailabilityRepository();
    const avDoc = await avRepo.findByTutorId(session.tutorId as Types.ObjectId);

    if (avDoc) {
      const rules = avDoc.weeklyRules ?? [];
      if (rules.length === 0) {
        throw new ValidationError('Tutor has no availability windows configured');
      }
      if (
        !utcIntervalFitsWeeklyAvailability(
          newStartUtc,
          newEndUtc,
          rules,
          avDoc.exceptions ?? [],
          avDoc.timezone,
        )
      ) {
        throw new ValidationError('Selected time is outside tutor availability');
      }
    }

    const bufferMs = (avDoc?.bufferMinutes ?? 0) * 60 * 1000;
    const sessionConflict = await findTutorSessionConflict(
      session.tutorId as Types.ObjectId,
      session._id as Types.ObjectId,
      newStartUtc,
      newEndUtc,
      bufferMs,
    );
    if (sessionConflict) {
      throw new ValidationError('Time conflicts with another session or buffer');
    }

    const resConflict = await findTutorReservationConflict(
      session.tutorId as Types.ObjectId,
      session._id as Types.ObjectId,
      newStartUtc,
      newEndUtc,
      bufferMs,
    );
    if (resConflict) {
      throw new ValidationError('This time is no longer available. Pick another slot.');
    }
  }

  /**
   * Admin-only: reschedule to any future time (cross-week), without tutor weekly-availability
   * restrictions. Still enforces duration, session/buffer conflicts, and reservation holds.
   */
  async assertAdminRescheduleTime(
    session: IClassSession,
    newStartUtc: Date,
    newEndUtc: Date,
  ): Promise<void> {
    const origStart = new Date(session.startUtc);
    const origEnd = new Date(session.endUtc);
    const durationMs = origEnd.getTime() - origStart.getTime();
    const expectedEnd = new Date(newStartUtc.getTime() + durationMs);
    if (Math.abs(expectedEnd.getTime() - newEndUtc.getTime()) > 1000) {
      throw new ValidationError('End time must match original session duration');
    }
    if (newStartUtc.getTime() <= Date.now()) {
      throw new ValidationError('New start must be in the future');
    }

    const avRepo = new TutorAvailabilityRepository();
    const avDoc = await avRepo.findByTutorId(session.tutorId as Types.ObjectId);
    const bufferMs = (avDoc?.bufferMinutes ?? 0) * 60 * 1000;

    const sessionConflict = await findTutorSessionConflict(
      session.tutorId as Types.ObjectId,
      session._id as Types.ObjectId,
      newStartUtc,
      newEndUtc,
      bufferMs,
    );
    if (sessionConflict) {
      throw new ValidationError('Time conflicts with another session or buffer');
    }

    const resConflict = await findTutorReservationConflict(
      session.tutorId as Types.ObjectId,
      session._id as Types.ObjectId,
      newStartUtc,
      newEndUtc,
      bufferMs,
    );
    if (resConflict) {
      throw new ValidationError('This time is no longer available. Pick another slot.');
    }
  }

  /**
   * Short-lived pessimistic hold before POST reschedule. Caller must be allowed to act on the session.
   */
  async createLearnerRescheduleSlotReservation(
    sessionId: string,
    learnerId: Types.ObjectId,
    startIso: string,
    endIso: string,
  ): Promise<{ reservationId: string; token: string; expiresAt: string }> {
    const { session } = await this.assertLearnerMayAccessSession(sessionId, learnerId);
    const newStart = new Date(startIso);
    const newEnd = new Date(endIso);
    if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime())) {
      throw new ValidationError('Invalid time');
    }
    await this.assertSlotValidForReschedule(session, newStart, newEnd);
    return new SlotReservationService().createRescheduleSlotHold({
      tutorId: session.tutorId as Types.ObjectId,
      sessionId: session._id as Types.ObjectId,
      holderUserId: learnerId,
      startUtc: newStart,
      endUtc: newEnd,
    });
  }

  async createAdminRescheduleSlotReservation(
    sessionId: string,
    adminUserId: Types.ObjectId,
    startIso: string,
    endIso: string,
  ): Promise<{ reservationId: string; token: string; expiresAt: string }> {
    const { session } = await this.assertAdminMayAccessSession(sessionId);
    const newStart = new Date(startIso);
    const newEnd = new Date(endIso);
    if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime())) {
      throw new ValidationError('Invalid time');
    }
    await this.assertSlotValidForReschedule(session, newStart, newEnd);
    return new SlotReservationService().createRescheduleSlotHold({
      tutorId: session.tutorId as Types.ObjectId,
      sessionId: session._id as Types.ObjectId,
      holderUserId: adminUserId,
      startUtc: newStart,
      endUtc: newEnd,
    });
  }

  async createTutorRescheduleSlotReservation(
    sessionId: string,
    tutorUserId: Types.ObjectId,
    startIso: string,
    endIso: string,
  ): Promise<{ reservationId: string; token: string; expiresAt: string }> {
    const { session } = await this.assertTutorMayAccessSession(sessionId, tutorUserId);
    const newStart = new Date(startIso);
    const newEnd = new Date(endIso);
    if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime())) {
      throw new ValidationError('Invalid time');
    }
    await this.assertSlotValidForReschedule(session, newStart, newEnd);
    return new SlotReservationService().createRescheduleSlotHold({
      tutorId: session.tutorId as Types.ObjectId,
      sessionId: session._id as Types.ObjectId,
      holderUserId: tutorUserId,
      startUtc: newStart,
      endUtc: newEnd,
    });
  }

  /**
   * Same-week offset slots, filtered by tutor weekly availability (if configured)
   * and by conflicts with the tutor’s other sessions (respecting buffer minutes).
   */
  async getLearnerRescheduleSlots(
    sessionId: string,
    learnerId: Types.ObjectId,
    now: Date = new Date(),
  ): Promise<{
    slots: { startUtc: string; endUtc: string }[];
    weekPolicy: string;
  }> {
    const { session } = await this.assertLearnerMayAccessSession(sessionId, learnerId);
    return this.computeRescheduleSlotsForSession(session, now);
  }

  /** Same as learner options, for admins (no enrollment check). */
  async getAdminRescheduleSlots(
    sessionId: string,
    now: Date = new Date(),
  ): Promise<{
    slots: { startUtc: string; endUtc: string }[];
    weekPolicy: string;
  }> {
    const { session } = await this.assertAdminMayAccessSession(sessionId);
    return this.computeRescheduleSlotsForSession(session, now);
  }

  /** Same as admin options, but only for the session’s assigned tutor. */
  async getTutorRescheduleSlots(
    sessionId: string,
    tutorUserId: Types.ObjectId,
    now: Date = new Date(),
  ): Promise<{
    slots: { startUtc: string; endUtc: string }[];
    weekPolicy: string;
  }> {
    const { session } = await this.assertTutorMayAccessSession(sessionId, tutorUserId);
    return this.computeRescheduleSlotsForSession(session, now);
  }

  private async applyRescheduleToCalendarAndDb(
    session: IClassSession,
    newStartUtc: Date,
    newEndUtc: Date,
  ): Promise<void> {
    const seriesDoc = await ClassSeries.findById(session.classSeriesId).lean();
    if (!seriesDoc) {
      throw new ValidationError('Class not available');
    }
    const timezone = seriesDoc.timezone?.trim() || 'UTC';

    const refreshToken = await getGoogleCalendarRefreshTokenForUser(
      session.tutorId.toString(),
    );
    if (!refreshToken) {
      throw new ValidationError(
        'Tutor must reconnect Google Calendar before scheduling classes',
      );
    }

    const enrolls = await ClassEnrollment.find({
      classSeriesId: session.classSeriesId,
      status: 'active',
    })
      .lean();
    if (enrolls.length === 0) {
      throw new ValidationError('Not enrolled in this class');
    }

    const learnerIdList = enrolls.map((e) => e.learnerId);
    const learnerRows = await User.find({
      _id: { $in: learnerIdList },
    })
      .select('email firstName lastName name')
      .lean();
    const learnerById = new Map(
      learnerRows.map((u) => [u._id.toString(), u] as const),
    );
    const learnersOrdered = enrolls
      .map((e) => learnerById.get(e.learnerId.toString()))
      .filter(
        (u): u is (typeof learnerRows)[number] => u != null,
      );

    const tutor = await User.findById(session.tutorId)
      .select('email firstName lastName name')
      .lean();
    if (!tutor) {
      throw new ValidationError('Tutor not found');
    }

    const oldEventId = (session as { googleCalendarEventId?: string | undefined })
      .googleCalendarEventId?.trim();
    if (oldEventId) {
      try {
        await deleteGoogleCalendarEvent(refreshToken, oldEventId);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.warn('RescheduleService.deleteOldGoogleEvent', {
          sessionId: session._id.toString(),
          eventId: oldEventId,
          message: msg,
        });
      }
    }

    const summary = buildClassSessionCalendarTitle(
      session.sequenceNumber,
      seriesDoc.totalSessionsPlanned,
      learnersOrdered,
    );

    let meetingUrl: string;
    let googleEventId: string;
    try {
      const created = await createGoogleCalendarEventWithMeetLink({
        refreshToken,
        summary,
        startIsoUtc: newStartUtc.toISOString(),
        endIsoUtc: newEndUtc.toISOString(),
        timezone,
        attendees: [
          typeof tutor.email === 'string' ? tutor.email : '',
          ...learnersOrdered.map((u) => (typeof u.email === 'string' ? u.email : '')),
        ].filter(Boolean),
      });
      meetingUrl = created.meetingUrl;
      googleEventId = created.eventId;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('RescheduleService.createGoogleCalendarEvent', {
        sessionId: session._id.toString(),
        message: err.message,
      });
      throw new ValidationError(
        validationMessageForGoogleCalendarEventFailure(err.message ?? ''),
      );
    }

    const wasCompleted = session.status === 'completed';
    if (wasCompleted) {
      await SessionAttendance.deleteMany({ sessionId: session._id });
    }

    await ClassSession.updateOne(
      { _id: session._id },
      {
        $set: {
          startUtc: newStartUtc,
          endUtc: newEndUtc,
          meetingUrl,
          googleCalendarEventId: googleEventId,
          isReschedule: true,
          ...(wasCompleted ? { status: 'scheduled' as const } : {}),
        },
      },
    );
  }

  private async moveSessionToNewTime(
    session: IClassSession,
    newStartUtc: Date,
    newEndUtc: Date,
    reservation: { id: string; token: string },
  ): Promise<void> {
    const slotSvc = new SlotReservationService();
    await slotSvc.getVerifiedReservation(
      reservation.id,
      session._id.toString(),
      newStartUtc,
      newEndUtc,
      reservation.token,
    );
    await this.assertSlotValidForReschedule(session, newStartUtc, newEndUtc);
    await this.applyRescheduleToCalendarAndDb(session, newStartUtc, newEndUtc);
    await slotSvc.deleteById(reservation.id);
  }

  async adminRescheduleSessionDirect(params: {
    sessionId: string;
    newStartUtc: Date;
    newEndUtc: Date;
  }): Promise<void> {
    const { session } = await this.assertAdminMayAccessSession(params.sessionId);
    await this.assertAdminRescheduleTime(
      session,
      params.newStartUtc,
      params.newEndUtc,
    );
    await this.applyRescheduleToCalendarAndDb(
      session,
      params.newStartUtc,
      params.newEndUtc,
    );
  }

  async rescheduleSession(params: {
    sessionId: string;
    learnerId: Types.ObjectId;
    newStartUtc: Date;
    newEndUtc: Date;
    reservationId: string;
    reservationToken: string;
  }): Promise<void> {
    const { session } = await this.assertLearnerMayAccessSession(
      params.sessionId,
      params.learnerId,
    );
    await this.moveSessionToNewTime(
      session,
      params.newStartUtc,
      params.newEndUtc,
      { id: params.reservationId, token: params.reservationToken },
    );
  }

  async adminRescheduleSession(params: {
    sessionId: string;
    newStartUtc: Date;
    newEndUtc: Date;
    reservationId: string;
    reservationToken: string;
  }): Promise<void> {
    const { session } = await this.assertAdminMayAccessSession(params.sessionId);
    await this.moveSessionToNewTime(
      session,
      params.newStartUtc,
      params.newEndUtc,
      { id: params.reservationId, token: params.reservationToken },
    );
  }

  async tutorRescheduleSession(params: {
    sessionId: string;
    tutorUserId: Types.ObjectId;
    newStartUtc: Date;
    newEndUtc: Date;
    reservationId: string;
    reservationToken: string;
  }): Promise<void> {
    const { session } = await this.assertTutorMayAccessSession(
      params.sessionId,
      params.tutorUserId,
    );
    await this.moveSessionToNewTime(
      session,
      params.newStartUtc,
      params.newEndUtc,
      { id: params.reservationId, token: params.reservationToken },
    );
  }
}
