"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { TextScore } from "@/services/speechace.service";
import { PronunciationWordBreakdown } from "./PronunciationWordBreakdown";
import { transcriptFromTextScore } from "./speechaceTranscript";

export interface RoleplayReviewAnalyticsRow {
  sceneIndex: number;
  turnIndex: number;
  text: string;
  score: number;
  textScore: TextScore | null;
  attempts: number;
}

export interface RoleplayReviewSceneGroup {
  sceneIndex: number;
  sceneTitle: string;
  rows: RoleplayReviewAnalyticsRow[];
}

interface RoleplayPerformanceReviewProps {
  avgScore: number;
  statsLine: string;
  sceneGroups: RoleplayReviewSceneGroup[];
  passThreshold: number;
  onDone: () => void;
  onPracticeAgain: () => void;
  isSubmitting: boolean;
}

const DONUT_SIZE = 176;
const STROKE = 14;
const R = (DONUT_SIZE - STROKE) / 2;
const C = DONUT_SIZE / 2;
const circumference = 2 * Math.PI * R;

function OverallScoreDonut({ score, statsLine }: { score: number; statsLine: string }) {
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="flex flex-col items-center py-2">
      <div className="relative" style={{ width: DONUT_SIZE, height: DONUT_SIZE }}>
        <svg
          width={DONUT_SIZE}
          height={DONUT_SIZE}
          className="-rotate-90"
          viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
          aria-hidden
        >
          <circle cx={C} cy={C} r={R} fill="none" stroke="#e5e7eb" strokeWidth={STROKE} />
          <circle
            cx={C}
            cy={C}
            r={R}
            fill="none"
            stroke="#3B883E"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-0.5">
          <span className="text-4xl font-bold tabular-nums text-gray-900">{Math.round(clamped)}</span>
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-gray-500">Overall Score</p>
      {statsLine ? (
        <p className="mt-1 text-xs text-gray-500 text-center max-w-sm px-2">{statsLine}</p>
      ) : null}
    </div>
  );
}

/** Word-level breakdown, transcript, attempts — shown inside the per-line analysis accordion. */
function LineAnalysisPanel({ row }: { row: RoleplayReviewAnalyticsRow }) {
  const words = row.textScore?.word_score_list ?? [];

  if (row.textScore && words.length > 0) {
    return (
      <div className="space-y-4">
        {words.map((wordScore, widx) => (
          <div key={widx} className="space-y-2">
            <PronunciationWordBreakdown
              wordScore={wordScore}
              variant="review"
              showWordLabel={words.length > 1}
            />
          </div>
        ))}
        <p className="text-xs text-gray-500 pt-1 border-t border-gray-100">
          <span className="font-medium text-gray-600">Transcript: </span>
          {transcriptFromTextScore(row.textScore) || "—"}
        </p>
        <p className="text-[11px] text-gray-400">Attempts: {row.attempts}</p>
      </div>
    );
  }

  if (row.textScore) {
    return <p className="text-xs text-gray-500">No word-level breakdown for this line.</p>;
  }

  return <p className="text-xs text-amber-700">No detailed score stored for this line.</p>;
}

function LineReviewAccordionRow({
  row,
  passThreshold,
  lineLabel,
  isAnalysisOpen,
  onToggleAnalysis,
}: {
  row: RoleplayReviewAnalyticsRow;
  passThreshold: number;
  lineLabel: string;
  isAnalysisOpen: boolean;
  onToggleAnalysis: () => void;
}) {
  const transcript = transcriptFromTextScore(row.textScore)?.trim() ?? "";
  const spokenDisplay = transcript || row.text;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{lineLabel}</p>
        <p className="text-sm text-gray-900 leading-snug whitespace-pre-wrap">{spokenDisplay}</p>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-2.5 bg-gray-50/50">
        <span className="text-sm font-semibold text-gray-800">Performance score</span>
        <div
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
            row.score >= passThreshold ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {row.score.toFixed(0)}%
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleAnalysis}
        aria-expanded={isAnalysisOpen}
        className="flex w-full items-center justify-between gap-2 border-t border-gray-100 px-4 py-2.5 text-left text-sm font-semibold text-emerald-900 hover:bg-emerald-50/50 transition-colors"
      >
        <span>Breakdown of the analysis</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-600 transition-transform ${isAnalysisOpen ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {isAnalysisOpen ? (
        <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3">
          <LineAnalysisPanel row={row} />
        </div>
      ) : null}
    </div>
  );
}

export function RoleplayPerformanceReview({
  avgScore,
  statsLine,
  sceneGroups,
  passThreshold,
  onDone,
  onPracticeAgain,
  isSubmitting,
}: RoleplayPerformanceReviewProps) {
  const [expandedListIndex, setExpandedListIndex] = useState(0);
  const [expandedLineKey, setExpandedLineKey] = useState<string | null>(null);

  const hasData = sceneGroups.length > 0;

  const openIdx =
    !hasData || expandedListIndex < 0
      ? -1
      : Math.min(expandedListIndex, sceneGroups.length - 1);

  const toggleScene = (listIdx: number, isOpen: boolean) => {
    setExpandedListIndex(isOpen ? -1 : listIdx);
    setExpandedLineKey(null);
  };

  return (
    <>
      <div className="pb-40 max-w-md mx-auto w-full">
        {hasData ? (
          <OverallScoreDonut score={avgScore} statsLine={statsLine} />
        ) : (
          <div className="text-center py-8 px-4">
            <p className="text-sm text-gray-600 mb-2">No pronunciation breakdown yet</p>
            <p className="text-xs text-gray-500">
              Complete your spoken lines with a successful analysis to see scores here.
            </p>
          </div>
        )}

        {hasData && (
          <>
            <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">Scene-by-Scene Analysis</h2>
            <div className="space-y-2">
              {sceneGroups.map((group, listIdx) => {
                const isOpen = openIdx === listIdx;
                return (
                  <div
                    key={group.sceneIndex}
                    className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => toggleScene(listIdx, isOpen)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50/80 transition-colors"
                      aria-expanded={isOpen}
                    >
                      <div>
                        <span className="font-bold text-gray-900">{group.sceneTitle}</span>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50/40">
                        <h3 className="text-sm font-bold text-gray-900">
                          Here is a Breakdown of your performance
                        </h3>
                        <div className="space-y-3">
                          {group.rows.map((row) => {
                            const lineKey = `${row.sceneIndex}-${row.turnIndex}`;
                            const isLineAnalysisOpen = expandedLineKey === lineKey;
                            return (
                              <LineReviewAccordionRow
                                key={lineKey}
                                row={row}
                                passThreshold={passThreshold}
                                lineLabel={`Line ${row.turnIndex + 1}`}
                                isAnalysisOpen={isLineAnalysisOpen}
                                onToggleAnalysis={() =>
                                  setExpandedLineKey((k) => (k === lineKey ? null : lineKey))
                                }
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="max-w-md mx-auto w-full px-4 space-y-2.5">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="!rounded-full"
            onClick={onDone}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                Done for today
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="lg"
            fullWidth
            disabled={isSubmitting}
            onClick={onPracticeAgain}
            className="!rounded-full border-[#3B883E] text-[#3B883E] hover:bg-emerald-50/80"
          >
            Practice again
          </Button>
        </div>
      </div>
    </>
  );
}
