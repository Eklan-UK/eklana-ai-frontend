import { Schema, model, models, Document, Types } from 'mongoose';

/** Dedup record per learner per local calendar day — nudge sent at most once per day. */
export interface IDailyPracticeReminderDispatch extends Document {
  _id: Types.ObjectId;
  learnerId: Types.ObjectId | string;
  localDateKey: string;
  timeZone: string;
  sentAt: Date;
  channels: {
    push: boolean;
  };
}

const schema = new Schema<IDailyPracticeReminderDispatch>(
  {
    learnerId: {
      type: Schema.Types.Mixed,
      required: true,
      index: true,
    },
    localDateKey: {
      type: String,
      required: true,
      index: true,
    },
    timeZone: { type: String, required: true },
    sentAt: { type: Date, default: Date.now },
    channels: {
      push: { type: Boolean, default: false },
    },
  },
  { timestamps: false, collection: 'daily_practice_reminder_dispatches' },
);

schema.index({ learnerId: 1, localDateKey: 1 }, { unique: true });

const DailyPracticeReminderDispatchModel =
  models.DailyPracticeReminderDispatch ||
  model<IDailyPracticeReminderDispatch>(
    'DailyPracticeReminderDispatch',
    schema,
  );

export default DailyPracticeReminderDispatchModel;
