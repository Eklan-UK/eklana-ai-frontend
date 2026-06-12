"use client";

import React, { useCallback, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { useLearnerDrillAssignments, useAnalyticsDashboard } from "@/hooks/useAdmin";
import type { AnalyticsDashboardData } from "@/types/admin-analytics-dashboard";

type FilterStatus = "all" | "pending" | "in-progress" | "completed" | "review";

interface DrillStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  pendingReview: number;
  completionRatePct: number;
  averageScore: number;
}

interface AnalyticsDrillProgressStatsProps {
  learnerIds: string[];
}

function StatsContent({
  stats,
  filterStatus,
  onFilterChange,
}: {
  stats: DrillStats;
  filterStatus: FilterStatus;
  onFilterChange: (status: FilterStatus) => void;
}) {
  const completionRate = stats.completionRatePct;
  const averageScoreValue = stats.averageScore;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">Total Drills</p>
          <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
          <p className="text-xs text-gray-500 mt-1">Assigned</p>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">Pending</p>
          <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
          <p className="text-xs text-gray-500 mt-1">To start</p>
        </div>

        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">In Progress</p>
          <p className="text-2xl font-bold text-indigo-600">{stats.inProgress}</p>
          <p className="text-xs text-gray-500 mt-1">Active</p>
        </div>

        <div className="p-4 bg-green-50 rounded-lg border border-green-100">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">Completed</p>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          <p className="text-xs text-gray-500 mt-1">{completionRate}%</p>
        </div>

        <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">Pending Review</p>
          <p className="text-2xl font-bold text-orange-600">{stats.pendingReview}</p>
          <p className="text-xs text-gray-500 mt-1">Submissions</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {(
          [
            ["all", "All", stats.total, "bg-blue-100 text-blue-700"],
            ["pending", "Pending", stats.pending, "bg-gray-100 text-gray-700"],
            ["in-progress", "In Progress", stats.inProgress, "bg-indigo-100 text-indigo-700"],
            ["completed", "Completed", stats.completed, "bg-green-100 text-green-700"],
          ] as const
        ).map(([key, label, count, activeClass]) => (
          <button
            key={key}
            type="button"
            onClick={() => onFilterChange(key)}
            className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
              filterStatus === key
                ? activeClass
                : "bg-gray-50 text-gray-700 hover:bg-gray-100"
            }`}
          >
            {label} ({count})
          </button>
        ))}
        {stats.pendingReview > 0 && (
          <button
            type="button"
            onClick={() => onFilterChange("review")}
            className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
              filterStatus === "review"
                ? "bg-orange-100 text-orange-700"
                : "bg-orange-50 text-orange-700 hover:bg-orange-100"
            }`}
          >
            For Review ({stats.pendingReview})
          </button>
        )}
      </div>

      {stats.completed > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-linear-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">Completion Rate</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-green-600">{completionRate}%</p>
              <p className="text-xs text-gray-600">
                {stats.completed} of {stats.total}
              </p>
            </div>
            <div className="mt-2 h-1.5 bg-green-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>

          <div className="bg-linear-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">Average Score</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-blue-600">{averageScoreValue}%</p>
              <p className="text-xs text-gray-600">across drills</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {Number(averageScoreValue) >= 80
                ? "🎯 Excellent performance!"
                : Number(averageScoreValue) >= 70
                  ? "✅ Good progress"
                  : "💪 Keep practicing"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SingleLearnerDrillStats({ learnerId }: { learnerId: string }) {
  const { data: drillData, isLoading, error } = useLearnerDrillAssignments(learnerId);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  const drills = drillData?.assignments || [];

  const stats = useMemo((): DrillStats => {
    const statistics = drillData?.statistics;
    const pendingReview = drills.filter(
      (d: { requiresReview?: boolean }) => d.requiresReview
    ).length;

    return {
      total: statistics?.total ?? drills.length,
      pending: statistics?.pending ?? 0,
      inProgress: statistics?.inProgress ?? 0,
      completed: statistics?.completed ?? 0,
      overdue: statistics?.overdue ?? 0,
      pendingReview,
      completionRatePct: statistics?.completionRate ?? 0,
      averageScore: statistics?.averageScore ?? 0,
    };
  }, [drillData, drills]);

  const handleFilterChange = useCallback((status: FilterStatus) => {
    setFilterStatus(status);
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
        <p className="text-red-700 text-sm">Failed to load drill progress</p>
      </div>
    );
  }

  if (stats.total === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No drills assigned yet</p>
      </div>
    );
  }

  return (
    <StatsContent stats={stats} filterStatus={filterStatus} onFilterChange={handleFilterChange} />
  );
}

function DashboardDrillStats({
  learnerIds,
}: {
  learnerIds: string[];
}) {
  const { data, isLoading, error } = useAnalyticsDashboard(
    learnerIds.length > 0 ? learnerIds : undefined
  );
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  const handleFilterChange = useCallback((status: FilterStatus) => {
    setFilterStatus(status);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 text-sm">Failed to load drill progress</p>
      </div>
    );
  }

  const stats = dashboardToStats(data);

  if (stats.total === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No drills assigned yet</p>
      </div>
    );
  }

  return (
    <StatsContent stats={stats} filterStatus={filterStatus} onFilterChange={handleFilterChange} />
  );
}

function dashboardToStats(data: AnalyticsDashboardData): DrillStats {
  return {
    total: data.drills.total,
    pending: data.drills.pending,
    inProgress: data.drills.inProgress,
    completed: data.drills.completed,
    overdue: data.drills.overdue,
    pendingReview: data.drills.pendingReview,
    completionRatePct: data.drills.completionRatePct,
    averageScore: data.drills.averageScore,
  };
}

export function AnalyticsDrillProgressStats({ learnerIds }: AnalyticsDrillProgressStatsProps) {
  if (learnerIds.length === 1) {
    return <SingleLearnerDrillStats learnerId={learnerIds[0]} />;
  }

  return <DashboardDrillStats learnerIds={learnerIds} />;
}
