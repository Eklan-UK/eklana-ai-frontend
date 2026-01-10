// models/drill.model.ts
import { Schema, model, models, Document, Types } from "mongoose";

// Sub-schemas
const DialogueTurnSchema = new Schema(
  {
    speaker: {
      type: String,
      required: true,
      enum: ["student", "ai_0", "ai_1", "ai_2", "ai_3"],
      description:
        'Speaker identifier - "student" for student lines, "ai_0", "ai_1", etc. for AI characters',
    },
    text: {
      type: String,
      required: true,
      description: "The dialogue text to be spoken",
    },
    translation: {
      type: String,
      default: "",
      description: "Optional translation of the dialogue text",
    },
    // Pre-generated audio URL (Cloudinary)
    audioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for this dialogue line",
    },
  },
  { _id: false }
);

const RoleplaySceneSchema = new Schema(
  {
    scene_name: {
      type: String,
      required: true,
      description: "Name/title of the scene",
    },
    context: {
      type: String,
      default: "",
      description: "Context or setting description for the scene",
    },
    dialogue: {
      type: [DialogueTurnSchema],
      required: true,
      default: [],
      description: "Array of dialogue turns for this scene",
    },
  },
  { _id: false }
);

const TargetSentenceSchema = new Schema(
  {
    word: {
      type: String,
      default: "",
      description:
        "Vocabulary word (used in vocabulary drills for word-level practice)",
    },
    wordTranslation: {
      type: String,
      default: "",
      description: "Translation of the vocabulary word",
    },
    text: {
      type: String,
      required: true,
      description: "The sentence text to practice",
    },
    translation: {
      type: String,
      default: "",
      description: "Translation of the sentence",
    },
    // Pre-generated audio URLs (Cloudinary)
    wordAudioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for the word",
    },
    sentenceAudioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for the sentence",
    },
  },
  { _id: false }
);

const MatchingPairSchema = new Schema(
  {
    left: {
      type: String,
      required: true,
      description: "Left side item (e.g., word)",
    },
    right: {
      type: String,
      required: true,
      description: "Right side item (e.g., definition or match)",
    },
    leftTranslation: {
      type: String,
      default: "",
      description: "Translation of the left item",
    },
    rightTranslation: {
      type: String,
      default: "",
      description: "Translation of the right item",
    },
    // Pre-generated audio URLs (Cloudinary)
    leftAudioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for left item",
    },
    rightAudioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for right item",
    },
  },
  { _id: false }
);

const DefinitionItemSchema = new Schema(
  {
    word: {
      type: String,
      required: true,
      description: "Word to be defined",
    },
    hint: {
      type: String,
      default: "",
      description: "Optional hint for the word",
    },
  },
  { _id: false }
);

const GrammarItemSchema = new Schema(
  {
    pattern: {
      type: String,
      required: true,
      description: 'Grammar pattern name (e.g., "Present continuous")',
    },
    hint: {
      type: String,
      default: "",
      description: "Optional hint or explanation",
    },
    example: {
      type: String,
      required: true,
      description: "Example sentence using the pattern",
    },
  },
  { _id: false }
);

const SentenceWritingItemSchema = new Schema(
  {
    word: {
      type: String,
      required: true,
      description: "Word to use in sentence writing",
    },
    hint: {
      type: String,
      default: "",
      description: "Optional hint for the word",
    },
  },
  { _id: false }
);

// Main Drill Schema
export interface IDrill extends Document {
  _id: Types.ObjectId;
  title: string;
  type:
    | "vocabulary"
    | "roleplay"
    | "matching"
    | "definition"
    | "summary"
    | "grammar"
    | "sentence_writing"
    | "sentence"
    | "listening";
  difficulty: "beginner" | "intermediate" | "advanced";
  date: Date;
  duration_days: number;
  assigned_to: string[]; // Array of user IDs (for counting purposes only, use DrillAssignment for analytics)
  context?: string;
  audio_example_url?: string;

  // Vocabulary Drill Fields
  target_sentences: Array<{
    word?: string;
    wordTranslation?: string;
    text: string;
    translation?: string;
    wordAudioUrl?: string;
    sentenceAudioUrl?: string;
  }>;

  // Roleplay Drill Fields
  roleplay_dialogue: Array<{
    speaker: "student" | "ai_0" | "ai_1" | "ai_2" | "ai_3";
    text: string;
    translation?: string;
    audioUrl?: string;
  }>;
  roleplay_scenes: Array<{
    scene_name: string;
    context?: string;
    dialogue: Array<{
      speaker: "student" | "ai_0" | "ai_1" | "ai_2" | "ai_3";
      text: string;
      translation?: string;
      audioUrl?: string;
    }>;
  }>;
  student_character_name?: string;
  ai_character_name?: string;
  ai_character_names?: string[];

  // Matching Drill Fields
  matching_pairs: Array<{
    left: string;
    right: string;
    leftTranslation?: string;
    rightTranslation?: string;
    leftAudioUrl?: string;
    rightAudioUrl?: string;
  }>;

  // Definition Drill Fields
  definition_items: Array<{
    word: string;
    hint?: string;
  }>;

  // Grammar Drill Fields
  grammar_items: Array<{
    pattern: string;
    hint?: string;
    example: string;
  }>;

  // Sentence Writing Drill Fields
  sentence_writing_items: Array<{
    word: string;
    hint?: string;
  }>;

  // Sentence Drill Fields (single word, definition + 2 sentences)
  sentence_drill_word?: string; // Target word for the drill

  // Listening Drill Fields
  listening_drill_title?: string; // Title for the listening content
  listening_drill_content?: string; // Rich text content (markdown supported)
  listening_drill_audio_url?: string; // Pre-generated TTS audio URL

  // Summary Drill Fields
  article_title?: string;
  article_content?: string;
  article_audio_url?: string; // Pre-generated TTS audio URL for article

  // Metadata
  created_by: string; // Email of the teacher/admin (kept for backward compatibility)
  createdById?: Types.ObjectId; // ObjectId reference to creator (preferred)
  created_date: Date;
  updated_date: Date;
  is_active: boolean;

  // Analytics (aggregated - updated by background jobs)
  totalAssignments?: number;
  totalCompletions?: number;
  averageScore?: number;
  averageCompletionTime?: number; // seconds

  // Methods
  validateTypeSpecificFields(): string[];
}

const drillSchema = new Schema<IDrill>(
  {
    // Basic Information
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      description: "Title of the drill",
    },

    type: {
      type: String,
      required: [true, "Drill type is required"],
      enum: {
        values: [
          "vocabulary",
          "roleplay",
          "matching",
          "definition",
          "summary",
          "grammar",
          "sentence_writing",
          "sentence",
          "listening",
        ],
        message: "{VALUE} is not a valid drill type",
      },
      description: "Type of drill determines which fields are used",
    },

    difficulty: {
      type: String,
      required: [true, "Difficulty is required"],
      enum: {
        values: ["beginner", "intermediate", "advanced"],
        message: "{VALUE} is not a valid difficulty level",
      },
      default: "intermediate",
      description: "Difficulty level of the drill",
    },

    // Scheduling
    date: {
      type: Date,
      required: [true, "Date is required"],
      description:
        "Completion date (due date) - the latest date by which the drill should be completed. The drill becomes active immediately upon assignment.",
    },

    duration_days: {
      type: Number,
      required: [true, "Duration is required"],
      default: 1,
      min: [1, "Duration must be at least 1 day"],
      description:
        "Number of days from assignment date until completion date. Used for calculating due dates when assigning drills.",
    },

    // Assignment - Array of student emails
    assigned_to: {
      type: [String],
      required: [true, "At least one student email is required"],
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length > 0,
        message: "At least one student email must be assigned",
      },
      description: "Array of student emails assigned to this drill",
    },

    // General Content
    context: {
      type: String,
      default: "",
      description: "General context or instructions for the drill",
    },

    audio_example_url: {
      type: String,
      default: null,
      description: "URL to audio file with teacher's example pronunciation",
    },

    // Vocabulary Drill Fields
    target_sentences: {
      type: [TargetSentenceSchema],
      default: [],
      description: "Array of sentences/words for vocabulary drills",
    },

    // Roleplay Drill Fields
    roleplay_dialogue: {
      type: [DialogueTurnSchema],
      default: [],
      description: "Legacy single-scene dialogue",
    },

    roleplay_scenes: {
      type: [RoleplaySceneSchema],
      default: [],
      description: "Array of scenes for multi-scene roleplay drills",
    },

    student_character_name: {
      type: String,
      default: "Student",
      description: "Display name for the student character in roleplay",
    },

    ai_character_name: {
      type: String,
      default: "AI",
      description: "Legacy single AI character name",
    },

    ai_character_names: {
      type: [String],
      default: [],
      description: "Array of AI character names",
    },

    // Matching Drill Fields
    matching_pairs: {
      type: [MatchingPairSchema],
      default: [],
      description: "Array of matching pairs",
    },

    // Definition Drill Fields
    definition_items: {
      type: [DefinitionItemSchema],
      default: [],
      description: "Array of words to define",
    },

    // Grammar Drill Fields
    grammar_items: {
      type: [GrammarItemSchema],
      default: [],
      description: "Array of grammar patterns",
    },

    // Sentence Writing Drill Fields
    sentence_writing_items: {
      type: [SentenceWritingItemSchema],
      default: [],
      description: "Array of words for sentence writing",
    },

    // Sentence Drill Fields (single word, definition + 2 sentences)
    sentence_drill_word: {
      type: String,
      default: "",
      description:
        "Target word for sentence drill (user provides definition + 2 sentences)",
    },

    // Listening Drill Fields
    listening_drill_title: {
      type: String,
      default: "",
      description: "Title for listening drill content",
    },
    listening_drill_content: {
      type: String,
      default: "",
      description: "Rich text content for listening drill (markdown supported)",
    },
    listening_drill_audio_url: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for listening content",
    },

    // Summary Drill Fields
    article_title: {
      type: String,
      default: "",
      description: "Title of the article for summary drills",
    },

    article_content: {
      type: String,
      default: "",
      description: "Full content of the article to be summarized",
    },
    
    article_audio_url: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for the article content",
    },

    // Metadata
    created_by: {
      type: String,
      required: [true, "Creator email is required"],
      description: "Email of the teacher/admin who created this drill",
      // Keep for backward compatibility, but also add ObjectId reference
    },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false, // Optional for backward compatibility
      description: "ObjectId reference to the user who created this drill",
      index: true,
    },

    created_date: {
      type: Date,
      default: Date.now,
      description: "Timestamp when the drill was created",
    },

    updated_date: {
      type: Date,
      default: Date.now,
      description: "Timestamp when the drill was last updated",
    },

    is_active: {
      type: Boolean,
      default: true,
      description: "Whether the drill is currently active/available",
    },

    // Analytics fields (updated by background jobs)
    totalAssignments: {
      type: Number,
      default: 0,
      min: 0,
    },
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
    averageCompletionTime: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: false, // We're using custom created_date and updated_date
    collection: "drills",
  }
);

// Indexes for performance
drillSchema.index({ assigned_to: 1, date: -1 }); // Keep for backward compatibility
drillSchema.index({ created_by: 1 }); // Keep for backward compatibility
drillSchema.index({ createdById: 1, created_date: -1 }); // New preferred index
drillSchema.index({ type: 1 });
drillSchema.index({ is_active: 1, date: 1 });

// Pre-save middleware to update updated_date
drillSchema.pre("save", function () {
  if (this.isModified() && !this.isNew) {
    this.updated_date = new Date();
  }
});

// Virtual for checking if drill is currently active based on date
// Note: date is now the completion/due date, not start date
// Drills are active immediately upon assignment
drillSchema.virtual("isCurrentlyActive").get(function () {
  const now = new Date();
  const completionDate = new Date(this.date);
  completionDate.setHours(23, 59, 59, 999);

  // Drill is active if current date is before or equal to completion date
  return now <= completionDate && this.is_active;
});

// Method to validate drill type-specific required fields
// Note: Validation removed to allow empty arrays initially - students will fill in solutions
drillSchema.methods.validateTypeSpecificFields = function (): string[] {
  // No validation errors - drills can be created with empty arrays
  // Students will fill in the content as their solutions
  return [];
};

// Prevent model recompilation in Next.js development
const DrillModel = models.Drill || model<IDrill>("Drill", drillSchema);
export default DrillModel;
