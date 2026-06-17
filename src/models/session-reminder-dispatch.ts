import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/class-session';

/** Dedup record per session + reminder offset (stored as string minutes, e.g. '10', '30', '60'). */
export type ReminderKind = string;

export interface ISessionReminderDispatch extends Document {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
  kind: ReminderKind;
  sentAt: Date;
}

const schema = new Schema<ISessionReminderDispatch>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'ClassSession',
      required: true,
      index: true,
    },
    kind: { type: String, required: true },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: false, collection: 'session_reminder_dispatches' },
);

schema.index({ sessionId: 1, kind: 1 }, { unique: true });

const SessionReminderDispatchModel =
  models.SessionReminderDispatch ||
  model<ISessionReminderDispatch>('SessionReminderDispatch', schema);

export default SessionReminderDispatchModel;
