import { Schema, model, models, Document, Types } from "mongoose";
import "@/models/user";

/** One row per learner per UTC calendar day (login ping, drill pass, etc.). */
export interface IStreakActivityDay extends Document {
  _id: Types.ObjectId;
  // Better Auth (web sign-up, incl. Google/Apple OAuth) assigns UUID string
  // user ids; legacy/mobile accounts use ObjectId. Mixed so both formats
  // can be stored/queried without a cast error.
  userId: Types.ObjectId | string;
  dateString: string;
  date: Date;
  /** Optional max score for the day (e.g. from drill). */
  score?: number;
  createdAt: Date;
  updatedAt: Date;
}

const streakActivityDaySchema = new Schema<IStreakActivityDay>(
  {
    // Mixed (not ObjectId) so UUID user ids (Better Auth web sign-up, incl.
    // Google/Apple OAuth) can be stored without a cast error. No `ref`
    // since populate cannot reliably resolve a mixed-type field.
    userId: {
      type: Schema.Types.Mixed,
      required: true,
      index: true,
    },
    dateString: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true, collection: "streak_activity_days" }
);

streakActivityDaySchema.index({ userId: 1, dateString: 1 }, { unique: true });

const StreakActivityDay =
  models.StreakActivityDay ||
  model<IStreakActivityDay>("StreakActivityDay", streakActivityDaySchema);

export default StreakActivityDay;
