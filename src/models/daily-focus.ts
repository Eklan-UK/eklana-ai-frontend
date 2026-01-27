// models/daily-focus.ts
import { Schema, model, models, Document, Types } from "mongoose";

// Question item schemas for different practice formats
const FillInBlankQuestionSchema = new Schema(
  {
    sentence: {
      type: String,
      required: true,
      description: "Sentence with blank (use ___ for blank)",
    },
    sentenceAudioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for the sentence",
    },
    correctAnswer: {
      type: String,
      required: true,
      description: "The correct answer for the blank",
    },
    options: {
      type: [String],
      default: [],
      description: "Multiple choice options (optional)",
    },
    optionsAudioUrls: {
      type: [String],
      default: [],
      description: "Pre-generated TTS audio URLs for options",
    },
    hint: {
      type: String,
      default: "",
      description: "Optional hint for the question",
    },
    explanation: {
      type: String,
      default: "",
      description: "Explanation shown after answering",
    },
  },
  { _id: false }
);

const MatchingQuestionSchema = new Schema(
  {
    left: {
      type: String,
      required: true,
      description: "Left side item to match",
    },
    leftAudioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for left item",
    },
    right: {
      type: String,
      required: true,
      description: "Right side item (correct match)",
    },
    rightAudioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for right item",
    },
    hint: {
      type: String,
      default: "",
    },
    explanation: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const MultipleChoiceQuestionSchema = new Schema(
  {
    question: {
      type: String,
      required: true,
      description: "The question text",
    },
    questionAudioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for the question",
    },
    options: {
      type: [String],
      required: true,
      description: "Array of possible answers",
    },
    optionsAudioUrls: {
      type: [String],
      default: [],
      description: "Pre-generated TTS audio URLs for each option",
    },
    correctIndex: {
      type: Number,
      required: true,
      description: "Index of the correct answer (0-based)",
    },
    hint: {
      type: String,
      default: "",
    },
    explanation: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const VocabularyQuestionSchema = new Schema(
  {
    word: {
      type: String,
      required: true,
      description: "The vocabulary word",
    },
    wordAudioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for the word",
    },
    definition: {
      type: String,
      required: true,
      description: "Definition of the word",
    },
    definitionAudioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for the definition",
    },
    exampleSentence: {
      type: String,
      default: "",
      description: "Example sentence using the word",
    },
    exampleAudioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for the example sentence",
    },
    pronunciation: {
      type: String,
      default: "",
      description: "Phonetic pronunciation (e.g., /ˈwɜːrd/)",
    },
    hint: {
      type: String,
      default: "",
    },
    explanation: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

// Main Daily Focus interface
export interface IDailyFocus extends Document {
  _id: Types.ObjectId;
  title: string;
  focusType: "grammar" | "vocabulary" | "matching" | "pronunciation" | "general";
  practiceFormat: "fill-in-blank" | "matching" | "multiple-choice" | "vocabulary" | "mixed";
  description?: string;
  
  // Question arrays - use appropriate one based on practiceFormat
  fillInBlankQuestions: Array<{
    sentence: string;
    sentenceAudioUrl?: string;
    correctAnswer: string;
    options?: string[];
    optionsAudioUrls?: string[];
    hint?: string;
    explanation?: string;
  }>;
  
  matchingQuestions: Array<{
    left: string;
    leftAudioUrl?: string;
    right: string;
    rightAudioUrl?: string;
    hint?: string;
    explanation?: string;
  }>;
  
  multipleChoiceQuestions: Array<{
    question: string;
    questionAudioUrl?: string;
    options: string[];
    optionsAudioUrls?: string[];
    correctIndex: number;
    hint?: string;
    explanation?: string;
  }>;
  
  vocabularyQuestions: Array<{
    word: string;
    wordAudioUrl?: string;
    definition: string;
    definitionAudioUrl?: string;
    exampleSentence?: string;
    exampleAudioUrl?: string;
    pronunciation?: string;
    hint?: string;
    explanation?: string;
  }>;
  
  // Scheduling
  date: Date; // The date this focus is for
  
  // Settings
  estimatedMinutes: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  showExplanationsAfterSubmission: boolean;
  
  // Metadata
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  
  // Analytics (updated after completions)
  totalCompletions: number;
  averageScore: number;
}

const dailyFocusSchema = new Schema<IDailyFocus>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    
    focusType: {
      type: String,
      required: [true, "Focus type is required"],
      enum: {
        values: ["grammar", "vocabulary", "matching", "pronunciation", "general"],
        message: "{VALUE} is not a valid focus type",
      },
    },
    
    practiceFormat: {
      type: String,
      required: [true, "Practice format is required"],
      enum: {
        values: ["fill-in-blank", "matching", "multiple-choice", "vocabulary", "mixed"],
        message: "{VALUE} is not a valid practice format",
      },
    },
    
    description: {
      type: String,
      default: "",
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    
    // Question arrays
    fillInBlankQuestions: {
      type: [FillInBlankQuestionSchema],
      default: [],
    },
    
    matchingQuestions: {
      type: [MatchingQuestionSchema],
      default: [],
    },
    
    multipleChoiceQuestions: {
      type: [MultipleChoiceQuestionSchema],
      default: [],
    },
    
    vocabularyQuestions: {
      type: [VocabularyQuestionSchema],
      default: [],
    },
    
    // Scheduling - date determines which day this is the focus for
    date: {
      type: Date,
      required: [true, "Date is required"],
      index: true,
    },
    
    // Settings
    estimatedMinutes: {
      type: Number,
      default: 5,
      min: [1, "Estimated time must be at least 1 minute"],
      max: [60, "Estimated time cannot exceed 60 minutes"],
    },
    
    difficulty: {
      type: String,
      required: true,
      enum: {
        values: ["beginner", "intermediate", "advanced"],
        message: "{VALUE} is not a valid difficulty level",
      },
      default: "intermediate",
    },
    
    showExplanationsAfterSubmission: {
      type: Boolean,
      default: true,
    },
    
    // Metadata
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    
    isActive: {
      type: Boolean,
      default: true,
    },
    
    // Analytics
    totalCompletions: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    averageScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
    collection: "daily_focus",
  }
);

// Indexes for efficient querying
dailyFocusSchema.index({ date: 1, isActive: 1 }); // For fetching today's focus
dailyFocusSchema.index({ createdBy: 1, createdAt: -1 }); // For admin listing
dailyFocusSchema.index({ focusType: 1, date: -1 }); // For filtering by type

// Virtual to get total question count
dailyFocusSchema.virtual("totalQuestions").get(function () {
  return (
    this.fillInBlankQuestions.length +
    this.matchingQuestions.length +
    this.multipleChoiceQuestions.length +
    this.vocabularyQuestions.length
  );
});

// Method to validate that at least one question type has items
dailyFocusSchema.methods.hasQuestions = function (): boolean {
  return (
    this.fillInBlankQuestions.length > 0 ||
    this.matchingQuestions.length > 0 ||
    this.multipleChoiceQuestions.length > 0 ||
    this.vocabularyQuestions.length > 0
  );
};

// Static method to find today's focus
dailyFocusSchema.statics.findTodaysFocus = async function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return this.findOne({
    date: { $gte: today, $lt: tomorrow },
    isActive: true,
  }).lean();
};

// Prevent model recompilation in Next.js development
const DailyFocusModel = models.DailyFocus || model<IDailyFocus>("DailyFocus", dailyFocusSchema);
export default DailyFocusModel;

