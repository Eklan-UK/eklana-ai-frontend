import type { Types } from 'mongoose';
import ClassSession from '@/models/class-session';

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
