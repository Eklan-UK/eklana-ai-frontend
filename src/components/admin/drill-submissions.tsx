"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  BarChart3,
  FileText,
  Zap,
} from "lucide-react";
import { useLearnerDrillAssignments } from "@/hooks/useAdmin";

interface DrillSubmissionsComponentProps {
  learnerId: string;
  learnerName?: string;
}

/**
 * Enhanced Drill Submissions & Analytics Component
 * Displays:
 * - All assigned drills (pending, in-progress, completed)
 * - Submissions awaiting review
 * - Drill performance analytics
 * - Challenge areas
 * - Completion status and scores
 */
export function DrillSubmissionsComponent({
  learnerId,
  learnerName = "Learner",
}: DrillSubmissionsComponentProps) {
  const {
    data: drillData,
    isLoading,
    error,
  } = useLearnerDrillAssignments(learnerId);
  
  // Extract data with safe defaults (must be before conditional returns)
  const drills = drillData?.assignments || [];
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "in-progress" | "completed" | "review"
  >("all");
  const [expandedDrill, setExpandedDrill] = useState<string | null>(null);

  // Memoize categorized drills to avoid recalculating on every render
  // Must be called before any conditional returns
  const categorizedDrills = useMemo(() => {
    return {
      pending: drills.filter((d: any) => d.status === "pending"),
      inProgress: drills.filter((d: any) => d.status === "in-progress"),
      completed: drills.filter((d: any) => d.status === "completed"),
      overdue: drills.filter((d: any) => d.status === "overdue"),
      review: drills.filter(
        (d: any) => d.requiresReview || d.reviewStatus === "pending",
      ),
    };
  }, [drills]);

  // Memoize filtered drills
  const filteredDrills = useMemo(() => {
    switch (filterStatus) {
      case "pending":
        return categorizedDrills.pending;
      case "in-progress":
        return categorizedDrills.inProgress;
      case "completed":
        return categorizedDrills.completed;
      case "review":
        return categorizedDrills.review;
      default:
        return drills;
    }
  }, [filterStatus, categorizedDrills, drills]);

  // Memoize callback functions
  const handleFilterChange = useCallback((status: typeof filterStatus) => {
    setFilterStatus(status);
  }, []);

  const handleDrillExpand = useCallback((drillId: string) => {
    setExpandedDrill((prev) => (prev === drillId ? null : drillId));
  }, []);

  // Memoize statistics calculations
  const statistics = useMemo(() => {
    const completed = categorizedDrills.completed;
    const review = categorizedDrills.review;
    
    return {
      completionRate: drills.length > 0
        ? ((completed.length / drills.length) * 100).toFixed(1)
        : 0,
      averageScoreValue: completed.length > 0
        ? (
            completed.reduce(
              (sum: number, d: any) => sum + (d.latestAttempt?.score || 0),
              0,
            ) / completed.length
          ).toFixed(1)
        : 0,
      pendingReviewCount: review.length,
    };
  }, [drills.length, categorizedDrills]);

  const { completionRate, averageScoreValue, pendingReviewCount } = statistics;

  // Conditional returns AFTER all hooks
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 text-sm">Failed to load drill submissions</p>
      </div>
    );
  }

  if (!drills || drills.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No drills assigned yet</p>
      </div>
    );
  }

  // Get drill type icon
  const getDrillTypeIcon = (type: string) => {
    switch (type) {
      case "vocabulary":
        return "📚";
      case "grammar":
        return "✏️";
      case "pronunciation":
        return "🎤";
      case "roleplay":
        return "🎭";
      case "sentence-writing":
        return "📝";
      case "matching":
        return "🔗";
      case "definition":
        return "📖";
      case "summary":
        return "📄";
      default:
        return "📌";
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case "in-progress":
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
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">
            Total Drills
          </p>
          <p className="text-2xl font-bold text-blue-600">{drills.length}</p>
          <p className="text-xs text-gray-500 mt-1">Assigned</p>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">
            Pending
          </p>
          <p className="text-2xl font-bold text-gray-600">
            {categorizedDrills.pending.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">To start</p>
        </div>

        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">
            In Progress
          </p>
          <p className="text-2xl font-bold text-indigo-600">
            {categorizedDrills.inProgress.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Active</p>
        </div>

        <div className="p-4 bg-green-50 rounded-lg border border-green-100">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">
            Completed
          </p>
          <p className="text-2xl font-bold text-green-600">
            {categorizedDrills.completed.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">{completionRate}%</p>
        </div>

        <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">
            Pending Review
          </p>
          <p className="text-2xl font-bold text-orange-600">
            {pendingReviewCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">Submissions</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => handleFilterChange("all")}
          className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
            filterStatus === "all"
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          All ({drills.length})
        </button>
        <button
          onClick={() => handleFilterChange("pending")}
          className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
            filterStatus === "pending"
              ? "bg-gray-100 text-gray-700"
              : "bg-gray-50 text-gray-700 hover:bg-gray-100"
          }`}
        >
          Pending ({categorizedDrills.pending.length})
        </button>
        <button
          onClick={() => handleFilterChange("in-progress")}
          className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
            filterStatus === "in-progress"
              ? "bg-indigo-100 text-indigo-700"
              : "bg-gray-50 text-gray-700 hover:bg-gray-100"
          }`}
        >
          In Progress ({categorizedDrills.inProgress.length})
        </button>
        <button
          onClick={() => handleFilterChange("completed")}
          className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
            filterStatus === "completed"
              ? "bg-green-100 text-green-700"
              : "bg-gray-50 text-gray-700 hover:bg-gray-100"
          }`}
        >
          Completed ({categorizedDrills.completed.length})
        </button>
        {pendingReviewCount > 0 && (
          <button
            onClick={() => handleFilterChange("review")}
            className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
              filterStatus === "review"
                ? "bg-orange-100 text-orange-700"
                : "bg-orange-50 text-orange-700 hover:bg-orange-100"
            }`}
          >
            For Review ({pendingReviewCount})
          </button>
        )}
      </div>

      {/* Performance Summary */}
      {categorizedDrills.completed.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-linear-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">
              Completion Rate
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-green-600">
                {completionRate}%
              </p>
              <p className="text-xs text-gray-600">
                {categorizedDrills.completed.length} of {drills.length}
              </p>
            </div>
            <div className="mt-2 h-1.5 bg-green-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all"
                style={{
                  width: `${completionRate}%`,
                }}
              ></div>
            </div>
          </div>

          <div className="bg-linear-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">
              Average Score
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-blue-600">
                {averageScoreValue}%
              </p>
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

      {/* Drills List */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">
          Drill Submissions
        </h3>

        {filteredDrills.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No drills in this category</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-full">
            {filteredDrills.map((drill: any, idx: number) => (
              <div
                key={drill._id || idx}
                onClick={() => handleDrillExpand(drill._id)}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                {/* Drill Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl">
                        {getDrillTypeIcon(drill.drill?.type || drill.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">
                          {drill.drill?.title || drill.title || "Untitled Drill"}
                        </h4>
                        <p className="text-xs text-gray-500 capitalize">
                          {drill.drill?.type || drill.type || "N/A"} •{" "}
                          {drill.drill?.difficulty || drill.difficulty || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {getStatusBadge(drill.status)}
                      {drill.requiresReview && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                          <AlertCircle className="w-3 h-3" /> Review Pending
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score Display */}
                  {(drill.latestAttempt?.score !== undefined || drill.bestScore !== null) && (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-500 mb-1">Score</p>
                      <p
                        className={`text-xl font-bold ${
                          (drill.latestAttempt?.score || drill.bestScore || 0) >= 70
                            ? "text-green-600"
                            : (drill.latestAttempt?.score || drill.bestScore || 0) >= 50
                              ? "text-yellow-600"
                              : "text-red-600"
                        }`}
                      >
                        {drill.latestAttempt?.score || drill.bestScore || 0}%
                      </p>
                    </div>
                  )}
                </div>

                {/* Expanded Details */}
                {expandedDrill === drill._id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Assigned</p>
                        <p className="text-sm font-medium text-gray-900">
                          {drill.assignedAt
                            ? new Date(drill.assignedAt).toLocaleDateString()
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Due Date</p>
                        <p className="text-sm font-medium text-gray-900">
                          {drill.dueDate
                            ? new Date(drill.dueDate).toLocaleDateString()
                            : "No due date"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Started</p>
                        <p className="text-sm font-medium text-gray-900">
                          {drill.latestAttempt?.startedAt
                            ? new Date(
                                drill.latestAttempt.startedAt,
                              ).toLocaleDateString()
                            : "Not started"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Completed</p>
                        <p className="text-sm font-medium text-gray-900">
                          {drill.completedAt
                            ? new Date(drill.completedAt).toLocaleDateString()
                            : "-"}
                        </p>
                      </div>
                    </div>

                    {/* Performance Details */}
                    {drill.latestAttempt && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-gray-700 mb-2">
                          Attempt Details
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                          {drill.latestAttempt.score !== undefined && (
                            <div>
                              <p className="text-gray-500">Score</p>
                              <p className="font-bold text-gray-900">
                                {drill.latestAttempt.score}%
                              </p>
                            </div>
                          )}
                          {drill.latestAttempt.timeSpent !== undefined && (
                            <div>
                              <p className="text-gray-500">Time Spent</p>
                              <p className="font-bold text-gray-900">
                                {Math.round(drill.latestAttempt.timeSpent / 60)}
                                m
                              </p>
                            </div>
                          )}
                          {drill.latestAttempt.completedAt && (
                            <div>
                              <p className="text-gray-500">Completed At</p>
                              <p className="font-bold text-gray-900">
                                {new Date(
                                  drill.latestAttempt.completedAt,
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Type-specific info */}
                    {drill.latestAttempt?.vocabularyResults && (
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                        <p className="text-xs font-semibold text-blue-700 mb-2">
                          Vocabulary Results
                        </p>
                        <p className="text-xs text-blue-600">
                          {drill.latestAttempt.vocabularyResults.wordScores
                            ?.length || 0}{" "}
                          words practiced
                        </p>
                      </div>
                    )}

                    {drill.latestAttempt?.grammarResults && (
                      <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                        <p className="text-xs font-semibold text-green-700 mb-2">
                          Grammar Results
                        </p>
                        <p className="text-xs text-green-600">
                          {drill.latestAttempt.grammarResults.accuracy
                            ? `${drill.latestAttempt.grammarResults.accuracy}% accuracy`
                            : "Patterns reviewed"}
                        </p>
                      </div>
                    )}

                    {drill.latestAttempt?.matchingResults && (
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                        <p className="text-xs font-semibold text-purple-700 mb-2">
                          Matching Results
                        </p>
                        <p className="text-xs text-purple-600">
                          {drill.latestAttempt.matchingResults.pairsMatched} of{" "}
                          {drill.latestAttempt.matchingResults.totalPairs} pairs
                          matched
                        </p>
                      </div>
                    )}

                    {drill.requiresReview && (
                      <div className="bg-orange-50 rounded-lg p-3 border border-orange-200 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-orange-700">
                            Awaiting Review
                          </p>
                          <p className="text-xs text-orange-600 mt-1">
                            This drill submission requires tutor or admin review
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
