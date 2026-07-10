import { Schema, model, models, Document, Types } from 'mongoose';

/** Dedup record per learner per week — notification sent at most once per week. */
export interface IWeeklyChallengeDispatch extends Document {
  _id: Types.ObjectId;
  learnerId: Types.ObjectId | string;
  weekStartDate: Date;
  challengeId: Types.ObjectId | string;
  drillCount: number;
  sentAt: Date;
  channels: {
    email: boolean;
    push: boolean;
  };
}

const schema = new Schema<IWeeklyChallengeDispatch>(
  {
    learnerId: {
      type: Schema.Types.Mixed,
      required: true,
      index: true,
    },
    weekStartDate: {
      type: Date,
      required: true,
      index: true,
    },
    challengeId: {
      type: Schema.Types.Mixed,
      required: true,
    },
    drillCount: { type: Number, required: true, min: 0 },
    sentAt: { type: Date, default: Date.now },
    channels: {
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
    },
  },
  { timestamps: false, collection: 'weekly_challenge_dispatches' },
);

schema.index({ learnerId: 1, weekStartDate: 1 }, { unique: true });

const WeeklyChallengeDispatchModel =
  models.WeeklyChallengeDispatch ||
  model<IWeeklyChallengeDispatch>('WeeklyChallengeDispatch', schema);

export default WeeklyChallengeDispatchModel;
