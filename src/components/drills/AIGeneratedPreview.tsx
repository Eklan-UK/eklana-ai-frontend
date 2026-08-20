"use client";

import React from "react";
import { ArrowRight, Download, Settings2 } from "lucide-react";
import { AI_DRILL_TYPES } from "@/constants/ai-drill";

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

function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">{title}</h4>
      <div className="text-sm text-gray-800 space-y-2">{children}</div>
    </div>
  );
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

function renderContentForType(
  drillType: string,
  content: Record<string, unknown>,
): React.ReactNode {
  switch (drillType) {
    case "vocabulary": {
      const items = (content.target_sentences as Record<string, string>[]) ?? [];
      return (
        <PreviewSection title={`Vocabulary — ${items.length} items`}>
          {items.map((item, i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p>
                <span className="font-semibold">{item.word}</span>
                {item.wordTranslation && (
                  <span className="text-gray-500"> — {item.wordTranslation}</span>
                )}
              </p>
              <p className="mt-1">{item.text}</p>
              {item.translation && (
                <p className="text-gray-500 text-xs mt-1">{item.translation}</p>
              )}
            </div>
          ))}
        </PreviewSection>
      );
    }
    case "pronunciation": {
      const items = (content.pronunciation_items as Record<string, string>[]) ?? [];
      return (
        <PreviewSection title={`Pronunciation — ${items.length} items`}>
          {items.map((item, i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p>
                <span className="font-semibold">{item.sound}</span> — {item.word}
              </p>
              <p className="mt-1 text-gray-600">{item.sentence}</p>
            </div>
          ))}
        </PreviewSection>
      );
    }
    case "roleplay": {
      const scenes = (content.roleplay_scenes as Record<string, unknown>[]) ?? [];
      return (
        <>
          <PreviewSection title="Characters">
            <p>Student: {String(content.student_character_name ?? "—")}</p>
            <p>
              AI:{" "}
              {((content.ai_character_names as string[]) ?? []).join(", ") || "—"}
            </p>
            {Boolean(content.drill_intro) && (
              <p className="text-gray-600">{String(content.drill_intro)}</p>
            )}
          </PreviewSection>
          <PreviewSection title={`Scenes (${scenes.length})`}>
            {scenes.map((scene, i) => {
              const dialogue = (scene.dialogue as Record<string, string>[]) ?? [];
              return (
                <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="font-semibold">{String(scene.scene_name ?? `Scene ${i + 1}`)}</p>
                  {Boolean(scene.context) && (
                    <p className="text-xs text-gray-500 mb-2">{String(scene.context)}</p>
                  )}
                  {dialogue.map((turn, j) => (
                    <p key={j} className="text-sm">
                      <span className="font-medium capitalize">{turn.speaker}:</span>{" "}
                      {turn.text}
                    </p>
                  ))}
                </div>
              );
            })}
          </PreviewSection>
        </>
      );
    }
    case "matching": {
      const pairs = (content.matching_pairs as Record<string, string>[]) ?? [];
      return (
        <PreviewSection title={`Matching — ${pairs.length} pairs`}>
          {pairs.map((pair, i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex gap-4">
              <span>{pair.left}</span>
              <span className="text-gray-400">↔</span>
              <span>{pair.right}</span>
            </div>
          ))}
        </PreviewSection>
      );
    }
    case "grammar": {
      const items = (content.grammar_items as Record<string, string>[]) ?? [];
      return (
        <PreviewSection title={`Grammar — ${items.length} patterns`}>
          {items.map((item, i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="font-semibold">{item.pattern}</p>
              <p className="mt-1">{item.example}</p>
              {item.hint && <p className="text-xs text-gray-500 mt-1">{item.hint}</p>}
            </div>
          ))}
        </PreviewSection>
      );
    }
    case "sentence_writing": {
      const items = (content.sentence_writing_items as Record<string, string>[]) ?? [];
      return (
        <PreviewSection title={`Sentence Writing — ${items.length} words`}>
          {items.map((item, i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="font-semibold">{item.word}</span>
              {item.hint && <span className="text-gray-500 ml-2">({item.hint})</span>}
            </div>
          ))}
        </PreviewSection>
      );
    }
    case "fill_blank": {
      const items = (content.fill_blank_items as Record<string, unknown>[]) ?? [];
      return (
        <PreviewSection title={`Fill in the Blank — ${items.length} sentences`}>
          {items.map((item, i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              {Boolean(item.context) && (
                <p className="text-sm text-gray-600 mb-2">{String(item.context)}</p>
              )}
              <p>{String(item.sentence ?? "")}</p>
              {Boolean(item.translation) && (
                <p className="text-xs text-gray-500 mt-1">{String(item.translation)}</p>
              )}
            </div>
          ))}
        </PreviewSection>
      );
    }
    case "key_phrases": {
      const items = (content.key_phrase_items as Record<string, unknown>[]) ?? [];
      return (
        <PreviewSection title={`Scenario/Pressure Test — ${items.length} questions`}>
          {items.map((item, i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              {Boolean(String(item.context ?? "").trim()) && (
                <p className="text-sm text-gray-600 mb-2">{String(item.context)}</p>
              )}
              <p className="font-semibold">{String(item.prompt ?? "")}</p>
              <p className="text-xs text-gray-500 mt-1">
                Options: {((item.options as string[]) ?? []).join(" | ")}
              </p>
              <p className="text-xs text-emerald-700 mt-1">
                Answer: {String(item.correctAnswer ?? "")}
              </p>
            </div>
          ))}
        </PreviewSection>
      );
    }
    case "summary":
      return (
        <PreviewSection title="Summary — Article">
          <p className="font-semibold text-base">{String(content.article_title ?? "")}</p>
          <p className="mt-2 whitespace-pre-wrap line-clamp-6">
            {String(content.article_content ?? "")}
          </p>
        </PreviewSection>
      );
    case "definition": {
      const items = (content.definition_items as Record<string, string>[]) ?? [];
      return (
        <PreviewSection title={`Definition — ${items.length} items`}>
          {items.map((item, i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="font-semibold">{item.word}</span>
              {item.hint && <span className="text-gray-500 ml-2">— {item.hint}</span>}
            </div>
          ))}
          <p className="text-xs text-amber-600 mt-2">
            Note: Definition drills are not yet supported in the manual builder.
          </p>
        </PreviewSection>
      );
    }
    default:
      return (
        <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-auto max-h-64">
          {JSON.stringify(content, null, 2)}
        </pre>
      );
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

      <div className="max-h-96 overflow-y-auto mb-6 space-y-6">
        {results.map(({ drillType, content }, idx) => (
          <div
            key={`${drillType}-${idx}`}
            className={idx > 0 ? "pt-4 border-t border-gray-100" : ""}
          >
            {renderContentForType(drillType, content)}
          </div>
        ))}
      </div>

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
