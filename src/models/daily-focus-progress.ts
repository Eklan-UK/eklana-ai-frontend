// models/daily-focus-progress.ts
import { Schema, model, models, Document, Types } from 'mongoose';
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

export interface IDailyFocusProgress extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId; // Reference to User
  dailyFocusId: Types.ObjectId; // Reference to DailyFocus
  dateString: string; // YYYY-MM-DD format (UTC)
  
  // Current progress
  currentQuestionIndex: number;
  answers: Array<{
    questionType: string;
    questionIndex: number;
    userAnswer: any;
    isCorrect?: boolean;
    isSubmitted: boolean;
  }>;
  
  // Session data
  startedAt: Date;
  lastUpdatedAt: Date;
  
  // Completion status
  isCompleted: boolean;
  finalScore?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

const dailyFocusProgressSchema = new Schema<IDailyFocusProgress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    dailyFocusId: {
      type: Schema.Types.ObjectId,
      ref: 'DailyFocus',
      required: true,
      index: true,
    },
    dateString: {
      type: String,
      required: true,
      index: true,
    },
    currentQuestionIndex: {
      type: Number,
      default: 0,
      min: 0,
    },
    answers: {
      type: [{
        questionType: String,
        questionIndex: Number,
        userAnswer: Schema.Types.Mixed,
        isCorrect: Boolean,
        isSubmitted: Boolean,
      }],
      default: [],
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    finalScore: {
      type: Number,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
    collection: 'daily_focus_progress',
  }
);

// Unique constraint: one progress record per user per daily focus per day
dailyFocusProgressSchema.index({ userId: 1, dailyFocusId: 1, dateString: 1 }, { unique: true });

// Index for fetching user's progress
dailyFocusProgressSchema.index({ userId: 1, dateString: -1 });

export default models?.DailyFocusProgress || model<IDailyFocusProgress>('DailyFocusProgress', dailyFocusProgressSchema);

