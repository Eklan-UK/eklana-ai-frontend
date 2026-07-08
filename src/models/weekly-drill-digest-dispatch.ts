import { Schema, model, models, Document, Types } from 'mongoose';

/** Dedup record per learner per ISO week — digest sent at most once per week. */
export interface IWeeklyDrillDigestDispatch extends Document {
  _id: Types.ObjectId;
  learnerId: Types.ObjectId | string;
  weekKey: string;
  sentAt: Date;
  assignmentCount: number;
  channels: {
    email: boolean;
    push: boolean;
  };
}

const schema = new Schema<IWeeklyDrillDigestDispatch>(
  {
    learnerId: {
      type: Schema.Types.Mixed,
      required: true,
      index: true,
    },
    weekKey: {
      type: String,
      required: true,
      index: true,
    },
    sentAt: { type: Date, default: Date.now },
    assignmentCount: { type: Number, required: true, min: 0 },
    channels: {
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
    },
  },
  { timestamps: false, collection: 'weekly_drill_digest_dispatches' },
);

schema.index({ learnerId: 1, weekKey: 1 }, { unique: true });

const WeeklyDrillDigestDispatchModel =
  models.WeeklyDrillDigestDispatch ||
  model<IWeeklyDrillDigestDispatch>('WeeklyDrillDigestDispatch', schema);

export default WeeklyDrillDigestDispatchModel;
