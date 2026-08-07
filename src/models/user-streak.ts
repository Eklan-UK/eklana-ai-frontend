// models/user-streak.ts
import { Schema, model, models, Document, Types } from 'mongoose';
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

export interface Badge {
  badgeId: string;
  badgeName: string;
  unlockedAt: Date;
  milestone?: number; // legacy streak milestone
}

export interface IUserStreak extends Document {
  _id: Types.ObjectId;
  // Better Auth (web sign-up, incl. Google/Apple OAuth) assigns UUID string
  // user ids; legacy/mobile accounts use ObjectId. Mixed so both formats
  // can be stored/queried without a cast error.
  userId: Types.ObjectId | string;

  // Current streak
  currentStreak: number; // days
  streakStartDate: Date | null;
  lastActivityDate: Date | null;

  // Rolling-window streak fields
  /** Exact UTC timestamp of the last qualifying drill completion (score ≥ 70). Used for the 12/36-hour rolling window. */
  lastDrillCompletedAt: Date | null;
  /** UTC timestamp of the last streak reminder sent. Used to deduplicate rolling reminders (max one per 23 h). */
  lastReminderSentAt: Date | null;

  // Longest streak (all time)
  longestStreak: number;

  // Badges
  badges: Badge[];

  // Weekly activity (last 7 days) - cached for quick access
  weeklyActivity: Array<{
    date: string; // YYYY-MM-DD
    completed: boolean;
    score?: number;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

const userStreakSchema = new Schema<IUserStreak>(
  {
    // Mixed (not ObjectId) so UUID user ids (Better Auth web sign-up, incl.
    // Google/Apple OAuth) can be stored without a cast error. No `ref`
    // since populate cannot reliably resolve a mixed-type field.
    userId: {
      type: Schema.Types.Mixed,
      required: true,
      unique: true,
      index: true,
    },
    currentStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    streakStartDate: {
      type: Date,
      default: null,
    },
    lastActivityDate: {
      type: Date,
      default: null,
    },
    lastDrillCompletedAt: {
      type: Date,
      default: null,
    },
    lastReminderSentAt: {
      type: Date,
      default: null,
    },
    longestStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    badges: {
      type: [{
        badgeId: String,
        badgeName: String,
        unlockedAt: Date,
        milestone: Number,
      }],
      default: [],
    },
    weeklyActivity: {
      type: [{
        date: String,
        completed: Boolean,
        score: Number,
      }],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'user_streaks',
  }
);

export default models?.UserStreak || model<IUserStreak>('UserStreak', userStreakSchema);
