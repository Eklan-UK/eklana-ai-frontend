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

function LineBreakdownBlock({
  row,
  passThreshold,
  lineLabel,
}: {
  row: RoleplayReviewAnalyticsRow;
  passThreshold: number;
  lineLabel: string;
}) {
  const words = row.textScore?.word_score_list ?? [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 mb-1">{lineLabel}</p>
          <p className="text-sm text-gray-900 leading-snug">{row.text}</p>
        </div>
        <div
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
            row.score >= passThreshold ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {row.score.toFixed(0)}%
        </div>
      </div>

      {row.textScore && words.length > 0 ? (
        <div className="space-y-4 pt-1 border-t border-gray-100">
          {words.map((wordScore, widx) => (
            <div key={widx} className="space-y-2">
              <PronunciationWordBreakdown
                wordScore={wordScore}
                variant="review"
                showWordLabel={words.length > 1}
              />
            </div>
          ))}
          <p className="text-xs text-gray-500 pt-1">
            <span className="font-medium text-gray-600">Transcript: </span>
            {transcriptFromTextScore(row.textScore) || "—"}
          </p>
          <p className="text-[11px] text-gray-400">Attempts: {row.attempts}</p>
        </div>
      ) : row.textScore ? (
        <p className="text-xs text-gray-500">No word-level breakdown for this line.</p>
      ) : (
        <p className="text-xs text-amber-700">No detailed score stored for this line.</p>
      )}
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

  const hasData = sceneGroups.length > 0;

  const openIdx =
    !hasData || expandedListIndex < 0
      ? -1
      : Math.min(expandedListIndex, sceneGroups.length - 1);

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
                      onClick={() => setExpandedListIndex(isOpen ? -1 : listIdx)}
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
                      <div className="border-t border-gray-100 px-4 py-3 space-y-4 bg-gray-50/40">
                        <p className="text-xs text-gray-500">Here is a breakdown of your performance</p>
                        <div className="space-y-3">
                          {group.rows.map((row) => (
                            <LineBreakdownBlock
                              key={`${row.sceneIndex}-${row.turnIndex}`}
                              row={row}
                              passThreshold={passThreshold}
                              lineLabel={`Line ${row.turnIndex + 1}`}
                            />
                          ))}
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
