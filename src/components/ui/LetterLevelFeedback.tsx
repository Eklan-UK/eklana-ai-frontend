"use client";

import { Card } from "./Card";
import { AlertCircle, CheckCircle } from "lucide-react";
import type {
  TextScore,
  WordScore,
  PhoneScore,
} from "@/services/speechace.service";

interface LetterLevelFeedbackProps {
  word: string;
  wordScore: WordScore;
  incorrectLetters?: string[];
}

export function LetterLevelFeedback({
  word,
  wordScore,
  incorrectLetters = [],
}: LetterLevelFeedbackProps) {
  const getLetterColor = (letter: string, score: number) => {
    if (incorrectLetters.includes(letter.toLowerCase())) {
      return "text-red-600";
    }
    if (score >= 80) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getLetterBgColor = (letter: string, score: number) => {
    if (incorrectLetters.includes(letter.toLowerCase())) {
      return "bg-red-100";
    }
    if (score >= 80) return "bg-green-100";
    if (score >= 70) return "bg-yellow-100";
    return "bg-red-100";
  };

  // Map phoneme scores to letters based on word_extent
  const lettersWithScores = word.split("").map((letter, index) => {
    const relevantPhoneScores = wordScore.phone_score_list.filter((phone) => {
      // Check if the letter's index falls within the phone's word_extent
      return index >= phone.word_extent[0] && index < phone.word_extent[1];
    });

    // Average the quality scores of relevant phonemes for this letter
    const avgScore =
      relevantPhoneScores.length > 0
        ? relevantPhoneScores.reduce(
            (sum, phone) => sum + phone.quality_score,
            0
          ) / relevantPhoneScores.length
        : 0; // Default to 0 if no relevant phonemes

    return {
      letter,
      score: avgScore,
      isIncorrect: incorrectLetters.includes(letter.toLowerCase()),
    };
  });

  return (
    <Card className="mb-4">
      <h3 className="text-base font-semibold text-gray-900 mb-3">
        Letter-level Feedback
      </h3>
      <div className="flex flex-wrap gap-1 mb-4">
        {lettersWithScores.map((item, idx) => (
          <span
            key={idx}
            className={`px-2 py-1 rounded text-sm font-medium ${getLetterBgColor(
              item.letter,
              item.score
            )} ${getLetterColor(item.letter, item.score)}`}
            title={`Letter: ${item.letter}, Score: ${Math.round(item.score)}%`}
          >
            {item.letter}
            <span className="ml-1 text-[10px]">{Math.round(item.score)}</span>
          </span>
        ))}
      </div>

      {incorrectLetters.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">
            Letters to practice:
          </p>
          <div className="flex flex-wrap gap-2">
            {incorrectLetters.map((letter, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
              >
                {letter}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
