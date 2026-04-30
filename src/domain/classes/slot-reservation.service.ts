import crypto from 'crypto';
import { Types } from 'mongoose';
import ClassSlotReservation, {
  RESCHEDULE_SLOT_TTL_SEC,
  type IClassSlotReservation,
} from '@/models/class-slot-reservation';
import { ValidationError } from '@/lib/api/response';
import { logger } from '@/lib/api/logger';

function hashToken(plain: string): string {
  return crypto.createHash('sha256').update(plain, 'utf8').digest('hex');
}

function randomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export class SlotReservationService {
  /**
   * Drop non-expired holds for this session so only one pick exists at a time.
   */
  private async clearActiveForSession(sessionId: Types.ObjectId): Promise<void> {
    await ClassSlotReservation.deleteMany({
      sessionId,
      expiresAt: { $gt: new Date() },
    });
  }

  /**
   * Hold an exact (startUtc,endUtc) slot for a tutor. One active hold per (tutor, start, end) globally; one per session.
   */
  async createRescheduleSlotHold(params: {
    tutorId: Types.ObjectId;
    sessionId: Types.ObjectId;
    holderUserId: Types.ObjectId;
    startUtc: Date;
    endUtc: Date;
  }): Promise<{ reservationId: string; token: string; expiresAt: string }> {
    await this.clearActiveForSession(params.sessionId);
    const plain = randomToken();
    const tokenHash = hashToken(plain);
    const expiresAt = new Date(Date.now() + RESCHEDULE_SLOT_TTL_SEC * 1000);
    try {
      const created = (await ClassSlotReservation.create({
        tutorId: params.tutorId,
        sessionId: params.sessionId,
        holderUserId: params.holderUserId,
        startUtc: params.startUtc,
        endUtc: params.endUtc,
        tokenHash,
        expiresAt,
      })) as unknown as IClassSlotReservation;
      return {
        reservationId: created._id.toString(),
        token: plain,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (e: unknown) {
      const any = e as { code?: number };
      if (any?.code === 11000) {
        throw new ValidationError('This time is no longer available. Pick another slot.');
      }
      logger.error('SlotReservationService.createRescheduleSlotHold', {
        message: (e as Error).message,
      });
      throw new ValidationError('Could not reserve this time. Try again.');
    }
  }

  /**
   * Verifies a hold and returns the document. Caller deletes after a successful apply.
   */
  async getVerifiedReservation(
    reservationId: string,
    sessionId: string,
    startUtc: Date,
    endUtc: Date,
    token: string,
  ): Promise<IClassSlotReservation> {
    if (!Types.ObjectId.isValid(reservationId)) {
      throw new ValidationError('Invalid reservation');
    }
    if (!Types.ObjectId.isValid(sessionId)) {
      throw new ValidationError('Invalid session');
    }
    const h = hashToken(token);
    const res = await ClassSlotReservation.findOne({
      _id: new Types.ObjectId(reservationId),
      sessionId: new Types.ObjectId(sessionId),
      tokenHash: h,
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!res) {
      throw new ValidationError(
        'Your hold expired or is invalid. Choose a time again and continue.',
      );
    }
    const s = new Date((res as { startUtc: Date }).startUtc).getTime();
    const e = new Date((res as { endUtc: Date }).endUtc).getTime();
    if (Math.abs(s - startUtc.getTime()) > 2000 || Math.abs(e - endUtc.getTime()) > 2000) {
      throw new ValidationError('Reservation does not match the selected time.');
    }
    return res as unknown as IClassSlotReservation;
  }

  async deleteById(reservationId: string): Promise<void> {
    if (!Types.ObjectId.isValid(reservationId)) return;
    await ClassSlotReservation.deleteOne({ _id: new Types.ObjectId(reservationId) });
  }
}
