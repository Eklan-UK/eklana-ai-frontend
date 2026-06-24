import type { AiDrillType } from "@/constants/ai-drill";
import type { ParsedContent } from "@/services/document-parser.service";

/**
 * Converts flat AI generate response into ParsedContent shape
 * expected by handleApplyParsedContent in the drill builder.
 */
export function normalizeAiGeneratedToParsedContent(
  drillType: AiDrillType | string,
  aiData: Record<string, unknown>,
): ParsedContent {
  const type = drillType as ParsedContent["type"];
  let items: unknown[] = [];
  let title: string | undefined;

  switch (drillType) {
    case "vocabulary":
      items = (aiData.target_sentences as unknown[]) ?? [];
      break;
    case "pronunciation":
      items = (aiData.pronunciation_items as unknown[]) ?? [];
      break;
    case "roleplay":
      items = [
        {
          roleplay_scenes: aiData.roleplay_scenes ?? [],
          student_character_name: aiData.student_character_name ?? "",
          ai_character_names: aiData.ai_character_names ?? [""],
          drill_intro: aiData.drill_intro ?? "",
          context: aiData.context ?? "",
        },
      ];
      break;
    case "matching":
      items = (aiData.matching_pairs as unknown[]) ?? [];
      break;
    case "definition":
      items = (aiData.definition_items as unknown[]) ?? [];
      break;
    case "grammar":
      items = (aiData.grammar_items as unknown[]) ?? [];
      break;
    case "sentence_writing":
      items = (aiData.sentence_writing_items as unknown[]) ?? [];
      break;
    case "fill_blank":
      items = (aiData.fill_blank_items as unknown[]) ?? [];
      break;
    case "key_phrases":
      items = (aiData.key_phrase_items as unknown[]) ?? [];
      break;
    case "summary":
      title = (aiData.article_title as string) ?? "";
      items = [
        {
          title: aiData.article_title ?? "",
          content: aiData.article_content ?? "",
        },
      ];
      break;
    default:
      items = [];
  }

  return {
    type,
    confidence: 1,
    extractedData: {
      title,
      items: items as ParsedContent["extractedData"]["items"],
      metadata: {
        context: (aiData.context as string) ?? undefined,
      },
    },
  };
}
