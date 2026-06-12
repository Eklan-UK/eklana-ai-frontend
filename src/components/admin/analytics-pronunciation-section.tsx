"use client";

import React, { useMemo } from "react";
import { Mic } from "lucide-react";
import { useAnalyticsDashboard } from "@/hooks/useAdmin";
import { useLearnerPronunciationAnalytics } from "@/hooks/usePronunciations";
import type { AnalyticsDashboardData } from "@/types/admin-analytics-dashboard";

interface PronunciationViewData {
  overall: {
    averageScore: number;
    passRate: number;
  };
  totalWords: number;
  completedWords: number;
  challengingCount: number;
}

interface AnalyticsPronunciationSectionProps {
  learnerIds: string[];
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
    </div>
  );
}

function PronunciationContent({ data }: { data: PronunciationViewData }) {
  const { overall, totalWords, completedWords, challengingCount } = data;

  const completionRate = useMemo(
    () => (totalWords > 0 ? ((completedWords / totalWords) * 100).toFixed(1) : "0"),
    [totalWords, completedWords]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">Total Words</p>
          <p className="text-2xl font-bold text-blue-600">{totalWords}</p>
          <p className="text-xs text-gray-500 mt-1">Practiced</p>
        </div>

        <div className="p-4 bg-green-50 rounded-lg border border-green-100">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">Passed</p>
          <p className="text-2xl font-bold text-green-600">{completedWords}</p>
          <p className="text-xs text-gray-500 mt-1">{completionRate}%</p>
        </div>

        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">Avg Score</p>
          <p className="text-2xl font-bold text-yellow-600">
            {overall.averageScore?.toFixed(1) || 0}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Overall</p>
        </div>

        <div className="p-4 bg-primary-50 rounded-lg border border-primary-100">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">Challenging</p>
          <p className="text-2xl font-bold text-primary-600">{challengingCount}</p>
          <p className="text-xs text-gray-500 mt-1">Words</p>
        </div>

        <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">Pass Rate</p>
          <p className="text-2xl font-bold text-orange-600">
            {overall.passRate?.toFixed(1) || 0}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Success</p>
        </div>
      </div>
    </div>
  );
}

function SingleLearnerPronunciation({ learnerId }: { learnerId: string }) {
  const { data: analytics, isLoading, error } = useLearnerPronunciationAnalytics(learnerId);

  if (isLoading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 text-sm">Failed to load pronunciation analytics</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Mic className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No pronunciation data available yet</p>
      </div>
    );
  }

  const wordStats = analytics.wordStats || [];
  const viewData: PronunciationViewData = {
    overall: analytics.overall || { averageScore: 0, passRate: 0 },
    totalWords: wordStats.length,
    completedWords: wordStats.filter((w: { status?: string }) => w.status === "completed")
      .length,
    challengingCount: wordStats.filter((w: { isChallenging?: boolean }) => w.isChallenging)
      .length,
  };

  return <PronunciationContent data={viewData} />;
}

function DashboardPronunciation({ learnerIds }: { learnerIds: string[] }) {
  const { data, isLoading, error } = useAnalyticsDashboard(
    learnerIds.length > 0 ? learnerIds : undefined
  );

  if (isLoading) return <LoadingSpinner />;

  if (error || !data) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 text-sm">Failed to load pronunciation analytics</p>
      </div>
    );
  }

  const viewData = dashboardToPronunciationView(data);
  if (viewData.totalWords === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Mic className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No pronunciation data available yet</p>
      </div>
    );
  }

  return <PronunciationContent data={viewData} />;
}

function dashboardToPronunciationView(data: AnalyticsDashboardData): PronunciationViewData {
  const progress = data.progress.pronunciationStats;
  return {
    overall: {
      averageScore: data.pronunciation.overall.averageScore,
      passRate: data.pronunciation.overall.passRate,
    },
    totalWords: progress.totalWords,
    completedWords: progress.completedWords,
    challengingCount: 0,
  };
}

export function AnalyticsPronunciationSection({ learnerIds }: AnalyticsPronunciationSectionProps) {
  if (learnerIds.length === 1) {
    return <SingleLearnerPronunciation learnerId={learnerIds[0]} />;
  }

  return <DashboardPronunciation learnerIds={learnerIds} />;
}
