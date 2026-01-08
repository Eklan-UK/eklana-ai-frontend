"use client";

import { Card } from "@/components/ui/Card";
import type { TextScore, WordScore } from "@/services/speechace.service";

interface WordAnalyticsProps {
  pronunciationScore: TextScore;
}

function ScoreIndicator({ 
  score, 
  size = "md",
  threshold = { good: 80, ok: 70 }
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

function SyllableBreakdown({ syllables }: { syllables: WordScore["syllable_score_list"] }) {
  if (!syllables || syllables.length === 0) return null;

  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-gray-700 mb-2">Syllables</h4>
      <div className="flex gap-2 flex-wrap">
        {syllables.map((syllable, idx) => (
          <div
            key={idx}
            className="flex-1 min-w-[80px] p-2 bg-gray-50 rounded-lg"
          >
            <p className="text-xs font-medium text-gray-900 mb-1">
              {syllable.letters}
            </p>
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold ${
                  syllable.quality_score >= 80
                    ? "text-green-600"
                    : syllable.quality_score >= 70
                    ? "text-yellow-600"
                    : "text-red-600"
                }`}
              >
                {Math.round(syllable.quality_score)}
              </span>
              {syllable.stress_level !== null && (
                <span className="text-xs text-gray-500">
                  Stress: {syllable.stress_level}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhonemeBreakdown({ phonemes }: { phonemes: WordScore["phone_score_list"] }) {
  if (!phonemes || phonemes.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-700 mb-2">Phonemes</h4>
      <div className="flex gap-1 flex-wrap">
        {phonemes.map((phone, idx) => (
          <div
            key={idx}
            className={`px-2 py-1 rounded text-xs font-medium ${
              phone.quality_score >= 80
                ? "bg-green-100 text-green-600"
                : phone.quality_score >= 70
                ? "bg-yellow-100 text-yellow-600"
                : "bg-red-100 text-red-600"
            }`}
            title={`${phone.phone}: ${Math.round(phone.quality_score)}%`}
          >
            {phone.phone}
            <span className="ml-1 text-[10px]">
              {Math.round(phone.quality_score)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WordScoreCard({ wordScore, index }: { wordScore: WordScore; index: number }) {
  return (
    <Card key={index}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            {wordScore.word}
          </h3>
          <p className="text-xs text-gray-500">Word Quality Score</p>
        </div>
        <ScoreIndicator score={wordScore.quality_score} />
      </div>

      <SyllableBreakdown syllables={wordScore.syllable_score_list} />
      <PhonemeBreakdown phonemes={wordScore.phone_score_list} />
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
            <ScoreIndicator 
              score={score} 
              size="lg" 
              threshold={{ good: 65, ok: 50 }} 
            />
            <div className="text-left">
              <p className="text-sm font-medium text-gray-600">
                Pronunciation Score
              </p>
              <p className="text-xs text-gray-500">
                {passed ? "✓ Passed" : "Need 65% to pass"}
              </p>
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
          <p className="text-sm text-yellow-800 text-center">
            You need at least 65% to pass. Try again!
          </p>
        </div>
      )}
    </div>
  );
}

