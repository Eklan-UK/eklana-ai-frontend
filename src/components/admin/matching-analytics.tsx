"use client";

import React, { useCallback, useMemo, useState } from "react";
import { AlertCircle, Calendar, Clock, Loader2, Shuffle } from "lucide-react";
import { useLearnerMatchingAnalytics } from "@/hooks/useAdmin";

export interface MatchingAnalyticsComponentProps {
  learnerId: string;
  learnerName?: string;
}

export function MatchingAnalyticsComponent({
  learnerId,
}: MatchingAnalyticsComponentProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [appliedRange, setAppliedRange] = useState<{ from?: string; to?: string }>({});

  const rangeForQuery = useMemo(() => {
    const { from, to } = appliedRange;
    if (!from && !to) return undefined;
    return { from, to };
  }, [appliedRange]);

  const { data, isLoading, error } = useLearnerMatchingAnalytics(learnerId, rangeForQuery);

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
      <h2 className="text-lg font-bold text-foreground">Matching Analytics</h2>
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

  const filterPanel = filterOpen ? (
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
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm text-red-800 dark:text-red-200">Failed to load matching analytics</p>
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
          <Shuffle className="mb-2 h-8 w-8 text-muted-foreground opacity-60" aria-hidden />
          <p className="text-sm text-muted-foreground">No matching drill data for this learner yet.</p>
        </div>
      </div>
    );
  }

  const {
    totalAssignedPairs,
    accuracyRatePct,
    totalAttempts,
    confusions,
    fastMatches,
    slowMatches,
    slowestMatchSeconds,
    slowestMatchLabel,
    hasPairTimingData,
    timingAvailableSince,
  } = data;

  const totalSpeed = fastMatches + slowMatches;

  const timingSinceLabel = timingAvailableSince
    ? new Date(timingAvailableSince).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      {headerRow}
      {filterPanel}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-500 bg-blue-900/9 p-5 shadow-sm">
          <p className="font-nunito text-3xl font-bold tabular-nums text-foreground">
            {totalAssignedPairs}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Total Assigned Pairs</p>
        </div>
        <div className="rounded-2xl border border-green-500 bg-green-500/5 p-5 shadow-sm">
          <p className="font-nunito text-3xl font-bold tabular-nums text-foreground">{accuracyRatePct}%</p>
          <p className="mt-1 text-sm text-muted-foreground">Accuracy Rate</p>
        </div>
        <div className="rounded-2xl border border-yellow-500 bg-yellow-500/5 p-5 shadow-sm">
          <p className="font-nunito text-3xl font-bold tabular-nums text-foreground">{totalAttempts}</p>
          <p className="mt-1 text-sm text-muted-foreground">Total Attempts</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
              <h3 className="text-base font-semibold text-foreground">Common Confusions</h3>
            </div>
            {confusions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Patterns the learner struggled to differentiate
              </p>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  Patterns the learner struggled to differentiate
                </p>
                <ul className="space-y-3">
                {confusions.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-red-200/80 bg-red-500/5 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/20"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {row.left} → {row.attemptedMatch}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        Correct: {row.correctRight}
                      </p>
                    </div>
                    <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-red-600 px-2 text-xs font-bold text-white dark:bg-red-500">
                      {row.count}x
                    </span>
                  </li>
                ))}
              </ul>
              </>
            )}
          </div>

          <div>
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
              <h3 className="text-base font-semibold text-foreground">Response Speed Analysis</h3>
            </div>

            <div className="mb-3 flex justify-between text-sm">
              <span className="text-muted-foreground">Fast Matches</span>
              <span className="font-bold tabular-nums text-foreground">{fastMatches}</span>
            </div>
            <div className="mb-4 flex justify-between text-sm">
              <span className="text-muted-foreground">Slow Matches</span>
              <span className="font-bold tabular-nums text-foreground">{slowMatches}</span>
            </div>

            <div
              className="mb-6 h-5 w-full overflow-hidden rounded-full border border-black/10 shadow-sm dark:border-white/15"
              role="img"
              aria-label={
                totalSpeed > 0
                  ? `Response speed: ${fastMatches} fast, ${slowMatches} slow`
                  : "No timing data for speed split"
              }
            >
              {totalSpeed > 0 ? (
                <div className="flex h-full w-full">
                  <div
                    className="min-w-0 bg-green-500 transition-[flex-grow] duration-300 ease-out"
                    style={{ flexGrow: fastMatches, flexShrink: 1, flexBasis: 0 }}
                  />
                  <div
                    className="min-w-0 bg-orange-500 transition-[flex-grow] duration-300 ease-out"
                    style={{ flexGrow: slowMatches, flexShrink: 1, flexBasis: 0 }}
                  />
                </div>
              ) : (
                <div className="h-full w-full bg-muted" />
              )}
            </div>

            {hasPairTimingData && timingSinceLabel ? (
              <p className="mb-4 text-xs text-muted-foreground">
                Earliest attempt with timing in this view: {timingSinceLabel}.
              </p>
            ) : null}

            <div className="rounded-xl border border-amber-200/80 bg-amber-500/10 p-4 dark:border-amber-900/40 dark:bg-amber-950/25">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    Slowest Match
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {slowestMatchLabel ?? "—"}
                  </p>
                </div>
                <p className="font-nunito text-2xl font-bold text-amber-600 tabular-nums dark:text-amber-400">
                  {slowestMatchSeconds != null ? `${slowestMatchSeconds}s` : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
