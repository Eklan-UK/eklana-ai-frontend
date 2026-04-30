"use client";

import {
  DrillPerformanceReview,
  type PerformanceReviewAnalyticsRow,
  type PerformanceReviewGroup,
} from "./DrillPerformanceReview";

export type RoleplayReviewAnalyticsRow = PerformanceReviewAnalyticsRow;
export type RoleplayReviewSceneGroup = PerformanceReviewGroup;

interface RoleplayPerformanceReviewProps {
  avgScore: number;
  statsLine: string;
  sceneGroups: RoleplayReviewSceneGroup[];
  passThreshold: number;
  onDone: () => void;
  onPracticeAgain: () => void;
  isSubmitting: boolean;
}

export function RoleplayPerformanceReview({
  avgScore,
  statsLine,
  sceneGroups,
  passThreshold,
  onDone,
  onPracticeAgain,
  isSubmitting,
}: RoleplayPerformanceReviewProps) {
  return (
    <DrillPerformanceReview
      avgScore={avgScore}
      statsLine={statsLine}
      groups={sceneGroups}
      passThreshold={passThreshold}
      sectionHeading="Scene-by-Scene Analysis"
      onDone={onDone}
      onPracticeAgain={onPracticeAgain}
      isSubmitting={isSubmitting}
    />
  );
}
