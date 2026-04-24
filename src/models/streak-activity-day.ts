import { Schema, model, models, Document, Types } from "mongoose";
import "@/models/user";

/** One row per learner per UTC calendar day (login ping, drill pass, etc.). */
export interface IStreakActivityDay extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  dateString: string;
  date: Date;
  /** Optional max score for the day (e.g. from drill). */
  score?: number;
  createdAt: Date;
  updatedAt: Date;
}

const streakActivityDaySchema = new Schema<IStreakActivityDay>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
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
