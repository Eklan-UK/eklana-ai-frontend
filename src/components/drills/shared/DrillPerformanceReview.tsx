"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useDrillScoreCelebration } from "@/hooks/useDrillScoreCelebration";
import type { TextScore } from "@/services/speechace.service";
import { PronunciationWordBreakdown } from "./PronunciationWordBreakdown";
import { transcriptFromTextScore } from "./speechaceTranscript";
import {
  drillContentWidthClasses,
  type DrillContentWidth,
} from "@/components/drills/shared/drill-content-width";

/** Row for review accordions (roleplay: scene/turn; vocab/pron: item index / line index). */
export interface PerformanceReviewAnalyticsRow {
  sceneIndex: number;
  turnIndex: number;
  text: string;
  score: number;
  textScore: TextScore | null;
  attempts: number;
}

export interface PerformanceReviewGroup {
  sceneIndex: number;
  sceneTitle: string;
  rows: PerformanceReviewAnalyticsRow[];
}

export interface DrillPerformanceReviewProps {
  avgScore: number;
  statsLine: string;
  groups: PerformanceReviewGroup[];
  passThreshold: number;
  sectionHeading: string;
  /** Default `student`: submit + practice again. `viewer`: single Close (admin/tutor replay). */
  viewMode?: "student" | "viewer";
  onClose?: () => void;
  onDone: () => void;
  onPracticeAgain: () => void;
  isSubmitting: boolean;
  /** Match DrillLayout maxWidth so review uses full drill column. */
  contentWidth?: DrillContentWidth;
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
          <span className="text-4xl font-bold tabular-nums text-foreground">{Math.round(clamped)}</span>
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-muted-foreground">Overall Score</p>
      {statsLine ? (
        <p className="mt-1 text-xs text-muted-foreground text-center max-w-sm px-2">{statsLine}</p>
      ) : null}
    </div>
  );
}

function LineAnalysisPanel({ row }: { row: PerformanceReviewAnalyticsRow }) {
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
        <p className="text-xs text-muted-foreground pt-1 border-t border-border">
          <span className="font-medium text-muted-foreground">Transcript: </span>
          {transcriptFromTextScore(row.textScore) || "—"}
        </p>
        <p className="text-[11px] text-muted-foreground">Attempts: {row.attempts}</p>
      </div>
    );
  }

  if (row.textScore) {
    return <p className="text-xs text-muted-foreground">No word-level breakdown for this line.</p>;
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
  row: PerformanceReviewAnalyticsRow;
  passThreshold: number;
  lineLabel: string;
  isAnalysisOpen: boolean;
  onToggleAnalysis: () => void;
}) {
  const transcript = transcriptFromTextScore(row.textScore)?.trim() ?? "";
  const spokenDisplay = transcript || row.text;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{lineLabel}</p>
        <p className="text-sm text-foreground leading-snug whitespace-pre-wrap">{spokenDisplay}</p>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 bg-muted/50">
        <span className="text-sm font-semibold text-foreground">Clarity score</span>
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
        className="flex w-full items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-left text-sm font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/15 transition-colors"
      >
        <span>Breakdown of the analysis</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isAnalysisOpen ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {isAnalysisOpen ? (
        <div className="border-t border-border bg-muted/60 px-4 py-3">
          <LineAnalysisPanel row={row} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Single-line review accordion for use inside vocabulary / pronunciation drills
 * (mirrors “Breakdown of the analysis” on the end-of-drill review screen).
 * Remount with a new `key` when the attempt changes. Breakdown starts collapsed so the
 * student opens it when they want.
 */
export function DrillLineReviewAccordion({
  row,
  passThreshold,
  lineLabel,
}: {
  row: PerformanceReviewAnalyticsRow;
  passThreshold: number;
  lineLabel: string;
}) {
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);

  return (
    <LineReviewAccordionRow
      row={row}
      passThreshold={passThreshold}
      lineLabel={lineLabel}
      isAnalysisOpen={isAnalysisOpen}
      onToggleAnalysis={() => setIsAnalysisOpen((v) => !v)}
    />
  );
}

export function DrillPerformanceReview({
  avgScore,
  statsLine,
  groups,
  passThreshold,
  sectionHeading,
  viewMode = "student",
  onClose,
  onDone,
  onPracticeAgain,
  isSubmitting,
  contentWidth = "md",
}: DrillPerformanceReviewProps) {
  const widthClass = drillContentWidthClasses[contentWidth];
  const isViewer = viewMode === "viewer";
  const [expandedListIndex, setExpandedListIndex] = useState(-1);
  const [expandedLineKey, setExpandedLineKey] = useState<string | null>(null);

  const hasData = groups.length > 0;

  useDrillScoreCelebration(
    isViewer || !hasData ? null : avgScore >= passThreshold,
    undefined,
    avgScore,
  );

  const openIdx =
    !hasData || expandedListIndex < 0
      ? -1
      : Math.min(expandedListIndex, groups.length - 1);

  const toggleScene = (listIdx: number, isOpen: boolean) => {
    setExpandedListIndex(isOpen ? -1 : listIdx);
    setExpandedLineKey(null);
  };

  return (
    <>
      {isSubmitting && !isViewer ? (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-background/85 backdrop-blur-sm"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">Saving your results…</p>
        </div>
      ) : null}
      <div className={`${isViewer ? "pb-6" : "pb-40"} ${widthClass}`}>
        {hasData ? (
          <OverallScoreDonut score={avgScore} statsLine={statsLine} />
        ) : (
          <div className="text-center py-8 px-4">
            <p className="text-sm text-muted-foreground mb-2">
              {isViewer ? "No performance data in this snapshot." : "No pronunciation breakdown yet"}
            </p>
            {!isViewer ? (
              <p className="text-xs text-muted-foreground">
                Complete your spoken lines with a successful analysis to see scores here.
              </p>
            ) : null}
          </div>
        )}

        {hasData && (
          <>
            <h2 className="text-lg font-bold text-foreground mt-8 mb-3">{sectionHeading}</h2>
            <div className="space-y-2">
              {groups.map((group, listIdx) => {
                const isOpen = openIdx === listIdx;
                return (
                  <div
                    key={group.sceneIndex}
                    className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => toggleScene(listIdx, isOpen)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/80 transition-colors"
                      aria-expanded={isOpen}
                    >
                      <div>
                        <span className="font-bold text-foreground">{group.sceneTitle}</span>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/40">
                        <h3 className="text-sm font-bold text-foreground">
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

      {isViewer ? (
        <div className="border-t border-border bg-card px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className={widthClass}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="!rounded-full"
              type="button"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className={`${widthClass} px-4 md:px-8 space-y-2.5`}>
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
                <>Done for today</>
              )}
            </Button>
            <Button
              variant="outline"
              size="lg"
              fullWidth
              disabled={isSubmitting}
              onClick={onPracticeAgain}
              className="!rounded-full border-[#3B883E] text-[#3B883E] hover:bg-emerald-500/15 dark:hover:bg-emerald-500/20"
            >
              Practice again
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
