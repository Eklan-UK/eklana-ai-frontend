"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Calendar, Loader2, MessageSquareQuote } from "lucide-react";
import { useAnalyticsDashboard, useLearnerKeyPhrasesAnalytics } from "@/hooks/useAdmin";

export interface KeyPhrasesAnalyticsComponentProps {
  learnerId?: string;
  learnerName?: string;
  learnerIds?: string[];
}

export function KeyPhrasesAnalyticsComponent({
  learnerId,
  learnerIds,
}: KeyPhrasesAnalyticsComponentProps) {
  const useAggregated =
    learnerIds !== undefined ? learnerIds.length !== 1 : false;
  const effectiveLearnerId =
    learnerIds?.length === 1 ? learnerIds[0] : learnerId ?? "";
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [appliedRange, setAppliedRange] = useState<{ from?: string; to?: string }>({});

  const rangeForQuery = useMemo(() => {
    const { from, to } = appliedRange;
    if (!from && !to) return undefined;
    return { from, to };
  }, [appliedRange]);

  const { data: learnerData, isLoading: learnerLoading, error: learnerError } =
    useLearnerKeyPhrasesAnalytics(effectiveLearnerId, rangeForQuery);

  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    error: dashboardError,
  } = useAnalyticsDashboard(learnerIds, 30, useAggregated);

  const data = useAggregated ? dashboardData?.keyPhrases ?? null : learnerData;

  const isLoading = useAggregated ? dashboardLoading : learnerLoading;
  const error = useAggregated ? dashboardError : learnerError;

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
      <h2 className="text-lg font-bold text-foreground">Key Phrase Analytics</h2>
      {!useAggregated && (
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
      )}
    </div>
  );

  const filterPanel = !useAggregated && filterOpen ? (
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
          <p className="text-sm text-red-800">Failed to load key phrase analytics</p>
        </div>
      </div>
    );
  }

  if (!data || data.totalAttempts === 0) {
    return (
      <div className="space-y-4">
        {headerRow}
        {filterPanel}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-muted/30 py-12 text-center">
          <MessageSquareQuote className="mb-2 h-8 w-8 text-muted-foreground opacity-60" aria-hidden />
          <p className="text-sm text-muted-foreground">No key phrase drill data for this learner yet.</p>
        </div>
      </div>
    );
  }

  const {
    totalAssignedItems,
    correctItems,
    accuracyRatePct,
    totalAttempts,
    averageScore,
    averagePronunciationScore,
  } = data;

  return (
    <div className="space-y-6">
      {headerRow}
      {filterPanel}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-blue-500 bg-blue-900/9 p-5 shadow-sm">
          <p className="font-nunito text-3xl font-bold tabular-nums text-foreground">
            {totalAssignedItems}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Total Items</p>
        </div>
        <div className="rounded-2xl border border-green-500 bg-green-500/5 p-5 shadow-sm">
          <p className="font-nunito text-3xl font-bold tabular-nums text-foreground">
            {correctItems}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Correct Items</p>
        </div>
        <div className="rounded-2xl border border-yellow-500 bg-yellow-500/5 p-5 shadow-sm">
          <p className="font-nunito text-3xl font-bold tabular-nums text-foreground">
            {accuracyRatePct}%
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Accuracy Rate</p>
        </div>
        <div className="rounded-2xl border border-purple-500 bg-purple-500/5 p-5 shadow-sm">
          <p className="font-nunito text-3xl font-bold tabular-nums text-foreground">
            {averageScore}%
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Avg Score</p>
        </div>
        <div className="rounded-2xl border border-cyan-500 bg-cyan-500/5 p-5 shadow-sm">
          <p className="font-nunito text-3xl font-bold tabular-nums text-foreground">
            {averagePronunciationScore > 0 ? `${averagePronunciationScore}%` : "—"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Avg Pronunciation</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Based on {totalAttempts} completed key phrase drill{totalAttempts === 1 ? "" : "s"}.
      </p>
    </div>
  );
}
