export interface AnalyticsDashboardPhonemeProblem {
  phoneme: string;
  count: number;
  words?: Array<{ word: string; count: number }>;
}

export interface AnalyticsDashboardData {
  progress: {
    overallProgressPct: number;
    overallAverageScore: number;
    pendingReviewCount: number;
    drillStats: {
      total: number;
      completed: number;
      completionRatePct: number;
      averageScore: number;
    };
    pronunciationStats: {
      totalWords: number;
      completedWords: number;
      completionRatePct: number;
      averageScore: number;
    };
  };
  drills: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
    pendingReview: number;
    completionRatePct: number;
    averageScore: number;
  };
  pronunciation: {
    overall: {
      totalAttempts: number;
      averageScore: number;
      passRate: number;
      totalWords?: number;
    };
    wordStats?: Array<{
      status?: string;
      isChallenging?: boolean;
    }>;
    problemAreas: {
      topIncorrectPhonemes: AnalyticsDashboardPhonemeProblem[];
    };
  };
  grammar: {
    totalAssignedPatterns: number;
    correctSentence: number;
    incorrectSentence: number;
    attemptsConsidered?: number;
  };
  sentence: {
    totalAssignedTargets: number;
    correctSentence: number;
    incorrectSentence: number;
    attemptsConsidered?: number;
  };
  matching: {
    totalAssignedPairs: number;
    accuracyRatePct: number;
    totalAttempts: number;
    fastMatches: number;
    slowMatches: number;
    slowestMatchSeconds: number | null;
    slowestMatchLabel: string | null;
    hasPairTimingData?: boolean;
    timingAvailableSince?: string | null;
  };
  fillBlank: {
    totalAssignedBlanks: number;
    correctBlanks: number;
    incorrectBlanks: number;
    accuracyRatePct: number;
    totalAttempts: number;
    averageScore: number;
    attemptsConsidered?: number;
  };
  keyPhrases: {
    totalAssignedItems: number;
    correctItems: number;
    incorrectItems: number;
    accuracyRatePct: number;
    totalAttempts: number;
    averageScore: number;
    averagePronunciationScore: number;
    attemptsConsidered?: number;
  };
}
