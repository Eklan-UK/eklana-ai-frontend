"use client";

import React from "react";
import { ArrowRight, Download, Settings2 } from "lucide-react";
import { AI_DRILL_TYPES } from "@/constants/ai-drill";
import { DrillContentPreviewBody } from "@/components/drills/DrillContentPreviewBody";

export interface AIGeneratedResultLike {
  drillType: string;
  content: Record<string, unknown>;
}

interface AIGeneratedPreviewProps {
  results: AIGeneratedResultLike[];
  onUseDrills: () => void;
  onEditSettings?: () => void;
}

function getDrillTypeLabel(drillType: string): string {
  return AI_DRILL_TYPES.find((t) => t.value === drillType)?.label ?? drillType;
}

function buildExcelRows(drillType: string, content: Record<string, unknown>): unknown[][] {
  switch (drillType) {
    case "vocabulary": {
      const items = (content.target_sentences as Record<string, string>[]) ?? [];
      return [
        ["Word", "Word Translation", "Sentence", "Sentence Translation"],
        ...items.map((item) => [item.word ?? "", item.wordTranslation ?? "", item.text ?? "", item.translation ?? ""]),
      ];
    }
    case "pronunciation": {
      const items = (content.pronunciation_items as Record<string, string>[]) ?? [];
      return [
        ["Sound", "Word", "Sentence"],
        ...items.map((item) => [item.sound ?? "", item.word ?? "", item.sentence ?? ""]),
      ];
    }
    case "matching": {
      const pairs = (content.matching_pairs as Record<string, string>[]) ?? [];
      return [
        ["Left", "Right", "Left Translation", "Right Translation"],
        ...pairs.map((pair) => [pair.left ?? "", pair.right ?? "", pair.leftTranslation ?? "", pair.rightTranslation ?? ""]),
      ];
    }
    case "roleplay": {
      const scenes = (content.roleplay_scenes as Record<string, unknown>[]) ?? [];
      const rows: unknown[][] = [
        ["student_character", String(content.student_character_name ?? "Student")],
        ["ai_character", ((content.ai_character_names as string[]) ?? []).join(", ")],
        ["drill_intro", String(content.drill_intro ?? "")],
      ];
      scenes.forEach((scene) => {
        rows.push(["context", String(scene.context ?? scene.scene_name ?? "")]);
        rows.push(["Speaker", "Text", "Translation"]);
        const dialogue = (scene.dialogue as Record<string, string>[]) ?? [];
        dialogue.forEach((turn) => rows.push([turn.speaker ?? "", turn.text ?? "", turn.translation ?? ""]));
      });
      return rows;
    }
    case "definition": {
      const items = (content.definition_items as Record<string, string>[]) ?? [];
      return [
        ["Word", "Hint/Definition"],
        ...items.map((item) => [item.word ?? "", item.hint ?? ""]),
      ];
    }
    case "grammar": {
      const items = (content.grammar_items as Record<string, string>[]) ?? [];
      return [
        ["Pattern", "Hint", "Example"],
        ...items.map((item) => [item.pattern ?? "", item.hint ?? "", item.example ?? ""]),
      ];
    }
    case "sentence_writing": {
      const items = (content.sentence_writing_items as Record<string, string>[]) ?? [];
      return [
        ["Word", "Hint"],
        ...items.map((item) => [item.word ?? "", item.hint ?? ""]),
      ];
    }
    case "key_phrases": {
      const items = (content.key_phrase_items as Record<string, unknown>[]) ?? [];
      return [
        ["Context", "Prompt", "Correct Answer", "Option 2", "Option 3"],
        ...items.map((item) => {
          const opts = (item.options as string[]) ?? [];
          const distractors = opts.filter((o) => o !== item.correctAnswer);
          return [
            String(item.context ?? ""),
            String(item.prompt ?? ""),
            String(item.correctAnswer ?? ""),
            distractors[0] ?? "",
            distractors[1] ?? "",
          ];
        }),
      ];
    }
    case "fill_blank": {
      const items = (content.fill_blank_items as Record<string, unknown>[]) ?? [];
      return [
        ["Context", "Sentence", "Correct Answer", "Option 2", "Option 3", "Hint"],
        ...items.map((item) => {
          const blanks = (item.blanks as Array<{ correctAnswer?: string; options?: string[]; hint?: string }>) ?? [];
          const blank = blanks[0];
          const opts = blank?.options ?? [];
          const distractors = opts.filter((o) => o !== blank?.correctAnswer);
          return [
            String(item.context ?? ""),
            String(item.sentence ?? ""),
            String(blank?.correctAnswer ?? ""),
            distractors[0] ?? "",
            distractors[1] ?? "",
            String(blank?.hint ?? ""),
          ];
        }),
      ];
    }
    case "summary":
      return [
        ["Article Title", "Article Content"],
        [String(content.article_title ?? ""), String(content.article_content ?? "")],
      ];
    case "listening":
      return [
        ["Content Title", "Content"],
        [String(content.content_title ?? content.article_title ?? ""), String(content.content ?? content.article_content ?? "")],
      ];
    default:
      return [["Data"], [JSON.stringify(content)]];
  }
}

export const AIGeneratedPreview: React.FC<AIGeneratedPreviewProps> = ({
  results,
  onUseDrills,
  onEditSettings,
}) => {
  const handleExport = () => {
    import("xlsx").then((XLSX) => {
      const workbook = XLSX.utils.book_new();
      const usedSheetNames = new Set<string>();
      results.forEach(({ drillType, content }) => {
        const rows = buildExcelRows(drillType, content);
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        let sheetName = getDrillTypeLabel(drillType).slice(0, 31) || drillType.slice(0, 31);
        let suffix = 2;
        while (usedSheetNames.has(sheetName)) {
          const base = getDrillTypeLabel(drillType).slice(0, 28);
          sheetName = `${base} (${suffix})`;
          suffix += 1;
        }
        usedSheetNames.add(sheetName);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });
      const fileNameSuffix =
        results.length === 1 ? results[0].drillType : "multi-drill";
      XLSX.writeFile(workbook, `${fileNameSuffix}-generated.xlsx`);
    });
  };

  return (
    <div className="bg-white rounded-3xl border border-emerald-100 p-8 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900 mb-1">Generated Content</h3>
      <p className="text-sm text-gray-500 mb-6">
        Review the AI-generated content below. Use the chat sidebar to refine, or
        apply it to the drill builder.
      </p>

      <DrillContentPreviewBody results={results} />

      <div className="flex gap-3">
        {onEditSettings && (
          <button
            type="button"
            onClick={onEditSettings}
            className="py-3 px-4 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Settings2 className="w-4 h-4" />
            Edit settings
          </button>
        )}
        <button
          type="button"
          onClick={handleExport}
          className="py-3 px-4 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export as Excel
        </button>
        <button
          type="button"
          onClick={onUseDrills}
          className="flex-1 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
        >
          Use These Drills
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
