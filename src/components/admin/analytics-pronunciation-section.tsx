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

function dashboardToPronunciationView(data: AnalyticsDashboardData): PronunciationViewData {
  const progress = data.progress.pronunciationStats;
  return {
    overall: {
      averageScore: data.pronunciation.overall.averageScore,
      passRate: data.pronunciation.overall.passRate,
    },
    totalWords: progress.totalWords,
    completedWords: progress.completedWords,
    challengingCount: data.pronunciation.challengingWords ?? 0,
  };
}

export function AnalyticsPronunciationSection({ learnerIds }: AnalyticsPronunciationSectionProps) {
  const isSingleLearner = learnerIds.length === 1;

  // Single-learner path: uses the per-learner API which falls back to
  // PronunciationAttempt records when LearnerPronunciationProgress is empty.
  const {
    data: singleData,
    isLoading: singleLoading,
    error: singleError,
  } = useLearnerPronunciationAnalytics(isSingleLearner ? learnerIds[0] : "");

  // Platform / multi-learner path: uses the dashboard aggregate.
  const {
    data: dashData,
    isLoading: dashLoading,
    error: dashError,
  } = useAnalyticsDashboard(
    learnerIds.length > 0 ? learnerIds : undefined,
    30,
    learnerIds.length !== 1
  );

  if (isSingleLearner ? singleLoading : dashLoading) return <LoadingSpinner />;

  if (isSingleLearner) {
    if (singleError || !singleData) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">Failed to load pronunciation analytics</p>
        </div>
      );
    }

    const wordStats: any[] = singleData.wordStats ?? [];
    const completedWords = wordStats.filter((w: any) => w.status === "completed").length;
    const challengingCount = wordStats.filter((w: any) => w.isChallenging).length;

    if (wordStats.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <Mic className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No pronunciation data available yet</p>
        </div>
      );
    }

    return (
      <PronunciationContent
        data={{
          overall: {
            averageScore: singleData.overall?.averageScore ?? 0,
            passRate: singleData.overall?.passRate ?? 0,
          },
          totalWords: wordStats.length,
          completedWords,
          challengingCount,
        }}
      />
    );
  }

  if (dashError || !dashData) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 text-sm">Failed to load pronunciation analytics</p>
      </div>
    );
  }

  const viewData = dashboardToPronunciationView(dashData);

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
