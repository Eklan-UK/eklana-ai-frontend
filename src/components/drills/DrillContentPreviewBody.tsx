"use client";

import React from "react";

export interface DrillContentPreviewResult {
  drillType: string;
  content: Record<string, unknown>;
}

interface DrillContentPreviewBodyProps {
  results: DrillContentPreviewResult[];
  className?: string;
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

export const DrillContentPreviewBody: React.FC<DrillContentPreviewBodyProps> = ({
  results,
  className = "max-h-96 overflow-y-auto mb-6 space-y-6",
}) => {
  return (
    <div className={className}>
      {results.map(({ drillType, content }, idx) => (
        <div
          key={`${drillType}-${idx}`}
          className={idx > 0 ? "pt-4 border-t border-gray-100" : ""}
        >
          {renderContentForType(drillType, content)}
        </div>
      ))}
    </div>
  );
};
