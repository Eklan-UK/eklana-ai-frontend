"use client";

import React, { useMemo } from "react";
import { AlertCircle, Volume2, TrendingDown } from "lucide-react";
import { useLearnerPronunciationAnalytics } from "@/hooks/usePronunciations";

interface ChallengingWordsComponentProps {
  learnerId: string;
  learnerName?: string;
}

/**
 * Component to display words the learner is struggling with
 * Based on pronunciation analytics
 */
export function ChallengingWordsComponent({
  learnerId,
  learnerName = "Learner",
}: ChallengingWordsComponentProps) {
  const {
    data: analytics,
    isLoading,
    error,
  } = useLearnerPronunciationAnalytics(learnerId);

  // Extract data with safe defaults (must be before conditional returns)
  const wordStats = analytics?.wordStats || [];
  
  // Memoize challenging words calculation to avoid recalculating on every render
  // Must be called before any conditional returns
  const challengingWords = useMemo(() => {
    return wordStats
      .filter((word: any) => {
        const isLowScore = word.bestScore < 70;
        const hasManyAttempts = word.attempts > 3;
        const isChallenging = word.isChallenging || word.status !== 'completed';
        return (isLowScore || hasManyAttempts || isChallenging) && word.attempts > 0;
      })
      .sort((a: any, b: any) => {
        // Sort by worst score first, then by attempts
        if (a.bestScore !== b.bestScore) {
          return (a.bestScore || 0) - (b.bestScore || 0);
        }
        return b.attempts - a.attempts;
      })
      .slice(0, 10); // Top 10 most challenging
  }, [wordStats]);

  // Conditional returns AFTER all hooks
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error || !analytics) {
    return null;
  }

  if (challengingWords.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No challenging words identified</p>
        <p className="text-xs mt-1">Great progress!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingDown className="w-5 h-5 text-orange-500" />
        <h3 className="text-sm font-bold text-gray-900">
          Challenging Words ({challengingWords.length})
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {challengingWords.map((word: any, idx: number) => (
          <div
            key={idx}
            className="border border-orange-200 bg-orange-50 rounded-lg p-4 hover:bg-orange-100 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-gray-900">
                    {word.title || word.text || word.word}
                  </h4>
                  {word.weakPhonemes?.length > 0 && (
                    <Volume2 className="w-4 h-4 text-orange-600" />
                  )}
                </div>
                
                {word.text && word.text !== word.title && (
                  <p className="text-xs text-gray-600 mb-2">{word.text}</p>
                )}

                <div className="flex flex-wrap gap-2 mt-2">
                  {word.weakPhonemes?.slice(0, 3).map((phoneme: string, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-orange-200 text-orange-700 text-xs rounded font-medium"
                    >
                      {phoneme}
                    </span>
                  ))}
                  {word.incorrectLetters?.slice(0, 3).map((letter: string, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-red-200 text-red-700 text-xs rounded font-mono font-bold"
                    >
                      {letter}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-xs text-gray-500 mb-1">Best Score</p>
                <p
                  className={`text-lg font-bold ${
                    word.bestScore >= 70
                      ? "text-green-600"
                      : word.bestScore >= 50
                        ? "text-yellow-600"
                        : "text-red-600"
                  }`}
                >
                  {word.bestScore?.toFixed(0) || 0}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {word.attempts} attempt{word.attempts !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

