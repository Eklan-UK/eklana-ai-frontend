import { Types } from 'mongoose';
import ClassSession, { type IClassSession } from '@/models/class-session';
import ClassSeries, { type IClassSeries } from '@/models/class-series';
import ClassEnrollment from '@/models/class-enrollment';
import { ValidationError } from '@/lib/api/response';
import {
  utcWeekRangeContaining,
  isUtcInstantInSameWeekAs,
  isUtcRangeWithinWeek,
} from '@/lib/classes/utc-week';
import {
  filterSlotsByAvailability,
  utcIntervalFitsWeeklyAvailability,
} from '@/domain/tutor-availability/availability-window';
import { findTutorSessionConflict } from '@/domain/tutor-availability/session-conflict';
import { TutorAvailabilityRepository } from '@/domain/tutor-availability/tutor-availability.repository';

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
    if (session.status === 'completed' || session.status === 'cancelled') {
      throw new ValidationError('Session cannot be rescheduled');
    }
    return {
      session: session as unknown as IClassSession,
      series: series as unknown as IClassSeries,
    };
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
      }
    }

    const filtered: { startUtc: string; endUtc: string }[] = [];
    for (const s of slots) {
      const ns = new Date(s.startUtc);
      const ne = new Date(s.endUtc);
      const conflict = await findTutorSessionConflict(
        session.tutorId as Types.ObjectId,
        session._id as Types.ObjectId,
        ns,
        ne,
        bufferMs,
      );
      if (!conflict) filtered.push(s);
    }

    return {
      slots: filtered,
      weekPolicy:
        'UTC Monday–Sunday week containing the original session start (MVP). Slots also respect tutor availability and session buffer.',
    };
  }

  async rescheduleSession(params: {
    sessionId: string;
    learnerId: Types.ObjectId;
    newStartUtc: Date;
    newEndUtc: Date;
  }): Promise<void> {
    const { session, series } = await this.assertLearnerMayAccessSession(
      params.sessionId,
      params.learnerId,
    );

    const origStart = new Date(session.startUtc);
    const origEnd = new Date(session.endUtc);
    const durationMs = origEnd.getTime() - origStart.getTime();
    const expectedEnd = new Date(params.newStartUtc.getTime() + durationMs);
    if (Math.abs(expectedEnd.getTime() - params.newEndUtc.getTime()) > 1000) {
      throw new ValidationError('End time must match original session duration');
    }
    if (params.newStartUtc.getTime() <= Date.now()) {
      throw new ValidationError('New start must be in the future');
    }
    if (!isUtcInstantInSameWeekAs(params.newStartUtc, origStart)) {
      throw new ValidationError('Reschedule must stay within the same week (UTC) as the original session');
    }
    const { weekStartUtc, weekEndUtc } = utcWeekRangeContaining(origStart);
    if (
      !isUtcRangeWithinWeek(params.newStartUtc, params.newEndUtc, weekStartUtc, weekEndUtc)
    ) {
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
          params.newStartUtc,
          params.newEndUtc,
          rules,
          avDoc.exceptions ?? [],
          avDoc.timezone,
        )
      ) {
        throw new ValidationError('Selected time is outside tutor availability');
      }
    }

    const bufferMs = (avDoc?.bufferMinutes ?? 0) * 60 * 1000;
    const conflicts = await findTutorSessionConflict(
      session.tutorId as Types.ObjectId,
      session._id as Types.ObjectId,
      params.newStartUtc,
      params.newEndUtc,
      bufferMs,
    );
    if (conflicts) {
      throw new ValidationError('Time conflicts with another session or buffer');
    }

    await ClassSession.updateOne(
      { _id: session._id },
      {
        $set: {
          startUtc: params.newStartUtc,
          endUtc: params.newEndUtc,
        },
      },
    );
  }
}
