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
  viewMode?: "student" | "viewer";
  onClose?: () => void;
  onDone: () => void;
  onPracticeAgain: () => void;
  isSubmitting: boolean;
}

export function RoleplayPerformanceReview({
  avgScore,
  statsLine,
  sceneGroups,
  passThreshold,
  viewMode = "student",
  onClose,
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
      viewMode={viewMode}
      onClose={onClose}
      onDone={onDone}
      onPracticeAgain={onPracticeAgain}
      isSubmitting={isSubmitting}
    />
  );
}
