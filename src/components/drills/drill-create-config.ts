import type { LearningJourneyPartId } from "@/domain/learning-journey/learning-journey.catalog";
import type { DrillDraft } from "@/components/drills/drill-draft.types";
import {
  getDefaultCompletionDate,
  getDefaultDrillDraft,
} from "@/components/drills/drill-draft.types";
import { formatDrillCompletionDateForInput } from "@/lib/drill-completion-date";

const DRAFT_KEYS = {
  admin: "admin_drill_draft",
  tutor: "drill_draft",
} as const;

const DEFAULT_RETURN = {
  admin: "/admin/drill",
  tutor: "/tutor/drills",
} as const;

const CREATE_PATH = {
  admin: "/admin/drills/create",
  tutor: "/tutor/drills/create",
} as const;

const POST_CREATE_PATH = {
  admin: "/admin/drills/assignment",
  tutor: "/tutor/drills/all",
} as const;

export type DrillCreateVariant = keyof typeof DRAFT_KEYS;

export function getDrillCreateDraftKey(variant: DrillCreateVariant): string {
  return DRAFT_KEYS[variant];
}

export function getDrillCreateDefaultReturn(variant: DrillCreateVariant): string {
  return DEFAULT_RETURN[variant];
}

export function getDrillCreatePath(variant: DrillCreateVariant): string {
  return CREATE_PATH[variant];
}

export function getDrillPostCreatePath(variant: DrillCreateVariant): string {
  return POST_CREATE_PATH[variant];
}

export function drillRecordToDraft(
  drill: Record<string, unknown>,
  users: Array<{ _id: { toString(): string }; email?: string }>,
): DrillDraft {
  const base = getDefaultDrillDraft({
    drillTitle: String(drill.title || ""),
    drillType: String(drill.type || "vocabulary"),
    difficulty: String(drill.difficulty || "intermediate"),
    completionDate: drill.date
      ? formatDrillCompletionDateForInput(String(drill.date))
      : getDefaultCompletionDate(),
    durationDays: Number(drill.duration_days) || 7,
    context: String(drill.context || ""),
    audioExampleUrl: String(drill.audio_example_url || ""),
    ttsVoiceKey: String(drill.tts_voice_key || ""),
    journeyPart:
      drill.learning_journey_part != null
        ? (drill.learning_journey_part as LearningJourneyPartId)
        : "",
    journeyTopic: String(drill.learning_journey_topic || ""),
  });

  if (drill.assigned_to && Array.isArray(drill.assigned_to)) {
    const assignedRefs = new Set(drill.assigned_to as string[]);
    const assignedUserIds: string[] = [];
    users.forEach((user) => {
      const userId = user._id.toString();
      if (
        assignedRefs.has(userId) ||
        (user.email && assignedRefs.has(user.email))
      ) {
        assignedUserIds.push(userId);
      }
    });
    base.selectedUsers = assignedUserIds;
  }

  const type = base.drillType;

  if (type === "vocabulary" && Array.isArray(drill.target_sentences)) {
    base.vocabularyItems =
      drill.target_sentences.length > 0
        ? (drill.target_sentences as DrillDraft["vocabularyItems"])
        : base.vocabularyItems;
  } else if (type === "pronunciation" && Array.isArray(drill.pronunciation_items)) {
    base.pronunciationItems =
      drill.pronunciation_items.length > 0
        ? (drill.pronunciation_items as DrillDraft["pronunciationItems"])
        : base.pronunciationItems;
  } else if (type === "roleplay") {
    base.studentCharacterName = String(drill.student_character_name || "");
    base.aiCharacterNames =
      Array.isArray(drill.ai_character_names) && drill.ai_character_names.length > 0
        ? (drill.ai_character_names as string[])
        : (drill as { ai_character_name?: string }).ai_character_name
          ? [String((drill as { ai_character_name?: string }).ai_character_name)]
          : base.aiCharacterNames;
    {
      const storedVoices = Array.isArray(drill.ai_character_voice_keys)
        ? (drill.ai_character_voice_keys as string[])
        : [];
      base.aiCharacterVoiceKeys = base.aiCharacterNames.map(
        (_, i) => storedVoices[i] ?? "",
      );
      const storedAvatars = Array.isArray(drill.ai_character_avatars)
        ? (drill.ai_character_avatars as string[])
        : [];
      base.aiCharacterAvatars = base.aiCharacterNames.map(
        (_, i) => storedAvatars[i] ?? "",
      );
    }
    base.drillIntro =
      typeof drill.drill_intro === "string" ? drill.drill_intro : "";
    base.roleplayScenes =
      Array.isArray(drill.roleplay_scenes) && drill.roleplay_scenes.length > 0
        ? (drill.roleplay_scenes as DrillDraft["roleplayScenes"])
        : base.roleplayScenes;
  } else if (type === "matching" && Array.isArray(drill.matching_pairs)) {
    base.matchingPairs =
      drill.matching_pairs.length > 0
        ? (drill.matching_pairs as DrillDraft["matchingPairs"])
        : base.matchingPairs;
  } else if (type === "grammar" && Array.isArray(drill.grammar_items)) {
    base.grammarItems =
      drill.grammar_items.length > 0
        ? (drill.grammar_items as DrillDraft["grammarItems"])
        : base.grammarItems;
  } else if (
    type === "sentence_writing" &&
    Array.isArray(drill.sentence_writing_items)
  ) {
    base.sentenceWritingItems =
      drill.sentence_writing_items.length > 0
        ? (drill.sentence_writing_items as DrillDraft["sentenceWritingItems"])
        : base.sentenceWritingItems;
  } else if (type === "summary") {
    base.articleTitle = String(drill.article_title || "");
    base.articleContent = String(drill.article_content || "");
  } else if (type === "listening") {
    base.listeningTitle = String(drill.listening_drill_title || "");
    base.listeningContent = String(drill.listening_drill_content || "");
  } else if (type === "fill_blank" && Array.isArray(drill.fill_blank_items)) {
    base.fillBlankItems =
      drill.fill_blank_items.length > 0
        ? (drill.fill_blank_items as DrillDraft["fillBlankItems"])
        : base.fillBlankItems;
  } else if (type === "key_phrases" && Array.isArray(drill.key_phrase_items)) {
    const kpItems = drill.key_phrase_items as Array<Record<string, unknown>>;
    base.keyPhraseItems =
      kpItems.length > 0
        ? kpItems.map((item) => ({
            context: String(item.context || ""),
            respondentName: String(item.respondentName || ""),
            prompt: String(item.prompt || ""),
            options:
              Array.isArray(item.options) && item.options.length > 0
                ? (item.options as string[])
                : ["", ""],
            correctAnswer: String(item.correctAnswer || ""),
          }))
        : base.keyPhraseItems;
  }

  return base;
}
