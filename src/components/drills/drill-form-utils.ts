import { toast } from "sonner";
import type { ParsedContent } from "@/services/document-parser.service";
import {
  isValidPartTopicPair,
} from "@/domain/learning-journey/learning-journey.catalog";
import { normalizeFillBlankItems, validateFillBlankItems } from "@/utils/drill";
import type { DrillDraft } from "@/components/drills/drill-draft.types";
import { getDefaultDrillDraft } from "@/components/drills/drill-draft.types";
import type { AIDrillBulkPendingItem } from "@/hooks/useAIDrillCreationWorkflow";
import { AI_DRILL_TYPES } from "@/constants/ai-drill";

export function applyParsedContentToDraft(
  draft: DrillDraft,
  content: ParsedContent,
): DrillDraft {
  const next = { ...draft };
  const { extractedData, type } = content;
  const { title, items, metadata } = extractedData;

  if (title) {
    next.drillTitle = title;
  }

  if (type !== "unknown" && content.confidence >= 0.6) {
    next.drillType = type;
  }

  if (metadata?.difficulty) {
    next.difficulty = metadata.difficulty;
  }

  if (metadata?.context) {
    next.context = metadata.context;
  }

  switch (type) {
    case "vocabulary":
      next.vocabularyItems =
        items.length > 0
          ? (items as DrillDraft["vocabularyItems"])
          : getDefaultDrillDraft().vocabularyItems;
      break;
    case "matching":
      next.matchingPairs =
        items.length > 0
          ? (items as DrillDraft["matchingPairs"])
          : getDefaultDrillDraft().matchingPairs;
      break;
    case "roleplay": {
      const defaultScenes = getDefaultDrillDraft().roleplayScenes;
      const first = items[0] as Record<string, unknown> | undefined;
      if (first?.roleplay_scenes) {
        next.roleplayScenes =
          (first.roleplay_scenes as DrillDraft["roleplayScenes"]).length > 0
            ? (first.roleplay_scenes as DrillDraft["roleplayScenes"])
            : defaultScenes;
        if (first.student_character_name) {
          next.studentCharacterName = String(first.student_character_name);
        }
        if ((first.ai_character_names as string[])?.length) {
          next.aiCharacterNames = first.ai_character_names as string[];
        }
        if (first.context) next.context = String(first.context);
        if (first.drill_intro) next.drillIntro = String(first.drill_intro);
      } else {
        next.roleplayScenes =
          items.length > 0
            ? (items as DrillDraft["roleplayScenes"])
            : defaultScenes;
      }
      break;
    }
    case "grammar":
      next.grammarItems =
        items.length > 0
          ? (items as DrillDraft["grammarItems"])
          : getDefaultDrillDraft().grammarItems;
      break;
    case "sentence_writing":
      next.sentenceWritingItems =
        items.length > 0
          ? (items as DrillDraft["sentenceWritingItems"])
          : getDefaultDrillDraft().sentenceWritingItems;
      break;
    case "summary":
      if (items.length > 0 && (items[0] as { content?: string }).content) {
        next.articleContent = (items[0] as { content: string }).content;
      }
      if (title || (items[0] as { title?: string })?.title) {
        next.articleTitle =
          title || (items[0] as { title?: string }).title || "";
      }
      break;
    case "listening":
      if (items.length > 0 && (items[0] as { content?: string }).content) {
        next.listeningContent = (items[0] as { content: string }).content;
      }
      if (title || (items[0] as { title?: string })?.title) {
        next.listeningTitle =
          title || (items[0] as { title?: string }).title || "";
      }
      break;
    case "fill_blank":
      next.fillBlankItems =
        items.length > 0
          ? items.map((item) => {
              const row = item as Record<string, unknown>;
              return {
                sentence: String(row.sentence || ""),
                translation: String(row.translation || ""),
                blanks:
                  Array.isArray(row.blanks) && row.blanks.length > 0
                    ? (row.blanks as DrillDraft["fillBlankItems"][0]["blanks"])
                    : getDefaultDrillDraft().fillBlankItems[0].blanks,
              };
            })
          : getDefaultDrillDraft().fillBlankItems;
      break;
    case "pronunciation":
      next.pronunciationItems =
        items.length > 0
          ? (items as DrillDraft["pronunciationItems"])
          : getDefaultDrillDraft().pronunciationItems;
      break;
    case "key_phrases":
      next.keyPhraseItems =
        items.length > 0
          ? items.map((item) => {
              const row = item as Record<string, unknown>;
              return {
                respondentName: String(row.respondentName || ""),
                prompt: String(row.prompt || row.word || ""),
                options:
                  Array.isArray(row.options) && row.options.length > 0
                    ? (row.options as string[])
                    : ["", ""],
                correctAnswer: String(row.correctAnswer || ""),
              };
            })
          : getDefaultDrillDraft().keyPhraseItems;
      break;
  }

  return next;
}

export function draftFromBulkPendingItem(
  item: AIDrillBulkPendingItem,
): DrillDraft {
  const base = getDefaultDrillDraft({
    drillType: item.drillType,
    difficulty: item.difficulty,
    selectedUsers: item.studentIds,
    journeyPart: item.journeyPart,
    journeyTopic: item.journeyTopic,
    completionDate: item.completionDate ?? "",
  });
  return applyParsedContentToDraft(base, item.parsed);
}

export function validateDrillDraft(
  draft: DrillDraft,
  options?: { requireUsers?: boolean },
): boolean {
  if (!draft.completionDate) {
    toast.error("Please select a completion date");
    return false;
  }

  if (!draft.journeyPart || !draft.journeyTopic) {
    toast.error("Please select a learning journey mission and topic");
    return false;
  }

  if (!isValidPartTopicPair(draft.journeyPart, draft.journeyTopic)) {
    toast.error("Selected topic does not belong to the selected mission");
    return false;
  }

  const { drillType } = draft;

  if (drillType === "vocabulary") {
    if (
      draft.vocabularyItems.length === 0 ||
      draft.vocabularyItems.some((v) => !v.text.trim())
    ) {
      toast.error("Please add at least one vocabulary item with a sentence");
      return false;
    }
  } else if (drillType === "pronunciation") {
    if (draft.pronunciationItems.length === 0) {
      toast.error("Add at least one pronunciation item");
      return false;
    }
    for (const p of draft.pronunciationItems) {
      if (!p.sound.trim() || !p.word.trim() || !p.sentence.trim()) {
        toast.error("Each pronunciation item needs Sound, Word, and Sentence");
        return false;
      }
    }
  } else if (drillType === "roleplay") {
    if (!draft.context.trim()) {
      toast.error("Please provide a context/scenario for the roleplay");
      return false;
    }
    if (!draft.studentCharacterName.trim()) {
      toast.error("Please provide a student character name");
      return false;
    }
    if (draft.aiCharacterNames.some((name) => !name.trim())) {
      toast.error("Please provide all AI character names");
      return false;
    }
    if (
      draft.roleplayScenes.length === 0 ||
      draft.roleplayScenes.some(
        (s) => s.dialogue.length < 2 || s.dialogue.some((d) => !d.text.trim()),
      )
    ) {
      toast.error("Please add at least one scene with complete dialogue");
      return false;
    }
  } else if (drillType === "matching") {
    if (
      draft.matchingPairs.length === 0 ||
      draft.matchingPairs.some((p) => !p.left.trim() || !p.right.trim())
    ) {
      toast.error(
        "Please add at least one matching pair with both sides filled",
      );
      return false;
    }
  } else if (drillType === "grammar") {
    if (
      draft.grammarItems.length === 0 ||
      draft.grammarItems.some((g) => !g.pattern.trim() || !g.example.trim())
    ) {
      toast.error(
        "Please add at least one grammar pattern with an example sentence",
      );
      return false;
    }
  } else if (drillType === "sentence_writing") {
    if (
      draft.sentenceWritingItems.length === 0 ||
      draft.sentenceWritingItems.some((s) => !s.word.trim())
    ) {
      toast.error("Please add at least one word for sentence writing");
      return false;
    }
  } else if (drillType === "summary") {
    if (!draft.articleTitle.trim() || !draft.articleContent.trim()) {
      toast.error("Please provide both article title and content");
      return false;
    }
  } else if (drillType === "listening") {
    if (!draft.listeningTitle.trim() || !draft.listeningContent.trim()) {
      toast.error("Please provide both listening title and content");
      return false;
    }
  } else if (drillType === "fill_blank") {
    const fillBlankError = validateFillBlankItems(draft.fillBlankItems);
    if (fillBlankError) {
      toast.error(fillBlankError);
      return false;
    }
  } else if (drillType === "key_phrases") {
    if (
      draft.keyPhraseItems.length === 0 ||
      !draft.keyPhraseItems.some((item) => item.prompt.trim())
    ) {
      toast.error("Please add at least one key phrase question");
      return false;
    }
    for (const item of draft.keyPhraseItems) {
      if (!item.prompt.trim()) continue;
      if (item.options.filter((o) => o.trim()).length < 2) {
        toast.error("Each question must have at least 2 options");
        return false;
      }
      if (!item.correctAnswer.trim()) {
        toast.error("Please select a correct answer for each question");
        return false;
      }
      if (!item.options.includes(item.correctAnswer)) {
        toast.error("Correct answer must be one of the options");
        return false;
      }
    }
  }

  if (options?.requireUsers && draft.selectedUsers.length === 0) {
    toast.error("Please select at least one user");
    return false;
  }

  return true;
}

export function buildDrillPayloadFromDraft(
  draft: DrillDraft,
  options?: {
    assignedTo?: string[];
    isActive?: boolean;
    omitAssignment?: boolean;
  },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: draft.drillTitle.trim(),
    type: draft.drillType,
    difficulty: draft.difficulty.toLowerCase(),
    date: new Date(draft.completionDate).toISOString(),
    duration_days: draft.durationDays,
    context: draft.context || undefined,
    audio_example_url: draft.audioExampleUrl || undefined,
    learning_journey_part: draft.journeyPart,
    learning_journey_topic: draft.journeyTopic,
  };

  if (!options?.omitAssignment) {
    if (options?.assignedTo !== undefined) {
      payload.assigned_to = options.assignedTo;
    }
    if (options?.isActive !== undefined) {
      payload.is_active = options.isActive;
    }
  }

  const { drillType } = draft;

  if (drillType === "vocabulary") {
    payload.target_sentences = draft.vocabularyItems
      .filter((v) => v.text.trim())
      .map((v) => ({
        word: v.word?.trim() || undefined,
        wordTranslation: v.wordTranslation?.trim() || undefined,
        text: v.text.trim(),
        translation: v.translation?.trim() || undefined,
      }));
    payload.pronunciation_items = [];
  } else if (drillType === "pronunciation") {
    payload.target_sentences = [];
    payload.pronunciation_items = draft.pronunciationItems.map((p) => ({
      sound: p.sound.trim(),
      word: p.word.trim(),
      sentence: p.sentence.trim(),
    }));
  } else if (drillType === "roleplay") {
    payload.roleplay_scenes = draft.roleplayScenes;
    payload.student_character_name = draft.studentCharacterName.trim();
    payload.ai_character_names = draft.aiCharacterNames.map((n) => n.trim());
    payload.drill_intro = draft.drillIntro.trim();
  } else if (drillType === "matching") {
    payload.matching_pairs = draft.matchingPairs
      .filter((p) => p.left.trim() && p.right.trim())
      .map((p) => ({
        left: p.left.trim(),
        right: p.right.trim(),
        leftTranslation: p.leftTranslation?.trim() || undefined,
        rightTranslation: p.rightTranslation?.trim() || undefined,
      }));
  } else if (drillType === "grammar") {
    payload.grammar_items = draft.grammarItems
      .filter((g) => g.pattern.trim())
      .map((g) => ({
        pattern: g.pattern.trim(),
        hint: g.hint?.trim() || undefined,
        example: g.example.trim(),
      }));
  } else if (drillType === "sentence_writing") {
    payload.sentence_writing_items = draft.sentenceWritingItems
      .filter((s) => s.word.trim())
      .map((s) => ({
        word: s.word.trim(),
        hint: s.hint?.trim() || undefined,
      }));
  } else if (drillType === "summary") {
    payload.article_title = draft.articleTitle.trim();
    payload.article_content = draft.articleContent.trim();
  } else if (drillType === "listening") {
    payload.listening_drill_title = draft.listeningTitle.trim();
    payload.listening_drill_content = draft.listeningContent.trim();
  } else if (drillType === "fill_blank") {
    payload.fill_blank_items = normalizeFillBlankItems(draft.fillBlankItems);
  } else if (drillType === "key_phrases") {
    payload.key_phrase_items = draft.keyPhraseItems
      .filter((item) => item.prompt.trim())
      .map((item) => ({
        prompt: item.prompt.trim(),
        respondentName: item.respondentName?.trim() || undefined,
        options: item.options.filter((o) => o.trim()),
        correctAnswer: item.correctAnswer.trim(),
      }));
  }

  return payload;
}

/** Content shape for bulk-create-assign API (mapContentFields input) */
export function buildBulkContentFromDraft(draft: DrillDraft): Record<string, unknown> {
  const payload = buildDrillPayloadFromDraft(draft, { omitAssignment: true });
  const { drillType } = draft;

  switch (drillType) {
    case "vocabulary":
      return { target_sentences: payload.target_sentences };
    case "pronunciation":
      return { pronunciation_items: payload.pronunciation_items };
    case "roleplay":
      return {
        roleplay_scenes: payload.roleplay_scenes,
        student_character_name: payload.student_character_name,
        ai_character_names: payload.ai_character_names,
        drill_intro: payload.drill_intro,
        context: draft.context,
      };
    case "matching":
      return { matching_pairs: payload.matching_pairs };
    case "grammar":
      return { grammar_items: payload.grammar_items };
    case "sentence_writing":
      return { sentence_writing_items: payload.sentence_writing_items };
    case "summary":
      return {
        article_title: payload.article_title,
        article_content: payload.article_content,
      };
    case "listening":
      return {
        content_title: payload.listening_drill_title,
        content: payload.listening_drill_content,
        article_title: payload.listening_drill_title,
        article_content: payload.listening_drill_content,
      };
    case "fill_blank":
      return { fill_blank_items: payload.fill_blank_items };
    case "key_phrases":
      return { key_phrase_items: payload.key_phrase_items };
    default:
      return {};
  }
}

export function getDrillTypeLabel(drillType: string): string {
  return AI_DRILL_TYPES.find((t) => t.value === drillType)?.label ?? drillType;
}

export function getMissingCompletionDateLabels(drafts: DrillDraft[]): string[] {
  return drafts
    .filter((d) => !d.completionDate)
    .map((d) => getDrillTypeLabel(d.drillType));
}

// One drill+assignment is created per selected student, so a draft with multiple
// selected students must expand into multiple payload entries here — otherwise
// only the first selected student (`selectedUsers[0]`) would ever get assigned.
export function buildBulkAssignPayload(drafts: DrillDraft[]) {
  return drafts.flatMap((draft) => {
    const content = buildBulkContentFromDraft(draft);

    return draft.selectedUsers.map((studentId) => ({
      drillType: draft.drillType,
      title: draft.drillTitle.trim() || undefined,
      content,
      studentId,
      completionDate: draft.completionDate,
      difficulty: draft.difficulty.toLowerCase(),
      topic: draft.journeyTopic || undefined,
      part: draft.journeyPart ?? undefined,
    }));
  });
}
