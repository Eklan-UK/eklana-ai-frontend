import type { Types } from 'mongoose';
import ClassSession from '@/models/class-session';
import ClassSlotReservation from '@/models/class-slot-reservation';

/**
 * True if two [start, end] intervals cannot both exist with at least `bufferMs` gap
 * (same condition as: expanded intervals overlap).
 */
export function sessionsTooClose(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
  bufferMs: number,
): boolean {
  return startA.getTime() < endB.getTime() + bufferMs && endA.getTime() + bufferMs > startB.getTime();
}

export type TutorSessionInterval = { startUtc: Date; endUtc: Date };

/** One query; use with `proposedOverlapsTutorSessions` to avoid N+1 in reschedule option lists. */
export async function loadTutorActiveSessionsExcluding(
  tutorId: Types.ObjectId,
  excludeSessionId: Types.ObjectId,
): Promise<TutorSessionInterval[]> {
  const rows = await ClassSession.find({
    tutorId,
    _id: { $ne: excludeSessionId },
    status: { $in: ['scheduled', 'in_progress'] },
  })
    .select('startUtc endUtc')
    .lean()
    .exec();
  return rows.map((r) => ({
    startUtc: new Date(r.startUtc),
    endUtc: new Date(r.endUtc),
  }));
}

export function proposedOverlapsTutorSessions(
  others: TutorSessionInterval[],
  proposedStart: Date,
  proposedEnd: Date,
  bufferMs: number,
): boolean {
  for (const row of others) {
    if (sessionsTooClose(proposedStart, proposedEnd, row.startUtc, row.endUtc, bufferMs)) {
      return true;
    }
  }
  return false;
}

export async function findTutorSessionConflict(
  tutorId: Types.ObjectId,
  excludeSessionId: Types.ObjectId,
  proposedStart: Date,
  proposedEnd: Date,
  bufferMs: number,
): Promise<boolean> {
  const others = await loadTutorActiveSessionsExcluding(tutorId, excludeSessionId);
  return proposedOverlapsTutorSessions(others, proposedStart, proposedEnd, bufferMs);
}

/**
 * Intervals for **other** sessions' active holds (pessimistic reschedule locks).
 */
export async function loadTutorActiveReservationIntervalsExcluding(
  tutorId: Types.ObjectId,
  movingSessionId: Types.ObjectId,
  now: Date = new Date(),
): Promise<TutorSessionInterval[]> {
  const rows = await ClassSlotReservation.find({
    tutorId,
    sessionId: { $ne: movingSessionId },
    expiresAt: { $gt: now },
  })
    .select('startUtc endUtc')
    .lean()
    .exec();
  return rows.map((r) => ({
    startUtc: new Date(r.startUtc),
    endUtc: new Date(r.endUtc),
  }));
}

/**
 * True if the proposed window overlaps another session's **active** reschedule hold (pessimistic lock).
 */
export async function findTutorReservationConflict(
  tutorId: Types.ObjectId,
  movingSessionId: Types.ObjectId,
  proposedStart: Date,
  proposedEnd: Date,
  bufferMs: number,
  now: Date = new Date(),
): Promise<boolean> {
  const others = await loadTutorActiveReservationIntervalsExcluding(
    tutorId,
    movingSessionId,
    now,
  );
  return proposedOverlapsTutorSessions(others, proposedStart, proposedEnd, bufferMs);
}
