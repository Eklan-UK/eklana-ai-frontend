"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Calendar, Loader2, BookOpen } from "lucide-react";
import { useLearnerSentenceAnalytics } from "@/hooks/useAdmin";

export interface SentenceAnalyticsComponentProps {
  learnerId: string;
  learnerName?: string;
}

export function SentenceAnalyticsComponent({
  learnerId,
}: SentenceAnalyticsComponentProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [appliedRange, setAppliedRange] = useState<{ from?: string; to?: string }>({});

  const rangeForQuery = useMemo(() => {
    const { from, to } = appliedRange;
    if (!from && !to) return undefined;
    return { from, to };
  }, [appliedRange]);

  const { data, isLoading, error } = useLearnerSentenceAnalytics(learnerId, rangeForQuery);

  const applyFilter = useCallback(() => {
    setAppliedRange({
      from: draftFrom || undefined,
      to: draftTo || undefined,
    });
    setFilterOpen(false);
  }, [draftFrom, draftTo]);

  const clearFilter = useCallback(() => {
    setDraftFrom("");
    setDraftTo("");
    setAppliedRange({});
  }, []);

  const headerRow = (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-lg font-bold text-foreground">Sentence Analytics</h2>
      <button
        type="button"
        onClick={() => setFilterOpen((o) => !o)}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
      >
        <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden />
        Filter by date
        {(appliedRange.from || appliedRange.to) && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
            Active
          </span>
        )}
      </button>
    </div>
  );

  const dateFilterPanel = filterOpen ? (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        From
        <input
          type="date"
          value={draftFrom}
          onChange={(e) => setDraftFrom(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        To
        <input
          type="date"
          value={draftTo}
          onChange={(e) => setDraftTo(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={applyFilter}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={clearFilter}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground"
        >
          Clear
        </button>
      </div>
    </div>
  ) : null;

  if (isLoading) {
    return (
      <div>
        {headerRow}
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {headerRow}
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">Failed to load sentence analytics</p>
        </div>
      </div>
    );
  }

  if (!data || (data.attemptsConsidered === 0 && data.totalAssignedTargets === 0)) {
    return (
      <div className="space-y-4">
        {headerRow}
        {dateFilterPanel}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-muted/30 py-12 text-center">
          <BookOpen className="mb-2 h-8 w-8 text-muted-foreground opacity-60" aria-hidden />
          <p className="text-sm text-muted-foreground">No sentence drill data for this learner yet.</p>
        </div>
      </div>
    );
  }

  const {
    totalAssignedTargets,
    correctSentence,
    incorrectSentence,
    problemRows,
    feedbackRows,
    hasReviewedData,
  } = data;

  return (
    <div className="space-y-6">
      {headerRow}

      {dateFilterPanel}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-500 bg-blue-900/9 p-5 shadow-sm">
          <p className="font-nunito text-3xl font-bold tabular-nums text-foreground">
            {totalAssignedTargets}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Total Assigned Target</p>
        </div>
        <div className="rounded-2xl border border-green-500 bg-green-500/5 p-5 shadow-sm">
          <p className="font-nunito text-3xl font-bold tabular-nums text-foreground">{correctSentence}</p>
          <p className="mt-1 text-sm text-muted-foreground">Correct sentence</p>
        </div>
        <div className="rounded-2xl border border-yellow-500 bg-yellow-500/5 p-5 shadow-sm">
          <p className="font-nunito text-3xl font-bold tabular-nums text-foreground">{incorrectSentence}</p>
          <p className="mt-1 text-sm text-muted-foreground">Incorrect sentence</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
        <h4 className="mb-5 text-base font-bold text-foreground">Problem Areas breakdown</h4>

        {!hasReviewedData && (
          <p className="mb-4 text-sm text-muted-foreground">
            Breakdown appears once sentence submissions are reviewed. Totals above include all
            sentence-writing attempts with targets assigned.
          </p>
        )}

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <p className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground">
              Problem Area(s)
            </p>
            <ul className="space-y-6">
              {problemRows.length === 0 ? (
                <li className="text-sm text-muted-foreground">No incorrect sentences in reviewed data.</li>
              ) : (
                problemRows.map((row) => (
                  <li key={row.id} className="border-b border-border pb-6 last:border-0 last:pb-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">{row.areaLabel}</span>
                      <span className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full bg-red-500/15 px-2 text-xs font-bold text-red-600">
                        {row.count}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-foreground">{row.sentence}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <p className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground">Your feedback</p>
            <ul className="space-y-6">
              {feedbackRows.length === 0 ? (
                <li className="text-sm text-muted-foreground">No feedback rows yet.</li>
              ) : (
                feedbackRows.map((row) => (
                  <li key={row.id} className="border-b border-border pb-6 last:border-0 last:pb-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">{row.label}</span>
                      <span className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full bg-primary/15 px-2 text-xs font-bold text-primary">
                        {row.count}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-foreground">{row.sentence}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
