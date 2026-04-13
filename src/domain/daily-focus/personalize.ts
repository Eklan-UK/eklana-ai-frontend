/**
 * Personalize which DailyFocus to show for "today" using profile goals,
 * drill performance, and pronunciation signals.
 */

export type FocusType =
  | "grammar"
  | "vocabulary"
  | "matching"
  | "pronunciation"
  | "general";

/** Onboarding goal ids → readable labels (see learning-goals page). */
export const LEARNING_GOAL_LABELS: Record<string, string> = {
  conversations: "Speak naturally in conversations",
  professional: "Sound professional at work",
  travel: "Travel confidently",
  interviews: "Prepare for interviews",
};

/**
 * Relative emphasis per focus area for each onboarding goal.
 * Higher = stronger preference when choosing among today's candidates.
 */
const GOAL_FOCUS_WEIGHTS: Record<
  string,
  Partial<Record<FocusType, number>>
> = {
  conversations: {
    general: 4,
    pronunciation: 3,
    grammar: 2,
    vocabulary: 2,
  },
  professional: {
    grammar: 4,
    vocabulary: 3,
    general: 2,
    matching: 1,
  },
  travel: {
    vocabulary: 3,
    general: 4,
    pronunciation: 2,
    grammar: 1,
  },
  interviews: {
    pronunciation: 4,
    grammar: 3,
    vocabulary: 2,
    general: 2,
  },
};

/** Map drill library types to daily focus types. */
export function drillTypeToFocusType(drillType: string): FocusType | null {
  switch (drillType) {
    case "grammar":
      return "grammar";
    case "vocabulary":
    case "definition":
      return "vocabulary";
    case "matching":
      return "matching";
    case "roleplay":
    case "listening":
    case "sentence":
    case "sentence_writing":
      return "pronunciation";
    case "summary":
    case "fill_blank":
    default:
      return "general";
  }
}

export function mergeGoalWeights(
  learningGoalIds: string[] | undefined,
): Partial<Record<FocusType, number>> {
  if (!learningGoalIds?.length) return {};
  const merged: Partial<Record<FocusType, number>> = {};
  for (const id of learningGoalIds) {
    const w = GOAL_FOCUS_WEIGHTS[id];
    if (!w) continue;
    for (const ft of Object.keys(w) as FocusType[]) {
      const v = w[ft];
      if (v == null) continue;
      merged[ft] = (merged[ft] ?? 0) + v;
    }
  }
  return merged;
}

/** Lower recent scores → higher weakness weight for that focus area. */
export function weaknessWeightsFromAvgScores(
  avgScoreByFocus: Partial<Record<FocusType, number>>,
): Partial<Record<FocusType, number>> {
  const out: Partial<Record<FocusType, number>> = {};
  for (const ft of Object.keys(avgScoreByFocus) as FocusType[]) {
    const avg = avgScoreByFocus[ft];
    if (avg == null || Number.isNaN(avg)) continue;
    if (avg < 55) out[ft] = 5;
    else if (avg < 70) out[ft] = 3;
    else if (avg < 80) out[ft] = 1;
  }
  return out;
}

export interface PersonalizationSignals {
  goalWeights: Partial<Record<FocusType, number>>;
  weaknessWeights: Partial<Record<FocusType, number>>;
  /** Added to pronunciation candidate score when learner's pronunciation avg is low. */
  pronunciationBoost: number;
  /** First goal id used for copy (optional). */
  primaryGoalId?: string;
}

export function computePronunciationBoost(averagePronunciationScore: number | null): number {
  if (averagePronunciationScore == null || Number.isNaN(averagePronunciationScore)) {
    return 0;
  }
  if (averagePronunciationScore < 55) return 6;
  if (averagePronunciationScore < 70) return 4;
  if (averagePronunciationScore < 80) return 2;
  return 0;
}

export interface DailyFocusLike {
  _id: unknown;
  focusType: FocusType;
}

export function scoreCandidate(
  focusType: FocusType,
  signals: PersonalizationSignals,
): number {
  const g = signals.goalWeights[focusType] ?? 0;
  const w = signals.weaknessWeights[focusType] ?? 0;
  const p =
    focusType === "pronunciation" ? signals.pronunciationBoost : 0;
  return g * 2 + w * 1.75 + p;
}

export function pickBestDailyFocus<T extends DailyFocusLike>(
  candidates: T[],
  signals: PersonalizationSignals,
): { winner: T | null; scores: Map<string, number> } {
  if (candidates.length === 0) {
    return { winner: null, scores: new Map() };
  }
  const scores = new Map<string, number>();
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const c of candidates) {
    const s = scoreCandidate(c.focusType, signals);
    const id = String(c._id);
    scores.set(id, s);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    } else if (s === bestScore && best && String(c._id) < String(best._id)) {
      best = c;
    }
  }
  return { winner: best, scores };
}

export interface PersonalizationCopyInput {
  winnerFocusType: FocusType;
  signals: PersonalizationSignals;
  hadGoalWeights: boolean;
  hadWeakness: boolean;
  hadPronunciationSignal: boolean;
}

export function buildPersonalizationSummary(
  input: PersonalizationCopyInput,
): { summary: string; signalsUsed: string[] } {
  const signalsUsed: string[] = [];
  const parts: string[] = [];

  if (input.hadGoalWeights && input.signals.primaryGoalId) {
    const label =
      LEARNING_GOAL_LABELS[input.signals.primaryGoalId] ??
      "your learning goals";
    parts.push(`Aligned with ${label.toLowerCase()}`);
    signalsUsed.push("learning_goals");
  }

  if (input.hadWeakness) {
    parts.push("extra practice where your recent drills were toughest");
    signalsUsed.push("drill_performance");
  }

  if (input.hadPronunciationSignal && input.winnerFocusType === "pronunciation") {
    parts.push("emphasis on speaking clarity based on your pronunciation practice");
    signalsUsed.push("pronunciation");
  } else if (input.hadPronunciationSignal && !input.hadWeakness) {
    parts.push("tuned using your pronunciation trends");
    signalsUsed.push("pronunciation");
  }

  if (parts.length === 0) {
    return {
      summary: `Today's focus: ${input.winnerFocusType} practice.`,
      signalsUsed: [],
    };
  }

  const summary = parts.join(" · ") + ".";
  return { summary, signalsUsed };
}
