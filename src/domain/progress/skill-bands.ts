/**
 * Client mapping of scorecard 0–100 scores to Figma communicator bands.
 * Shared contract for web My Progress and the mobile companion app.
 */

export type SkillBandId =
  | "emerging"
  | "developing"
  | "effective"
  | "confident"
  | "authoritative";

/** Overall badge from the 4-metric average. */
export type OverallSkillBadge = "learner" | "skilled" | "advanced" | "mastery";

export interface SkillBand {
  id: SkillBandId;
  /** e.g. "Emerging Communicator" */
  label: string;
  /** Next overall badge name, or null at Mastery. */
  nextLabel: string | null;
  nextThreshold: number | null;
  /** Points needed to reach the next threshold (0 at Mastery). */
  pointsToNext: number;
}

const BANDS: ReadonlyArray<{
  max: number;
  id: SkillBandId;
  label: string;
  nextLabel: string | null;
  nextThreshold: number | null;
}> = [
  {
    max: 40,
    id: "emerging",
    label: "Emerging Communicator",
    nextLabel: "Learner",
    nextThreshold: 40,
  },
  {
    max: 60,
    id: "developing",
    label: "Developing Communicator",
    nextLabel: "Skilled",
    nextThreshold: 60,
  },
  {
    max: 75,
    id: "effective",
    label: "Effective Communicator",
    nextLabel: "Advanced",
    nextThreshold: 75,
  },
  {
    max: 90,
    id: "confident",
    label: "Confident Communicator",
    nextLabel: "Mastery",
    nextThreshold: 90,
  },
];

const AUTHORITATIVE: SkillBand = {
  id: "authoritative",
  label: "Authoritative Communicator",
  nextLabel: null,
  nextThreshold: null,
  pointsToNext: 0,
};

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

export function getSkillBand(score: number): SkillBand {
  const n = clampScore(score);
  for (const band of BANDS) {
    if (n < band.max) {
      return {
        id: band.id,
        label: band.label,
        nextLabel: band.nextLabel,
        nextThreshold: band.nextThreshold,
        pointsToNext: Math.max(0, band.max - Math.round(n)),
      };
    }
  }
  return AUTHORITATIVE;
}

export function getOverallSkillBadge(average: number): OverallSkillBadge {
  const n = clampScore(average);
  if (n < 40) return "learner";
  if (n < 75) return "skilled";
  if (n < 90) return "advanced";
  return "mastery";
}

const OVERALL_LABELS: Record<OverallSkillBadge, string> = {
  learner: "Learner",
  skilled: "Skilled",
  advanced: "Advanced",
  mastery: "Mastery",
};

export function overallSkillBadgeLabel(badge: OverallSkillBadge): string {
  return OVERALL_LABELS[badge];
}

/** 10-segment bars: `round(score / 10)` filled ticks, clamped 0–10. */
export function skillBarTicks(score: number): number {
  return Math.max(0, Math.min(10, Math.round(clampScore(score) / 10)));
}

export function averageSkillScore(metrics: {
  pronunciation: number;
  accuracy: number;
  fluency: number;
  confidence: number;
}): number {
  return (
    (clampScore(metrics.pronunciation) +
      clampScore(metrics.accuracy) +
      clampScore(metrics.fluency) +
      clampScore(metrics.confidence)) /
    4
  );
}

export function formatTimePracticed(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0m";
  const m = Math.round(totalSeconds / 60);
  if (m < 1) return "<1m";
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r > 0 ? `${h}h ${r}m` : `${h}h`;
  }
  return `${m}m`;
}
