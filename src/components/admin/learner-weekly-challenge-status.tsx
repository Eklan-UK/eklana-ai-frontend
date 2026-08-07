"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Trophy,
  CheckCircle2,
  Clock,
  Zap,
  AlertCircle,
  FileText,
} from "lucide-react";
import { useLearnerWeeklyChallenges } from "@/hooks/useAdmin";

type ProgressStatus = "pending" | "in_progress" | "completed" | "not_available";
type FilterStatus = "all" | "pending" | "in_progress" | "completed";

interface LearnerWeeklyChallengeStatusProps {
  learnerId: string;
  learnerName?: string;
}

function formatWeekLabel(weekStartDate: string, weekNumber?: number) {
  try {
    const date = new Date(weekStartDate).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    if (weekNumber && weekNumber > 0) {
      return `Week ${weekNumber} · starting ${date}`;
    }
    return `Week starting ${date}`;
  } catch {
    return weekNumber && weekNumber > 0
      ? `Week ${weekNumber}`
      : "Weekly challenge";
  }
}

function getStatusBadge(status: ProgressStatus) {
  switch (status) {
    case "pending":
      return (
        <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
          <Clock className="w-3 h-3" /> Pending
        </span>
      );
    case "in_progress":
      return (
        <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
          <Zap className="w-3 h-3" /> In Progress
        </span>
      );
    case "completed":
      return (
        <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
          <CheckCircle2 className="w-3 h-3" /> Completed
        </span>
      );
    case "not_available":
      return (
        <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
          <AlertCircle className="w-3 h-3" /> Not Available
        </span>
      );
    default:
      return null;
  }
}

/**
 * Staff-facing Weekly Challenge progress card.
 * Mirrors Assigned Drills filters/badges; read-only (no practice links).
 */
export function LearnerWeeklyChallengeStatus({
  learnerId,
  learnerName = "Learner",
}: LearnerWeeklyChallengeStatusProps) {
  const { data, isLoading, error } = useLearnerWeeklyChallenges(learnerId);
  const challenges = data?.challenges ?? [];
  const statistics = data?.statistics;

  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const categorized = useMemo(
    () => ({
      pending: challenges.filter((c) => c.status === "pending"),
      inProgress: challenges.filter((c) => c.status === "in_progress"),
      completed: challenges.filter((c) => c.status === "completed"),
      notAvailable: challenges.filter((c) => c.status === "not_available"),
    }),
    [challenges],
  );

  const filtered = useMemo(() => {
    switch (filterStatus) {
      case "pending":
        return categorized.pending;
      case "in_progress":
        return categorized.inProgress;
      case "completed":
        return categorized.completed;
      default:
        return challenges;
    }
  }, [filterStatus, categorized, challenges]);

  const handleFilterChange = useCallback((status: FilterStatus) => {
    setFilterStatus(status);
  }, []);

  const handleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 text-sm">Failed to load weekly challenges</p>
      </div>
    );
  }

  if (!challenges.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No weekly challenges yet for {learnerName}</p>
      </div>
    );
  }

  const pendingCount = statistics?.pending ?? categorized.pending.length;
  const inProgressCount = statistics?.inProgress ?? categorized.inProgress.length;
  const completedCount = statistics?.completed ?? categorized.completed.length;
  const totalCount = statistics?.total ?? challenges.length;

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => handleFilterChange("all")}
          className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
            filterStatus === "all"
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          All ({totalCount})
        </button>
        <button
          type="button"
          onClick={() => handleFilterChange("pending")}
          className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
            filterStatus === "pending"
              ? "bg-gray-200 text-gray-800"
              : "bg-gray-50 text-gray-700 hover:bg-gray-100"
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          type="button"
          onClick={() => handleFilterChange("in_progress")}
          className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
            filterStatus === "in_progress"
              ? "bg-indigo-100 text-indigo-700"
              : "bg-gray-50 text-gray-700 hover:bg-gray-100"
          }`}
        >
          In Progress ({inProgressCount})
        </button>
        <button
          type="button"
          onClick={() => handleFilterChange("completed")}
          className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
            filterStatus === "completed"
              ? "bg-green-100 text-green-700"
              : "bg-gray-50 text-gray-700 hover:bg-gray-100"
          }`}
        >
          Completed ({completedCount})
        </button>
      </div>

      {/* Summary */}
      {(completedCount > 0 || inProgressCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-linear-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">
              Completed
            </p>
            <p className="text-3xl font-bold text-green-600">{completedCount}</p>
            <p className="text-xs text-gray-600 mt-1">of {totalCount} weeks</p>
          </div>
          <div className="bg-linear-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">
              In Progress
            </p>
            <p className="text-3xl font-bold text-blue-600">{inProgressCount}</p>
          </div>
          <div className="bg-linear-to-br from-gray-50 to-slate-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">
              Pending
            </p>
            <p className="text-3xl font-bold text-gray-700">{pendingCount}</p>
          </div>
        </div>
      )}

      {/* Week list */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Weekly Challenges</h3>
          {filtered.length > 0 && (
            <span className="text-xs text-gray-500">
              Showing{" "}
              <span className="font-semibold text-gray-700">{filtered.length}</span>{" "}
              week{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No challenges in this category</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {filtered.map((challenge, idx) => {
              const rowId =
                challenge.challengeId ||
                `${challenge.weekStartDate}-${idx}`;
              const progressPct =
                challenge.totalDrills > 0
                  ? Math.round(
                      (challenge.completedCount / challenge.totalDrills) * 100,
                    )
                  : 0;

              return (
                <div
                  key={rowId}
                  onClick={() => handleExpand(rowId)}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xl" aria-hidden>
                          🏆
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 truncate">
                            {formatWeekLabel(
                              challenge.weekStartDate,
                              challenge.weekNumber,
                            )}
                          </h4>
                          <p className="text-xs text-gray-500 capitalize">
                            Generation: {challenge.generationStatus}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getStatusBadge(challenge.status)}
                      </div>
                    </div>

                    {challenge.totalDrills > 0 && (
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-500 mb-1">Progress</p>
                        <p
                          className={`text-xl font-bold ${
                            challenge.status === "completed"
                              ? "text-green-600"
                              : challenge.status === "in_progress"
                                ? "text-blue-600"
                                : "text-gray-700"
                          }`}
                        >
                          {challenge.completedCount}/{challenge.totalDrills}
                        </p>
                      </div>
                    )}
                  </div>

                  {expandedId === rowId && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                      {challenge.totalDrills > 0 && (
                        <div>
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>Drill completion</span>
                            <span>{progressPct}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                challenge.status === "completed"
                                  ? "bg-green-600"
                                  : "bg-blue-500"
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Week start</p>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(
                              challenge.weekStartDate,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Generated</p>
                          <p className="text-sm font-medium text-gray-900">
                            {challenge.generatedAt
                              ? new Date(
                                  challenge.generatedAt,
                                ).toLocaleDateString()
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Drills</p>
                          <p className="text-sm font-medium text-gray-900">
                            {challenge.completedCount} of {challenge.totalDrills}
                          </p>
                        </div>
                      </div>

                      {challenge.summaryMessage ? (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-gray-700 mb-1">
                            Summary
                          </p>
                          <p className="text-sm text-gray-600">
                            {challenge.summaryMessage}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
