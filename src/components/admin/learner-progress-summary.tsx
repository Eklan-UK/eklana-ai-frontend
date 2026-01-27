"use client";

import React from "react";
import {
  TrendingUp,
  BookOpen,
  Mic,
  Target,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useLearnerDrillAssignments } from "@/hooks/useAdmin";
import { useLearnerPronunciationAnalytics } from "@/hooks/usePronunciations";

interface LearnerProgressSummaryProps {
  learnerId: string;
  learnerName?: string;
}

/**
 * Overall progress summary component
 * Combines drill and pronunciation analytics
 */
export function LearnerProgressSummary({
  learnerId,
  learnerName = "Learner",
}: LearnerProgressSummaryProps) {
  const {
    data: drillData,
    isLoading: drillsLoading,
  } = useLearnerDrillAssignments(learnerId);

  const {
    data: pronunciationData,
    isLoading: pronunciationLoading,
  } = useLearnerPronunciationAnalytics(learnerId);

  const isLoading = drillsLoading || pronunciationLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const drillStats = drillData?.statistics || {
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    overdue: 0,
    averageScore: 0,
    completionRate: 0,
  };
  const pronunciationStats = pronunciationData?.overall || {};
  const wordStats = pronunciationData?.wordStats || [];

  // Calculate overall progress metrics
  const totalDrills = drillStats.total || 0;
  const completedDrills = drillStats.completed || 0;
  const drillCompletionRate = totalDrills > 0
    ? Math.round((completedDrills / totalDrills) * 100)
    : 0;

  const totalWords = wordStats.length || 0;
  const completedWords = wordStats.filter((w: any) => w.status === 'completed').length || 0;
  const wordCompletionRate = totalWords > 0
    ? Math.round((completedWords / totalWords) * 100)
    : 0;

  const drillAverageScore = drillStats.averageScore || 0;
  const pronunciationAverageScore = pronunciationStats.averageScore || 0;

  // Overall progress score (weighted average)
  const overallProgress = totalDrills > 0 && totalWords > 0
    ? Math.round(
        (drillCompletionRate * 0.5 + wordCompletionRate * 0.5)
      )
    : totalDrills > 0
      ? drillCompletionRate
      : totalWords > 0
        ? wordCompletionRate
        : 0;

  // Overall average score
  const overallAverageScore = drillAverageScore > 0 && pronunciationAverageScore > 0
    ? Math.round((drillAverageScore + pronunciationAverageScore) / 2)
    : drillAverageScore > 0
      ? drillAverageScore
      : pronunciationAverageScore > 0
        ? pronunciationAverageScore
        : 0;

  return (
    <div className="space-y-6">
      {/* Overall Progress Card */}
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
          ></div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Drills Stats */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <p className="text-xs font-semibold text-gray-600 uppercase">Drills</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {completedDrills}/{totalDrills}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {drillCompletionRate}% completed
          </p>
          {drillAverageScore > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Avg: {drillAverageScore.toFixed(0)}%
            </p>
          )}
        </div>

        {/* Pronunciation Stats */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Mic className="w-4 h-4 text-purple-600" />
            <p className="text-xs font-semibold text-gray-600 uppercase">Words</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {completedWords}/{totalWords}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {wordCompletionRate}% completed
          </p>
          {pronunciationAverageScore > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Avg: {pronunciationAverageScore.toFixed(0)}%
            </p>
          )}
        </div>

        {/* Overall Score */}
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

        {/* Status Summary */}
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
            {drillStats.pending === 0 && drillStats.inProgress === 0 && drillStats.overdue === 0 && (
              <p className="text-xs text-emerald-600 font-medium">All up to date!</p>
            )}
          </div>
        </div>
      </div>

      {/* Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg border border-blue-100 p-4">
          <p className="text-xs font-semibold text-gray-700 mb-2 uppercase">
            Drill Performance
          </p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Completion Rate</span>
              <span className="font-bold text-gray-900">{drillCompletionRate}%</span>
            </div>
            {drillAverageScore > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Average Score</span>
                <span className="font-bold text-gray-900">{drillAverageScore.toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg border border-purple-100 p-4">
          <p className="text-xs font-semibold text-gray-700 mb-2 uppercase">
            Pronunciation Performance
          </p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Completion Rate</span>
              <span className="font-bold text-gray-900">{wordCompletionRate}%</span>
            </div>
            {pronunciationAverageScore > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Average Score</span>
                <span className="font-bold text-gray-900">
                  {pronunciationAverageScore.toFixed(1)}%
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

