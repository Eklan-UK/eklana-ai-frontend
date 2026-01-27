// models/daily-focus-completion.ts
import { Schema, model, models, Document, Types } from 'mongoose';

export interface IDailyFocusCompletion extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId; // Reference to User
  dailyFocusId: Types.ObjectId; // Reference to DailyFocus
  date: Date; // Date of completion (normalized to start of day UTC)
  dateString: string; // YYYY-MM-DD format for easy querying
  
  // Completion data (only saved if score >= 70%)
  score: number; // Percentage score (0-100)
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: number; // in seconds
  
  // Answers (optional, for review)
  answers?: Array<{
    questionType: string;
    questionIndex: number;
    userAnswer: any;
    isCorrect: boolean;
  }>;
  
  // Metadata
  isFirstCompletion: boolean; // true for first completion, false for replays
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const dailyFocusCompletionSchema = new Schema<IDailyFocusCompletion>(
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
    date: {
      type: Date,
      required: true,
      index: true,
    },
    dateString: {
      type: String,
      required: true,
      index: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    correctAnswers: {
      type: Number,
      required: true,
      min: 0,
    },
    totalQuestions: {
      type: Number,
      required: true,
      min: 1,
    },
    timeSpent: {
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
      }],
      default: [],
    },
    isFirstCompletion: {
      type: Boolean,
      default: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'daily_focus_completions',
  }
);

// Unique constraint: one completion per user per daily focus per day
dailyFocusCompletionSchema.index({ userId: 1, dailyFocusId: 1, dateString: 1 }, { unique: true });

// Index for streak queries - get all completions for a user by date
dailyFocusCompletionSchema.index({ userId: 1, dateString: -1 });
dailyFocusCompletionSchema.index({ userId: 1, date: -1 });

// Index for daily focus analytics
dailyFocusCompletionSchema.index({ dailyFocusId: 1, date: -1 });

// Only count first completions for streak
dailyFocusCompletionSchema.index({ userId: 1, dateString: -1, isFirstCompletion: 1 });

export default models?.DailyFocusCompletion || model<IDailyFocusCompletion>('DailyFocusCompletion', dailyFocusCompletionSchema);

