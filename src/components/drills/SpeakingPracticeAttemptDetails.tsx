"use client";

import { Card } from "@/components/ui/Card";

export type SpeakingWordScore = {
  word: string;
  score: number;
  attempts: number;
  pronunciationScore?: number;
};

export type SpeakingSceneScore = {
  sceneName: string;
  score: number;
  fluencyScore?: number;
  pronunciationScore?: number;
};

export type SpeakingAttemptSlice = {
  vocabularyResults?: { wordScores?: SpeakingWordScore[] };
  pronunciationResults?: { wordScores?: SpeakingWordScore[] };
  roleplayResults?: { sceneScores?: SpeakingSceneScore[] };
};

interface SpeakingPracticeAttemptDetailsProps {
  drillType: string;
  attempt: SpeakingAttemptSlice | null | undefined;
  /** e.g. student completed page uses larger headings */
  variant?: "default" | "compact";
  className?: string;
}

/**
 * Per-word / per-scene breakdown for speaking drills (vocabulary, pronunciation, roleplay).
 * Mirrors the student "Detailed Results" preview on the drill completed page.
 */
export function SpeakingPracticeAttemptDetails({
  drillType,
  attempt,
  variant = "default",
  className = "",
}: SpeakingPracticeAttemptDetailsProps) {
  if (!attempt) return null;

  const compact = variant === "compact";
  const titleClass = compact ? "text-xs font-semibold text-gray-800 mb-2" : "text-lg font-semibold text-gray-900 mb-4";

  if (drillType === "vocabulary" && attempt.vocabularyResults?.wordScores?.length) {
    const wordScores = attempt.vocabularyResults.wordScores;
    return (
      <div className={`space-y-3 ${className}`}>
        <h3 className={titleClass}>Word scores</h3>
        <div className={compact ? "space-y-2" : "grid grid-cols-1 md:grid-cols-2 gap-3"}>
          {wordScores.map((wordScore, idx) => (
            <Card key={idx} className={compact ? "p-3" : "p-4"}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{wordScore.word}</p>
                  <p className="text-xs text-gray-500">Attempts: {wordScore.attempts}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-bold text-emerald-600 ${compact ? "text-sm" : "text-lg"}`}>
                    {wordScore.score}%
                  </p>
                  {wordScore.pronunciationScore !== undefined && (
                    <p className="text-xs text-gray-500">Pronunciation: {wordScore.pronunciationScore}%</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (drillType === "pronunciation" && attempt.pronunciationResults?.wordScores?.length) {
    const wordScores = attempt.pronunciationResults.wordScores;
    return (
      <div className={`space-y-3 ${className}`}>
        <h3 className={titleClass}>Word scores</h3>
        <div className={compact ? "space-y-2" : "grid grid-cols-1 md:grid-cols-2 gap-3"}>
          {wordScores.map((wordScore, idx) => (
            <Card key={idx} className={compact ? "p-3" : "p-4"}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{wordScore.word}</p>
                  <p className="text-xs text-gray-500">Attempts: {wordScore.attempts}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-bold text-emerald-600 ${compact ? "text-sm" : "text-lg"}`}>
                    {wordScore.score}%
                  </p>
                  {wordScore.pronunciationScore !== undefined && (
                    <p className="text-xs text-gray-500">Pronunciation: {wordScore.pronunciationScore}%</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (drillType === "roleplay" && attempt.roleplayResults?.sceneScores?.length) {
    const sceneScores = attempt.roleplayResults.sceneScores;
    return (
      <div className={`space-y-3 ${className}`}>
        <h3 className={titleClass}>Scene scores</h3>
        <div className="space-y-2">
          {sceneScores.map((scene, idx) => (
            <Card key={idx} className={compact ? "p-3" : "p-4"}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="font-semibold text-gray-900 truncate">{scene.sceneName}</p>
                <p className={`font-bold text-emerald-600 shrink-0 ${compact ? "text-sm" : "text-lg"}`}>
                  {scene.score}%
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                {scene.fluencyScore !== undefined && <span>Fluency: {scene.fluencyScore}%</span>}
                {scene.pronunciationScore !== undefined && (
                  <span>Pronunciation: {scene.pronunciationScore}%</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
