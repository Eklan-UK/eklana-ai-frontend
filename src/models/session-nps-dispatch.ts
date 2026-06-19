import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/class-session';

/** Dedup record per session — NPS email is sent at most once per session. */
export interface ISessionNpsDispatch extends Document {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
  sentAt: Date;
}

const schema = new Schema<ISessionNpsDispatch>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'ClassSession',
      required: true,
      index: true,
    },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: false, collection: 'session_nps_dispatches' },
);

schema.index({ sessionId: 1 }, { unique: true });

const SessionNpsDispatchModel =
  models.SessionNpsDispatch ||
  model<ISessionNpsDispatch>('SessionNpsDispatch', schema);

export default SessionNpsDispatchModel;
