/**
 * Drill utility functions
 * Centralized logic for drill-related operations
 */

import {
  drillCompletionDateEnd,
  isDrillCompletionOverdue,
} from "@/lib/drill-completion-date";

export type DrillStatus = "active" | "ongoing" | "upcoming" | "completed" | "missed" | "pending";

/** Consistent completion-time estimate shown to learners across all drill surfaces. */
export const DRILL_ESTIMATED_DURATION_LABEL = "5–15 minutes";

export interface DrillItem {
  assignmentId?: string;
  drill: {
    _id: string;
    date: string;
    duration_days?: number;
    is_active?: boolean;
    type: string;
  };
  dueDate?: string;
  completedAt?: string;
  assignmentStatus?: string;
  status?: string;
}

/**
 * Format date to readable string (calendar day of the deadline after EOD normalize)
 */
export function formatDate(dateString: string): string {
  const date = drillCompletionDateEnd(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Get drill status based on dates and completion
 * Note: drill.date is now the completion/due date, not start date
 * Drills become active immediately upon assignment
 */
export function getDrillStatus(drill: any): DrillStatus {
  // Use assignment dueDate if available, otherwise use drill.date as completion date
  const completionDate = drill.dueDate ?? drill.date ?? drill.drill?.date;

  const assignmentStatus = drill.assignmentStatus ?? drill.status;

  // Check if drill is completed
  if (
    drill.completedAt ||
    assignmentStatus === "completed" ||
    drill.latestAttempt?.completedAt
  ) {
    return "completed";
  }

  // Check if drill is missed (completion date has passed and not completed)
  if (
    isDrillCompletionOverdue(completionDate) &&
    !drill.completedAt &&
    assignmentStatus !== "completed" &&
    !drill.latestAttempt?.completedAt
  ) {
    return "missed";
  }

  // If drill has an assignment, it's active/ongoing (drills are active immediately upon assignment)
  // Status is "ongoing" if it's part of an assignment, "active" otherwise
  if (drill.assignmentId || drill.drill) {
    return "ongoing";
  }

  // Default to active (drill is available)
  return "active";
}

/** Canonical drill type slugs used in the API and learner UI. */
export const KNOWN_DRILL_TYPES = [
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
] as const;

export type DrillTypeSlug = (typeof KNOWN_DRILL_TYPES)[number];

const DRILL_TYPE_ALIASES: Record<string, DrillTypeSlug> = {
  "key-phrases": "key_phrases",
  "key phrases": "key_phrases",
  keyphrases: "key_phrases",
  "fill-in-the-blank": "fill_blank",
  "fill in the blank": "fill_blank",
  fillblank: "fill_blank",
  sentencewriting: "sentence_writing",
  "sentence writing": "sentence_writing",
};

/**
 * Normalize drill.type from API/DB (handles spacing, hyphens, casing).
 * Returns a known slug when recognized, otherwise a snake_case fallback.
 */
export function normalizeDrillType(type: unknown): string | null {
  if (type == null) return null;
  const raw = String(type).trim().toLowerCase();
  if (!raw) return null;

  const fromAlias = DRILL_TYPE_ALIASES[raw];
  if (fromAlias) return fromAlias;

  const snake = raw.replace(/[\s-]+/g, "_");
  if ((KNOWN_DRILL_TYPES as readonly string[]).includes(snake)) {
    return snake;
  }

  return snake;
}

/**
 * Type used by DrillPracticeInterface — normalizes aliases and infers key_phrases
 * when key_phrase_items are present (guards missing/wrong type in DB).
 */
export function resolveDrillPracticeType(drill: {
  type?: unknown;
  key_phrase_items?: unknown[] | null;
} | null | undefined): string | null {
  if (!drill) return null;

  const normalized = normalizeDrillType(drill.type);
  if (normalized === "key_phrases") return "key_phrases";

  const items = drill.key_phrase_items;
  if (Array.isArray(items) && items.length > 0) {
    return "key_phrases";
  }

  return normalized ?? (drill.type != null ? String(drill.type) : null);
}

/** Human-readable labels for learner-facing drill lists. */
export const DRILL_TYPE_LABELS: Record<string, string> = {
  vocabulary: "Vocabulary/Phrase",
  pronunciation: "Pronunciation",
  roleplay: "Speaking",
  matching: "Matching",
  definition: "Vocabulary",
  summary: "Summarising",
  grammar: "Grammar",
  sentence_writing: "Writing",
  sentence: "Sentence",
  listening: "Listening",
  fill_blank: "Fill-in-the-Blank",
  key_phrases: "Key Phrases",
};

export function getDrillTypeLabel(type: string | undefined | null): string {
  if (!type) return "Practice";
  return (
    DRILL_TYPE_LABELS[type] ||
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * Get drill type icon
 */
export function getDrillIcon(type: string): string {
  const icons: Record<string, string> = {
    vocabulary: "📚",
    pronunciation: "🎙️",
    roleplay: "💬",
    matching: "🔗",
    definition: "📖",
    summary: "📝",
    grammar: "✏️",
    sentence_writing: "✍️",
    fill_blank: "📋",
    key_phrases: "🗝️",
  };
  return icons[type] || "📚";
}

/**
 * Get drill type info (icon, color, border color)
 */
export interface FillBlankItemInput {
  context?: string;
  sentence: string;
  blanks: Array<{
    position: number;
    correctAnswer: string;
    options: string[];
    hint?: string;
  }>;
  translation?: string;
  audioUrl?: string;
}

/**
 * Normalize fill-in-the-blank items before API submit.
 * Trims whitespace on options/answers so server validation stays consistent across browsers/OSes.
 */
export function normalizeFillBlankItems(items: FillBlankItemInput[]) {
  return items
    .filter((item) => item.sentence.trim())
    .map((item) => {
      const context = item.context?.trim();
      return {
      ...(context ? { context } : {}),
      sentence: item.sentence.trim(),
      blanks: item.blanks
        .map((blank) => {
          const correctAnswer = blank.correctAnswer.trim();
          const options = blank.options
            .map((opt) => opt.trim())
            .filter((opt) => opt.length > 0);
          return {
            position: blank.position,
            correctAnswer,
            options,
            hint: blank.hint?.trim() || undefined,
          };
        })
        .filter((blank) => blank.correctAnswer && blank.options.length >= 2)
        .map((blank, idx) => ({ ...blank, position: idx })),
      translation: item.translation?.trim() || undefined,
      ...(item.audioUrl ? { audioUrl: item.audioUrl } : {}),
    };
    })
    .filter((item) => item.blanks.length > 0);
}

/** Client-side validation; returns an error message or null if valid. */
export function validateFillBlankItems(items: FillBlankItemInput[]): string | null {
  const withSentences = items.filter((item) => item.sentence.trim());
  if (withSentences.length === 0) {
    return "Please add at least one sentence with blanks";
  }

  for (const item of withSentences) {
    const preview = item.sentence.trim().substring(0, 30);
    const activeBlanks = item.blanks.filter((b) => b.correctAnswer.trim());
    if (activeBlanks.length === 0) {
      return `Sentence "${preview}..." must have at least one blank with a correct answer`;
    }

    for (const blank of item.blanks) {
      if (!blank.correctAnswer.trim()) continue;

      const correctAnswer = blank.correctAnswer.trim();
      const options = blank.options.map((o) => o.trim()).filter(Boolean);

      if (options.length < 2) {
        return "Each blank must have at least 2 options";
      }
      if (!options.includes(correctAnswer)) {
        return "Options must include the correct answer";
      }
    }
  }

  return null;
}

function copyMediaFields<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown> | undefined,
  fields: string[]
): T {
  if (!source) return target;
  const result = { ...target };
  for (const field of fields) {
    const value = source[field];
    if (value) {
      (result as Record<string, unknown>)[field] = value;
    }
  }
  return result;
}

function mergeArrayMedia<T extends Record<string, unknown>>(
  items: T[] | undefined,
  sourceItems: Array<Record<string, unknown>> | undefined,
  fields: string[]
): T[] | undefined {
  if (!items || !sourceItems) return items;
  return items.map((item, index) =>
    copyMediaFields(item, sourceItems[index], fields)
  );
}

/** Preserve pre-generated audio URLs when copying a drill. */
export function mergeMediaFieldsFromSource(
  payload: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const merged = { ...payload };
  const drillType = (payload.type as string) || (source.type as string);

  for (const field of [
    "audio_example_url",
    "sentence_drill_audio_url",
    "listening_drill_audio_url",
    "article_audio_url",
  ]) {
    if (source[field]) {
      merged[field] = source[field];
    }
  }

  switch (drillType) {
    case "vocabulary":
      merged.target_sentences = mergeArrayMedia(
        merged.target_sentences as Array<Record<string, unknown>>,
        source.target_sentences as Array<Record<string, unknown>>,
        ["wordAudioUrl", "sentenceAudioUrl"]
      );
      break;
    case "pronunciation":
      merged.pronunciation_items = mergeArrayMedia(
        merged.pronunciation_items as Array<Record<string, unknown>>,
        source.pronunciation_items as Array<Record<string, unknown>>,
        ["soundAudioUrl", "wordAudioUrl", "sentenceAudioUrl"]
      );
      break;
    case "roleplay": {
      const scenes = merged.roleplay_scenes as Array<{
        scene_name: string;
        context?: string;
        dialogue: Array<Record<string, unknown>>;
      }>;
      const sourceScenes = source.roleplay_scenes as Array<{
        dialogue?: Array<Record<string, unknown>>;
      }>;
      if (scenes && sourceScenes) {
        merged.roleplay_scenes = scenes.map((scene, sceneIndex) => ({
          ...scene,
          dialogue: scene.dialogue.map((turn, turnIndex) =>
            copyMediaFields(
              turn,
              sourceScenes[sceneIndex]?.dialogue?.[turnIndex],
              ["audioUrl"]
            )
          ),
        }));
      }
      break;
    }
    case "matching":
      merged.matching_pairs = mergeArrayMedia(
        merged.matching_pairs as Array<Record<string, unknown>>,
        source.matching_pairs as Array<Record<string, unknown>>,
        ["leftAudioUrl", "rightAudioUrl"]
      );
      break;
    case "grammar":
      merged.grammar_items = mergeArrayMedia(
        merged.grammar_items as Array<Record<string, unknown>>,
        source.grammar_items as Array<Record<string, unknown>>,
        ["patternAudioUrl", "exampleAudioUrl"]
      );
      break;
    case "sentence_writing":
      merged.sentence_writing_items = mergeArrayMedia(
        merged.sentence_writing_items as Array<Record<string, unknown>>,
        source.sentence_writing_items as Array<Record<string, unknown>>,
        ["audioUrl"]
      );
      break;
    case "fill_blank":
      merged.fill_blank_items = mergeArrayMedia(
        merged.fill_blank_items as Array<Record<string, unknown>>,
        source.fill_blank_items as Array<Record<string, unknown>>,
        ["audioUrl"]
      );
      break;
    case "key_phrases":
      merged.key_phrase_items = mergeArrayMedia(
        merged.key_phrase_items as Array<Record<string, unknown>>,
        source.key_phrase_items as Array<Record<string, unknown>>,
        ["promptAudioUrl"]
      );
      break;
    case "definition":
      merged.definition_items = mergeArrayMedia(
        merged.definition_items as Array<Record<string, unknown>>,
        source.definition_items as Array<Record<string, unknown>>,
        ["audioUrl"]
      );
      break;
  }

  return merged;
}

export function getDrillTypeInfo(type: string): {
  icon: string;
  color: string;
  borderColor: string;
} {
  const types: Record<
    string,
    { icon: string; color: string; borderColor: string }
  > = {
    vocabulary: {
      icon: "📚",
      color: "green",
      borderColor: "border-l-green-500",
    },
    pronunciation: {
      icon: "🎙️",
      color: "emerald",
      borderColor: "border-l-emerald-500",
    },
    roleplay: { icon: "💬", color: "blue", borderColor: "border-l-blue-500" },
    matching: {
      icon: "🔗",
      color: "primary",
      borderColor: "border-l-primary-500",
    },
    definition: {
      icon: "📖",
      color: "orange",
      borderColor: "border-l-orange-500",
    },
    summary: {
      icon: "📝",
      color: "indigo",
      borderColor: "border-l-indigo-500",
    },
    grammar: { icon: "✏️", color: "pink", borderColor: "border-l-pink-500" },
    sentence_writing: {
      icon: "✍️",
      color: "teal",
      borderColor: "border-l-teal-500",
    },
    fill_blank: {
      icon: "📋",
      color: "violet",
      borderColor: "border-l-violet-500",
    },
    key_phrases: {
      icon: "🗝️",
      color: "amber",
      borderColor: "border-l-amber-500",
    },
  };
  return (
    types[type] || {
      icon: "📚",
      color: "gray",
      borderColor: "border-l-gray-500",
    }
  );
}


