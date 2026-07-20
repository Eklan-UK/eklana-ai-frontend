// models/drill.model.ts
import { Schema, model, models, Document, Types } from "mongoose";
import {
  validateRoleplaySpeakerId,
  type RoleplaySpeakerId,
} from "@/lib/roleplay-speakers";
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

// Sub-schemas
const DialogueTurnSchema = new Schema(
  {
    speaker: {
      type: String,
      required: true,
      validate: {
        validator: validateRoleplaySpeakerId,
        message:
          'Speaker must be "student" or "ai_<index>" (e.g. ai_0, ai_1, …)',
      },
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

const PronunciationItemSchema = new Schema(
  {
    sound: {
      type: String,
      default: "",
      description: "Target sound / phonetic sample for pronunciation practice",
    },
    word: {
      type: String,
      default: "",
      description: "Word to practice",
    },
    sentence: {
      type: String,
      default: "",
      description: "Sentence containing the target sound/word",
    },
    soundAudioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for the sound",
    },
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
    audioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for the definition word",
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
    patternAudioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for grammar pattern",
    },
    exampleAudioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for grammar example",
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
    audioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for sentence-writing word",
    },
  },
  { _id: false }
);

const KeyPhraseItemSchema = new Schema(
  {
    prompt: {
      type: String,
      required: true,
      description: "Stimulus text shown to the learner (situation / question)",
    },
    respondentName: {
      type: String,
      default: "",
      description: "Name of the person speaking the prompt (e.g. Waiter, Colleague)",
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => v.length >= 2 && v.every((s) => s.trim().length > 0),
        message: "At least 2 non-empty options are required",
      },
      description: "Array of response options (must include correctAnswer)",
    },
    correctAnswer: {
      type: String,
      required: true,
      description: "The correct option text (must be one of the options)",
    },
    promptAudioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for the prompt",
    },
  },
  { _id: false }
);

const FillBlankItemSchema = new Schema(
  {
    context: {
      type: String,
      default: "",
      description: "Optional situational setup text shown before the sentence",
    },
    sentence: {
      type: String,
      required: true,
      description: "Sentence with blanks marked (e.g., 'I ___ to the store ___ buy milk')",
    },
    blanks: {
      type: [
        {
          position: {
            type: Number,
            required: true,
            description: "Index of the blank in the sentence (0-based)",
          },
          correctAnswer: {
            type: String,
            required: true,
            description: "The correct word to fill this blank",
          },
          options: {
            type: [String],
            required: true,
            validate: {
              validator: function(v: string[]) {
                // Must have at least 2 options (including correct answer)
                return v.length >= 2 && v.includes(this.correctAnswer);
              },
              message: "Options must include the correct answer and have at least 2 choices",
            },
            description: "Array of options for this blank (must include correctAnswer)",
          },
          hint: {
            type: String,
            default: "",
            description: "Optional hint for this blank",
          },
        },
      ],
      required: true,
      default: [],
      description: "Array of blanks in this sentence",
    },
    translation: {
      type: String,
      default: "",
      description: "Optional translation of the sentence",
    },
    audioUrl: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for the sentence",
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
    | "pronunciation"
    | "roleplay"
    | "matching"
    | "definition"
    | "summary"
    | "grammar"
    | "sentence_writing"
    | "sentence"
    | "listening"
    | "fill_blank"
    | "key_phrases";
  difficulty: "beginner" | "intermediate" | "advanced";
  date: Date;
  duration_days: number;
  assigned_to: string[]; // Array of user IDs (for counting purposes only, use DrillAssignment for analytics)
  context?: string;
  audio_example_url?: string;
  /** Accent/gender key for ElevenLabs pre-gen TTS (see tts-accent-voices). */
  tts_voice_key?: string;

  // Vocabulary Drill Fields (word + sentence practice)
  target_sentences: Array<{
    word?: string;
    wordTranslation?: string;
    text: string;
    translation?: string;
    wordAudioUrl?: string;
    sentenceAudioUrl?: string;
  }>;
  /** Pronunciation drills only (sound / word / sentence per item) */
  pronunciation_items?: Array<{
    sound: string;
    word: string;
    sentence: string;
    soundAudioUrl?: string;
    wordAudioUrl?: string;
    sentenceAudioUrl?: string;
  }>;

  // Roleplay Drill Fields
  roleplay_dialogue: Array<{
    speaker: RoleplaySpeakerId;
    text: string;
    translation?: string;
    audioUrl?: string;
  }>;
  roleplay_scenes: Array<{
    scene_name: string;
    context?: string;
    dialogue: Array<{
      speaker: RoleplaySpeakerId;
      text: string;
      translation?: string;
      audioUrl?: string;
    }>;
  }>;
  student_character_name?: string;
  ai_character_name?: string;
  ai_character_names?: string[];
  /** Shown to learners on the roleplay pre-start screen before "Let's Get Started" */
  drill_intro?: string;

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
    audioUrl?: string;
  }>;

  // Grammar Drill Fields
  grammar_items: Array<{
    pattern: string;
    hint?: string;
    example: string;
    patternAudioUrl?: string;
    exampleAudioUrl?: string;
  }>;

  // Sentence Writing Drill Fields
  sentence_writing_items: Array<{
    word: string;
    hint?: string;
    audioUrl?: string;
  }>;

  // Sentence Drill Fields (single word, definition + 2 sentences)
  sentence_drill_word?: string; // Target word for the drill
  sentence_drill_audio_url?: string; // Pre-generated TTS audio URL for sentence drill word

  // Listening Drill Fields
  listening_drill_title?: string; // Title for the listening content
  listening_drill_content?: string; // Rich text content (markdown supported)
  listening_drill_audio_url?: string; // Pre-generated TTS audio URL

  // Summary Drill Fields
  article_title?: string;
  article_content?: string;
  article_audio_url?: string; // Pre-generated TTS audio URL for article

  // Fill Blank Drill Fields
  fill_blank_items: Array<{
    context?: string;
    sentence: string;  // "I ___ to the store ___ buy milk"
    blanks: Array<{
      position: number;  // 0, 1 (index of blank in sentence)
      correctAnswer: string;  // "went", "to"
      options: string[];  // ["went", "go", "going", "gone"] - must include correctAnswer
      hint?: string;
    }>;
    translation?: string;
    audioUrl?: string;
  }>;

  // Key Phrases Drill Fields
  key_phrase_items: Array<{
    prompt: string;
    respondentName?: string;
    options: string[];
    correctAnswer: string;
    promptAudioUrl?: string;
  }>;

  // Metadata
  created_by: string; // Email of the teacher/admin (kept for backward compatibility)
  createdById?: Types.ObjectId | string; // Reference to creator (preferred); UUID for Better Auth admin/tutor accounts
  created_date: Date;
  updated_date: Date;
  is_active: boolean;

  /** Learning journey mission (1–5) from eklan-learners-journey.md */
  learning_journey_part?: 1 | 2 | 3 | 4 | 5;
  /** Learning journey topic slug within the mission */
  learning_journey_topic?: string;

  /** Shared admin library bookmark (global for all admins/tutors) */
  is_bookmarked: boolean;
  /** When the drill was bookmarked; null when not bookmarked */
  bookmarked_at?: Date | null;

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
      trim: true,
      default: "",
      description: "Title of the drill",
    },

    type: {
      type: String,
      required: [true, "Drill type is required"],
      enum: {
        values: [
          "vocabulary",
          "pronunciation",
          "roleplay",
          "matching",
          "definition",
          "summary",
          "grammar",
        "sentence_writing",
        "sentence",
        "listening",
        "fill_blank",
        "key_phrases",
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

    // Assignment - user IDs (empty when drill is saved but not yet assigned)
    assigned_to: {
      type: [String],
      default: [],
      description: "Array of learner user IDs assigned to this drill",
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

    tts_voice_key: {
      type: String,
      default: null,
      description:
        "Accent/gender key for ElevenLabs pre-generated TTS (e.g. british_female)",
    },

    // Vocabulary Drill Fields
    target_sentences: {
      type: [TargetSentenceSchema],
      default: [],
      description: "Array of sentences/words for vocabulary drills",
    },

    pronunciation_items: {
      type: [PronunciationItemSchema],
      default: [],
      description: "Pronunciation drill items (sound, word, sentence per row)",
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

    drill_intro: {
      type: String,
      default: "",
      description: "Intro copy shown on the roleplay pre-start screen",
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
    sentence_drill_audio_url: {
      type: String,
      default: "",
      description: "Pre-generated TTS audio URL for sentence drill word",
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

    // Fill Blank Drill Fields
    fill_blank_items: {
      type: [FillBlankItemSchema],
      default: [],
      description: "Array of sentences with blanks for fill-in-the-blank drills",
    },

    // Key Phrases Drill Fields
    key_phrase_items: {
      type: [KeyPhraseItemSchema],
      default: [],
      description: "Array of prompt-and-options items for key phrases drills",
    },

    // Metadata
    created_by: {
      type: String,
      required: [true, "Creator email is required"],
      description: "Email of the teacher/admin who created this drill",
      // Keep for backward compatibility, but also add ObjectId reference
    },
    createdById: {
      // Mixed: admin/tutor creators are also Better Auth users and can have
      // a UUID _id, not just ObjectId. No `ref` since populate cannot
      // reliably resolve a mixed-type field.
      type: Schema.Types.Mixed,
      required: false, // Optional for backward compatibility
      description: "Reference (ObjectId or UUID) to the user who created this drill",
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

    learning_journey_part: {
      type: Number,
      enum: [1, 2, 3, 4, 5],
      required: false,
      description: "Learning journey mission (1–5)",
    },

    learning_journey_topic: {
      type: String,
      trim: true,
      required: false,
      description: "Learning journey topic slug within the mission",
    },

    is_bookmarked: {
      type: Boolean,
      default: false,
      description: "Whether this drill is bookmarked in the shared admin library",
      index: true,
    },

    bookmarked_at: {
      type: Date,
      default: null,
      required: false,
      description: "Timestamp when the drill was bookmarked (null when not bookmarked)",
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
drillSchema.index({ learning_journey_part: 1, learning_journey_topic: 1 });
drillSchema.index({ is_bookmarked: 1, bookmarked_at: -1 });

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

// Re-register in dev so schema changes apply without a full server restart
if (process.env.NODE_ENV === "development" && models.Drill) {
  delete models.Drill;
}

const DrillModel = models.Drill || model<IDrill>("Drill", drillSchema);
export default DrillModel;
