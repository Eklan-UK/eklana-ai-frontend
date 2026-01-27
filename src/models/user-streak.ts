// models/user-streak.ts
import { Schema, model, models, Document, Types } from 'mongoose';

export interface Badge {
  badgeId: string;
  badgeName: string;
  unlockedAt: Date;
  milestone: number; // days
}

export interface IUserStreak extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId; // Reference to User (unique)
  
  // Current streak
  currentStreak: number; // days
  streakStartDate: Date | null;
  lastActivityDate: Date | null;
  
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
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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

