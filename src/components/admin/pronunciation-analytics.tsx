"use client";

import React, { useMemo } from "react";
import {
  Mic,
  AlertCircle,
  Volume2,
} from "lucide-react";
import { useLearnerPronunciationAnalytics } from "@/hooks/usePronunciations";

interface StrugglingWord {
  word: string;
  count: number;
}

interface PhonemeProblemArea {
  phoneme: string;
  count: number;
  words?: StrugglingWord[];
}

interface LetterProblemArea {
  letter: string;
  count: number;
  words?: StrugglingWord[];
}

interface PronunciationAnalyticsComponentProps {
  learnerId: string;
  learnerName?: string;
}

function StrugglingWordsList({
  words,
  accentClass,
}: {
  words: StrugglingWord[];
  accentClass: string;
}) {
  if (words.length === 0) {
    return <p className="text-xs text-gray-500 italic">No word data yet</p>;
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-1.5">Struggling with these words:</p>
      <div className="flex flex-wrap gap-1.5">
        {words.map((w, wi) => (
          <span
            key={wi}
            className="px-2 py-0.5 bg-white border border-orange-200 rounded text-xs text-gray-800"
          >
            {w.word}
            <span className={`ml-1 ${accentClass}`}>×{w.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Enhanced Pronunciation Analytics component for admin/tutor learner profiles.
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

  const overall = analytics?.overall || {};
  const wordStats = analytics?.wordStats || [];
  const problemAreas = analytics?.problemAreas || {};

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

      {problemAreas.topIncorrectPhonemes?.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-orange-500" />
            Problem Areas
          </h3>
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-3 uppercase">
              Difficult Sounds
            </p>
            <div className="space-y-2">
              {problemAreas.topIncorrectPhonemes.map(
                (item: PhonemeProblemArea, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 bg-orange-50 border border-orange-100 rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-sm font-semibold text-orange-700">
                        /{item.phoneme}/
                      </span>
                      <span className="text-xs text-orange-600 font-bold ml-auto">
                        ×{item.count}
                      </span>
                    </div>
                    <StrugglingWordsList
                      words={item.words ?? []}
                      accentClass="text-orange-500"
                    />
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      )}

      {problemAreas.topIncorrectLetters?.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            Difficult Letters
          </h3>
          <div className="space-y-2">
            {problemAreas.topIncorrectLetters.map(
              (item: LetterProblemArea, idx: number) => (
                <div
                  key={idx}
                  className="p-3 bg-red-50 border border-red-100 rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono font-bold text-red-700">{item.letter}</span>
                    <span className="text-xs text-red-600 font-bold ml-auto">
                      ×{item.count}
                    </span>
                  </div>
                  <StrugglingWordsList
                    words={item.words ?? []}
                    accentClass="text-red-500"
                  />
                </div>
              ),
            )}
          </div>
        </div>
      )}

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
                ? "Excellent performance!"
                : overall.averageScore >= 70
                  ? "Good progress"
                  : "Keep practicing"}
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
                ? "No challenging words!"
                : `Focus on these ${challengingCount} word${challengingCount !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
