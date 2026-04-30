"use client";

import { Card } from "@/components/ui/Card";
import type { TextScore, WordScore } from "@/services/speechace.service";
import { PronunciationWordBreakdown } from "./PronunciationWordBreakdown";

interface WordAnalyticsProps {
  pronunciationScore: TextScore;
}

function ScoreIndicator({
  score,
  size = "md",
  threshold = { good: 80, ok: 70 },
}: {
  score: number;
  size?: "sm" | "md" | "lg";
  threshold?: { good: number; ok: number };
}) {
  const sizeClasses = {
    sm: "w-10 h-10 text-sm",
    md: "w-14 h-14 text-lg",
    lg: "w-16 h-16 text-2xl",
  };

  const getColorClasses = (score: number) => {
    if (score >= threshold.good) return "bg-green-100 text-green-600";
    if (score >= threshold.ok) return "bg-yellow-100 text-yellow-600";
    return "bg-red-100 text-red-600";
  };

  return (
    <div
      className={`${sizeClasses[size]} ${getColorClasses(score)} rounded-full flex items-center justify-center font-bold`}
    >
      {Math.round(score)}
    </div>
  );
}

function WordScoreCard({ wordScore, index }: { wordScore: WordScore; index: number }) {
  return (
    <Card key={index}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{wordScore.word}</h3>
          <p className="text-xs text-gray-500">Word Quality Score</p>
        </div>
        <ScoreIndicator score={wordScore.quality_score} />
      </div>

      <PronunciationWordBreakdown wordScore={wordScore} variant="analytics" />
    </Card>
  );
}

/**
 * Displays detailed word-by-word pronunciation analytics
 * Extracted from VocabularyDrill to reduce component size
 */
export function WordAnalytics({ pronunciationScore }: WordAnalyticsProps) {
  const score = pronunciationScore.speechace_score.pronunciation;
  const passed = score >= 65;

  return (
    <div className="mb-4 space-y-4">
      {/* Overall Score Indicator */}
      <Card className="bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
        <div className="text-center py-4">
          <div className="flex items-center justify-center gap-3 mb-2">
            <ScoreIndicator score={score} size="lg" threshold={{ good: 65, ok: 50 }} />
            <div className="text-left">
              <p className="text-sm font-medium text-gray-600">Pronunciation Score</p>
              <p className="text-xs text-gray-500">{passed ? "✓ Passed" : "Need 65% to pass"}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Word Quality Analytics */}
      {pronunciationScore.word_score_list.map((wordScore, idx) => (
        <WordScoreCard key={idx} wordScore={wordScore} index={idx} />
      ))}

      {/* Pass/Fail Message */}
      {!passed && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 text-center">You need at least 65% to pass. Try again!</p>
        </div>
      )}
    </div>
  );
}
