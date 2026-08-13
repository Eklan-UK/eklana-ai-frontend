"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { buildDrillWebPath } from "@/lib/drill-open-url";
import { DRILL_ESTIMATED_DURATION_LABEL } from "@/utils/drill";

const DRILL_TYPE_LABELS: Record<string, string> = {
  roleplay: "Roleplay",
  vocabulary: "Vocabulary/Phrase",
  grammar: "Grammar",
  matching: "Matching",
  definition: "Definition",
  sentence_writing: "Sentence Building",
  fill_blank: "Fill-in-the-Blank",
  key_phrases: "Key Phrases",
  summary: "Reading",
  listening: "Listening",
  sentence: "Sentence",
};

export function ContinuePracticeCard({
  drill,
  isResume,
}: {
  drill: any;
  isResume: boolean;
}) {
  const router = useRouter();
  const drillData = drill.drill;
  if (!drillData) return null;

  const drillId = drillData._id || drill.drillId;
  const assignmentId = drill.assignmentId;
  const drillType = drillData.type || "practice";
  const topicTitle =
    typeof drillData.topicTitle === "string" ? drillData.topicTitle : null;

  return (
    <div className="mb-6">
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-3xl p-5 shadow-lg">
        <div className="inline-flex items-center gap-1.5 bg-emerald-800/50 rounded-full px-3 py-1 mb-3">
          <Play className="w-3 h-3 text-emerald-200 fill-emerald-200" />
          <span className="text-emerald-200 text-xs font-semibold uppercase tracking-wide">
            {isResume ? "Continue Practice" : "Start Practice"}
          </span>
        </div>
        {topicTitle ? (
          <p className="text-sm font-bold text-white line-clamp-2 mb-1">
            {topicTitle}
          </p>
        ) : null}
        <h3 className="text-white text-xl font-bold font-nunito mb-2">{drillData.title}</h3>
        <div className="flex items-center gap-4 mb-4">
          <span className="text-white/80 text-sm capitalize">
            {DRILL_TYPE_LABELS[drillType] || drillType}
          </span>
          <span className="text-white/80 text-sm">{DRILL_ESTIMATED_DURATION_LABEL}</span>
        </div>
        <button
          type="button"
          onClick={() =>
            router.push(buildDrillWebPath(String(drillId), assignmentId))
          }
          className="w-full bg-yellow-400 hover:bg-yellow-300 text-emerald-900 font-semibold text-base py-3.5 rounded-2xl transition-colors"
        >
          {isResume ? "Resume" : "Start"}
        </button>
      </div>
    </div>
  );
}
