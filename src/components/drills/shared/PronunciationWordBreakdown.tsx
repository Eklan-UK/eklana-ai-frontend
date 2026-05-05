"use client";

import type { WordScore } from "@/services/speechace.service";

export type PronunciationBreakdownVariant = "analytics" | "review";

interface PronunciationWordBreakdownProps {
  wordScore: WordScore;
  variant?: PronunciationBreakdownVariant;
  /** When true, shows the word heading (review per-word blocks). */
  showWordLabel?: boolean;
}

const PHONEME_GOOD = 80;
const PHONEME_OK = 70;

function syllableScoreColor(score: number, variant: PronunciationBreakdownVariant) {
  if (variant === "review") {
    if (score >= PHONEME_GOOD) return "text-emerald-700";
    if (score >= PHONEME_OK) return "text-amber-700";
    return "text-red-600";
  }
  if (score >= 80) return "text-green-600";
  if (score >= 70) return "text-yellow-600";
  return "text-red-600";
}

function phonemePillClass(score: number, variant: PronunciationBreakdownVariant) {
  if (variant === "review") {
    if (score >= PHONEME_GOOD) return "bg-emerald-100 text-emerald-800 border border-emerald-200/80";
    if (score >= PHONEME_OK) return "bg-amber-50 text-amber-800 border border-amber-200/80";
    return "bg-rose-50 text-rose-700 border border-rose-200/80";
  }
  if (score >= 80) return "bg-green-100 text-green-600";
  if (score >= 70) return "bg-yellow-100 text-yellow-600";
  return "bg-red-100 text-red-600";
}

/**
 * Syllable / phoneme / “letter” views for one scored word.
 * Letter-level row is best-effort from syllable `letters` + syllable scores (no letter_score_list in API yet).
 */
export function PronunciationWordBreakdown({
  wordScore,
  variant = "analytics",
  showWordLabel = false,
}: PronunciationWordBreakdownProps) {
  const syllables = wordScore.syllable_score_list;
  const phonemes = wordScore.phone_score_list;
  const isReview = variant === "review";

  return (
    <div className={isReview ? "space-y-3" : ""}>
      {showWordLabel && (
        <p className="text-sm font-semibold text-foreground">{wordScore.word}</p>
      )}

      {syllables && syllables.length > 0 && (
        <div className={isReview ? "" : "mb-4"}>
          <h4
            className={
              isReview
                ? "text-xs font-medium text-muted-foreground mb-1.5"
                : "text-xs font-semibold text-foreground mb-2"
            }
          >
            Syllables
          </h4>
          <div
            className={
              isReview
                ? "flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5"
                : "flex gap-2 flex-wrap"
            }
          >
            {syllables.map((syllable, idx) => (
              <div
                key={idx}
                className={
                  isReview
                    ? "shrink-0 min-w-[72px] rounded-lg border border-border bg-muted/90 px-2.5 py-2"
                    : "flex-1 min-w-[80px] p-2 bg-muted rounded-lg"
                }
              >
                <p className="text-xs font-medium text-foreground mb-1">{syllable.letters}</p>
                <div
                  className={
                    isReview
                      ? "flex flex-col gap-0.5"
                      : "flex items-center justify-between"
                  }
                >
                  <span
                    className={`text-xs font-bold ${syllableScoreColor(syllable.quality_score, variant)}`}
                  >
                    {Math.round(syllable.quality_score)}
                  </span>
                  {syllable.stress_level !== null && (
                    <span
                      className={
                        isReview ? "text-[10px] text-muted-foreground" : "text-xs text-muted-foreground"
                      }
                    >
                      {isReview ? "stress: " : "Stress: "}
                      {syllable.stress_level}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {phonemes && phonemes.length > 0 && (
        <div>
          <h4
            className={
              isReview
                ? "text-xs font-medium text-muted-foreground mb-1.5"
                : "text-xs font-semibold text-foreground mb-2"
            }
          >
            Phonemes
          </h4>
          <div className="flex gap-1.5 flex-wrap">
            {phonemes.map((phone, idx) => (
              <div
                key={idx}
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${phonemePillClass(phone.quality_score, variant)}`}
                title={`${phone.phone}: ${Math.round(phone.quality_score)}%`}
              >
                {phone.phone}
                <span className={isReview ? "ml-1 text-[11px] tabular-nums" : "ml-1 text-[10px]"}>
                  {Math.round(phone.quality_score)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best-effort: syllable letters + scores until API exposes letter_score_list */}
      {isReview && syllables && syllables.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Letter level Feedback</h4>
          <div className="flex gap-1.5 flex-wrap">
            {syllables.map((syllable, idx) => (
              <div
                key={idx}
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${phonemePillClass(syllable.quality_score, variant)}`}
                title={`${syllable.letters}: ${Math.round(syllable.quality_score)}%`}
              >
                {syllable.letters}
                <span className="ml-1 text-[11px] tabular-nums">{Math.round(syllable.quality_score)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
