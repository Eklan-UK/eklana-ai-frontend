"use client";

import React from "react";
import {
  TrendingUp,
  BookOpen,
  Target,
  CheckCircle2,
  Clock,
  AlertCircle,
  ClipboardList,
} from "lucide-react";
import { useAnalyticsDashboard } from "@/hooks/useAdmin";
import type { AnalyticsDashboardData } from "@/types/admin-analytics-dashboard";

interface AnalyticsProgressSummaryProps {
  learnerIds: string[];
}

function ProgressFromDashboard({ data }: { data: AnalyticsDashboardData }) {
  const { progress } = data;
  const drillStats = progress.drillStats;
  const pronunciationStats = progress.pronunciationStats;
  const overallProgress = progress.overallProgressPct;
  const overallAverageScore = progress.overallAverageScore;
  const pendingReviewCount = progress.pendingReviewCount;

  return (
    <ProgressLayout
      overallProgress={overallProgress}
      overallAverageScore={overallAverageScore}
      drillStats={{
        total: drillStats.total,
        completed: drillStats.completed,
        pending: data.drills.pending,
        inProgress: data.drills.inProgress,
        overdue: data.drills.overdue,
        averageScore: drillStats.averageScore,
        completionRate: drillStats.completionRatePct,
      }}
      pronunciationStats={{
        averageScore: pronunciationStats.averageScore,
        completionRate: pronunciationStats.completionRatePct,
        passRate: data.pronunciation.overall.passRate,
      }}
      pendingReviewCount={pendingReviewCount}
    />
  );
}


function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
    </div>
  );
}

interface ProgressLayoutProps {
  overallProgress: number;
  overallAverageScore: number;
  pendingReviewCount: number;
  drillStats: {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    overdue: number;
    averageScore: number;
    completionRate: number;
  };
  pronunciationStats: {
    averageScore: number;
    completionRate: number;
    passRate: number;
  };
}

function ProgressLayout({
  overallProgress,
  overallAverageScore,
  pendingReviewCount,
  drillStats,
  pronunciationStats,
}: ProgressLayoutProps) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-600" />
            <h3 className="text-lg font-bold text-gray-900">Overall Progress</h3>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-emerald-600">{overallProgress}%</p>
            <p className="text-xs text-gray-600">Completion Rate</p>
          </div>
        </div>
        <div className="h-3 bg-emerald-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-600 transition-all"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <p className="text-xs font-semibold text-gray-600 uppercase">Drills</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {drillStats.completed}/{drillStats.total}
          </p>
          <p className="text-xs text-gray-500 mt-1">{drillStats.completionRate}% completed</p>
          {drillStats.averageScore > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Avg: {drillStats.averageScore.toFixed(0)}%
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="w-4 h-4 text-orange-600" />
            <p className="text-xs font-semibold text-gray-600 uppercase">Pending Review</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{pendingReviewCount}</p>
          <p className="text-xs text-gray-500 mt-1">Submissions awaiting review</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <p className="text-xs font-semibold text-gray-600 uppercase">Avg Score</p>
          </div>
          <p
            className={`text-2xl font-bold ${
              overallAverageScore >= 80
                ? "text-green-600"
                : overallAverageScore >= 70
                  ? "text-yellow-600"
                  : "text-red-600"
            }`}
          >
            {overallAverageScore}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Overall performance</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <p className="text-xs font-semibold text-gray-600 uppercase">Status</p>
          </div>
          <div className="space-y-1">
            {drillStats.pending > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <Clock className="w-3 h-3 text-gray-400" />
                <span className="text-gray-600">{drillStats.pending} pending</span>
              </div>
            )}
            {drillStats.inProgress > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <TrendingUp className="w-3 h-3 text-blue-400" />
                <span className="text-gray-600">{drillStats.inProgress} in progress</span>
              </div>
            )}
            {drillStats.overdue > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <AlertCircle className="w-3 h-3 text-red-400" />
                <span className="text-gray-600">{drillStats.overdue} overdue</span>
              </div>
            )}
            {drillStats.pending === 0 &&
              drillStats.inProgress === 0 &&
              drillStats.overdue === 0 && (
                <p className="text-xs text-emerald-600 font-medium">All up to date!</p>
              )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg border border-blue-100 p-4">
          <p className="text-xs font-semibold text-gray-700 mb-2 uppercase">Drill Performance</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Completion Rate</span>
              <span className="font-bold text-gray-900">{drillStats.completionRate}%</span>
            </div>
            {drillStats.averageScore > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Average Score</span>
                <span className="font-bold text-gray-900">
                  {drillStats.averageScore.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-primary-50 rounded-lg border border-primary-100 p-4">
          <p className="text-xs font-semibold text-gray-700 mb-2 uppercase">
            Pronunciation Performance
          </p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Completion Rate</span>
              <span className="font-bold text-gray-900">
                {pronunciationStats.completionRate}%
              </span>
            </div>
            {pronunciationStats.averageScore > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Average Score</span>
                <span className="font-bold text-gray-900">
                  {pronunciationStats.averageScore.toFixed(1)}%
                </span>
              </div>
            )}
            {pronunciationStats.passRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Pass Rate</span>
                <span className="font-bold text-gray-900">
                  {pronunciationStats.passRate.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsProgressSummary({ learnerIds }: AnalyticsProgressSummaryProps) {
  const { data: dashboardData, isLoading } = useAnalyticsDashboard(
    learnerIds.length > 0 ? learnerIds : undefined,
    30
  );

  if (isLoading) return <LoadingSpinner />;
  if (!dashboardData) {
    return (
      <p className="text-center py-8 text-gray-500 text-sm">No progress data available</p>
    );
  }

  return <ProgressFromDashboard data={dashboardData} />;
}
