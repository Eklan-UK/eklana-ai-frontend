"use client";

import { Loader2, PenLine } from "lucide-react";
import { usePlatformFillBlankAnalytics } from "@/hooks/useAdmin";
import { AnalyticsAssignmentProgressCard } from "@/components/admin/analytics-assignment-progress-card";

interface PlatformFillBlankAnalyticsProps {
  days?: number;
  learnerIds?: string[];
  showTitle?: boolean;
}

export function PlatformFillBlankAnalytics({
  days,
  learnerIds,
  showTitle = true,
}: PlatformFillBlankAnalyticsProps) {
  const {
    data: analytics,
    isLoading,
    isError,
  } = usePlatformFillBlankAnalytics(days, learnerIds);

  const stats = analytics?.stats;

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6">
      {showTitle ? (
        <div className="flex items-center justify-between mb-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <span className="p-2 bg-indigo-50 rounded-lg">
              <PenLine className="w-4 h-4 text-indigo-600" />
            </span>
            Fill in the Blank Analytics
          </h2>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : isError ? (
        <div className="text-center py-8 text-red-500">
          Failed to load fill-in-the-blank analytics.
        </div>
      ) : !stats || (stats.totalAssigned === 0 && stats.totalAttempts === 0) ? (
        <div className="text-center py-8 text-gray-500">
          No fill-in-the-blank data available.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AnalyticsAssignmentProgressCard
              totalAssigned={stats.totalAssigned}
              totalCompleted={stats.totalCompleted}
              completionRatePct={stats.completionRatePct}
              variant="platform"
            />
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Accuracy Rate</p>
              <p
                className={`text-2xl font-bold ${
                  stats.accuracyRatePct >= 70 ? "text-green-600" : "text-amber-600"
                }`}
              >
                {stats.accuracyRatePct}%
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Average Score</p>
              <p className="text-2xl font-bold text-blue-600">{stats.averageScore}%</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
