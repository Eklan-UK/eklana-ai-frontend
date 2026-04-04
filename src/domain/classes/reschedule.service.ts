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
