import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/user';
import '@/models/class-session';

/** How long a selected reschedule slot is held (pessimistic lock) before expiring. */
export const RESCHEDULE_SLOT_TTL_SEC = 180;

export interface IClassSlotReservation extends Document {
  _id: Types.ObjectId;
  tutorId: Types.ObjectId;
  /** The class session being moved. */
  sessionId: Types.ObjectId;
  /** User who reserved (learner or admin). */
  holderUserId: Types.ObjectId;
  startUtc: Date;
  endUtc: Date;
  /** Secret returned once to the client; required to apply reschedule. */
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const classSlotReservationSchema = new Schema<IClassSlotReservation>(
  {
    tutorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'ClassSession', required: true, index: true },
    holderUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startUtc: { type: Date, required: true },
    endUtc: { type: Date, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true, collection: 'class_slot_reservations' },
);

classSlotReservationSchema.index(
  { tutorId: 1, startUtc: 1, endUtc: 1 },
  { unique: true, name: 'tutor_slot_unique' },
);
classSlotReservationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'ttl_expires' },
);

const ClassSlotReservationModel =
  models.ClassSlotReservation ||
  model<IClassSlotReservation>('ClassSlotReservation', classSlotReservationSchema);
export default ClassSlotReservationModel;
