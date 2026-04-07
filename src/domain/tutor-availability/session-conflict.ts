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

export async function findTutorSessionConflict(
  tutorId: Types.ObjectId,
  excludeSessionId: Types.ObjectId,
  proposedStart: Date,
  proposedEnd: Date,
  bufferMs: number,
): Promise<boolean> {
  const others = await ClassSession.find({
    tutorId,
    _id: { $ne: excludeSessionId },
    status: { $in: ['scheduled', 'in_progress'] },
  })
    .select('startUtc endUtc')
    .lean()
    .exec();

  for (const row of others) {
    const s = new Date(row.startUtc);
    const e = new Date(row.endUtc);
    if (sessionsTooClose(proposedStart, proposedEnd, s, e, bufferMs)) {
      return true;
    }
  }
  return false;
}
