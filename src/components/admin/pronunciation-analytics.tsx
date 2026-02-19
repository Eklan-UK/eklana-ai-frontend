"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Mic,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  BarChart3,
  Volume2,
} from "lucide-react";
import { useLearnerPronunciationAnalytics } from "@/hooks/usePronunciations";

interface PronunciationAnalyticsComponentProps {
  learnerId: string;
  learnerName?: string;
}

/**
 * Enhanced Pronunciation Analytics Component
 * Displays:
 * - Overall pronunciation statistics
 * - Word-level progress and analytics
 * - Phoneme difficulties
 * - Challenge areas and weak sounds
 * - Performance trends
 */
export function PronunciationAnalyticsComponent({
  learnerId,
  learnerName = "Learner",
}: PronunciationAnalyticsComponentProps) {
  const {
    data: analytics,
    isLoading,
    error,
  } = useLearnerPronunciationAnalytics(learnerId);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [filterByStatus, setFilterByStatus] = useState<
    "all" | "passed" | "challenging"
  >("all");

  // Extract data with safe defaults (must be before conditional returns)
  const overall = analytics?.overall || {};
  const wordStats = analytics?.wordStats || [];
  const problemAreas = analytics?.problemAreas || {};

  // Memoize computed values to avoid recalculating on every render
  // Must be called before any conditional returns
  const completedWordsCount = useMemo(
    () => wordStats.filter((w: any) => w.status === "completed").length,
    [wordStats]
  );

  const challengingCount = useMemo(
    () => wordStats.filter((w: any) => w.isChallenging).length,
    [wordStats]
  );

  const completionRate = useMemo(
    () =>
      wordStats.length > 0
        ? ((completedWordsCount / wordStats.length) * 100).toFixed(1)
        : 0,
    [wordStats.length, completedWordsCount]
  );

  // Memoize filtered words to avoid recalculating on every render
  const filteredWords = useMemo(
    () =>
      wordStats.filter((word: any) => {
        if (filterByStatus === "all") return true;
        if (filterByStatus === "passed") return word.status === "completed";
        if (filterByStatus === "challenging") return word.isChallenging;
        return true;
      }),
    [wordStats, filterByStatus]
  );

  // Memoize callback functions
  const handleFilterChange = useCallback((filter: "all" | "passed" | "challenging") => {
    setFilterByStatus(filter);
  }, []);

  const handleWordClick = useCallback((wordId: string) => {
    setSelectedWord((prev) => (prev === wordId ? null : wordId));
  }, []);

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
        <p className="text-red-700 text-sm">
          Failed to load pronunciation analytics
        </p>
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

  return (
    <div className="space-y-6">
      {/* Overall Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">
            Total Words
          </p>
          <p className="text-2xl font-bold text-blue-600">{wordStats.length}</p>
          <p className="text-xs text-gray-500 mt-1">Practiced</p>
        </div>

        <div className="p-4 bg-green-50 rounded-lg border border-green-100">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">
            Passed
          </p>
          <p className="text-2xl font-bold text-green-600">
            {completedWordsCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">{completionRate}%</p>
        </div>

        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">
            Avg Score
          </p>
          <p className="text-2xl font-bold text-yellow-600">
            {overall.averageScore?.toFixed(1) || 0}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Overall</p>
        </div>

        <div className="p-4 bg-primary-50 rounded-lg border border-primary-100">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">
            Challenging
          </p>
          <p className="text-2xl font-bold text-primary-600">
            {challengingCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">Words</p>
        </div>

        <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
          <p className="text-xs text-gray-600 mb-1 font-medium uppercase">
            Pass Rate
          </p>
          <p className="text-2xl font-bold text-orange-600">
            {overall.passRate?.toFixed(1) || 0}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Success</p>
        </div>
      </div>

      {/* Problem Areas Section */}
      {(problemAreas.topIncorrectPhonemes?.length ||
        problemAreas.topIncorrectLetters?.length) > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              Problem Areas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top Incorrect Phonemes */}
              {problemAreas.topIncorrectPhonemes?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-3 uppercase">
                    Difficult Sounds
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {problemAreas.topIncorrectPhonemes.map(
                      (item: any, idx: number) => (
                        <div
                          key={idx}
                          className="px-3 py-1.5 bg-orange-100 border border-orange-200 rounded-full text-xs font-medium text-orange-700 flex items-center gap-2"
                        >
                          <Volume2 className="w-3 h-3" />
                          {item.phoneme}
                          <span className="text-orange-600 font-bold">
                            ×{item.count}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* Top Incorrect Letters */}
              {problemAreas.topIncorrectLetters?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-3 uppercase">
                    Difficult Letters
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {problemAreas.topIncorrectLetters.map(
                      (item: any, idx: number) => (
                        <div
                          key={idx}
                          className="px-3 py-1.5 bg-red-100 border border-red-200 rounded-full text-xs font-medium text-red-700 flex items-center gap-2"
                        >
                          <span className="font-mono font-bold text-base">
                            {item.letter}
                          </span>
                          <span className="text-red-600 font-bold">
                            ×{item.count}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Word-Level Progress */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            Word-Level Progress
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => handleFilterChange("all")}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${filterByStatus === "all"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
            >
              All ({wordStats.length})
            </button>
            <button
              onClick={() => handleFilterChange("passed")}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${filterByStatus === "passed"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
            >
              Passed ({completedWordsCount})
            </button>
            <button
              onClick={() => handleFilterChange("challenging")}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${filterByStatus === "challenging"
                  ? "bg-primary-100 text-primary-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
            >
              Challenging ({challengingCount})
            </button>
          </div>
        </div>

        {filteredWords.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No words in this category</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredWords.map((word: any, idx: number) => (
              <div
                key={idx}
                onClick={() => handleWordClick(word._id || word.pronunciationId?.toString() || idx.toString())}
                className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                {/* Word Header */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">
                        {word.title || word.word}
                      </p>
                      {word.status === "completed" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : word.isChallenging ? (
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    {word.text && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {word.text}
                      </p>
                    )}
                  </div>

                  {/* Quick Stats */}
                  <div className="flex items-center gap-4 ml-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Attempts</p>
                      <p className="text-sm font-bold text-gray-900">
                        {word.attempts || 0}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Best</p>
                      <p
                        className={`text-sm font-bold ${word.bestScore >= 70
                            ? "text-green-600"
                            : "text-red-600"
                          }`}
                      >
                        {word.bestScore?.toFixed(0) || 0}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Avg</p>
                      <p className="text-sm font-bold text-gray-900">
                        {word.averageScore?.toFixed(0) || 0}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedWord === (word._id || word.pronunciationId?.toString() || idx.toString()) && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-gray-500 mb-1">Challenge Level</p>
                        <p className="font-medium text-gray-900 capitalize">
                          {word.challengeLevel || "none"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Last Attempt</p>
                        <p className="font-medium text-gray-900">
                          {word.lastAttemptAt
                            ? new Date(word.lastAttemptAt).toLocaleDateString()
                            : "Never"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Passed At</p>
                        <p className="font-medium text-gray-900">
                          {word.passedAt
                            ? new Date(word.passedAt).toLocaleDateString()
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Status</p>
                        <p className="font-medium text-gray-900 capitalize">
                          {word.status || "pending"}
                        </p>
                      </div>
                    </div>

                    {/* Weak Phonemes */}
                    {word.weakPhonemes?.length > 0 && (
                      <div>
                        <p className="text-gray-500 text-xs mb-1.5 font-medium">
                          Weak Sounds
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {word.weakPhonemes.map(
                            (phoneme: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded"
                              >
                                {phoneme}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                    {/* Incorrect Letters */}
                    {word.incorrectLetters?.length > 0 && (
                      <div>
                        <p className="text-gray-500 text-xs mb-1.5 font-medium">
                          Incorrect Letters
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {word.incorrectLetters.map(
                            (letter: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded font-mono"
                              >
                                {letter}
                              </span>
                            ),
                          )}
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

      {/* Statistics Summary */}
      {wordStats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-linear-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">
              Completed
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-green-600">
                {completedWordsCount}
              </p>
              <p className="text-xs text-gray-600">
                out of {wordStats.length} words
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

          <div className="bg-linear-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">
              Average Performance
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-yellow-600">
                {overall.averageScore?.toFixed(1) || 0}%
              </p>
              <p className="text-xs text-gray-600">accuracy</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {overall.averageScore >= 80
                ? "🎯 Excellent performance!"
                : overall.averageScore >= 70
                  ? "✅ Good progress"
                  : "💪 Keep practicing"}
            </p>
          </div>

          <div className="bg-linear-to-br from-primary-50 to-indigo-50 border border-primary-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">
              Challenging Words
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-primary-600">
                {challengingCount}
              </p>
              <p className="text-xs text-gray-600">needs focus</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {challengingCount === 0
                ? "✨ No challenging words!"
                : `Focus on these ${challengingCount} word${challengingCount !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
