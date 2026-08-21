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
  /** Next communicator band name, or null at Authoritative. */
  nextLabel: string | null;
  nextThreshold: number | null;
  /** Points needed to reach the next threshold (0 at Authoritative). */
  pointsToNext: number;
  /** Previous communicator band name, or null at Emerging. */
  prevLabel: string | null;
  /** Points to the previous band boundary (0 at Emerging). */
  pointsToPrev: number;
}

export type SkillTransitionKind = "up" | "down" | "max";

export interface SkillTransition {
  kind: SkillTransitionKind;
  points: number;
  label: string | null;
}

/** Same threshold as `deriveTrend` in progress-scorecard.service.ts. */
const DECLINE_WEEKLY_CHANGE = -3;

const BANDS: ReadonlyArray<{
  max: number;
  id: SkillBandId;
  label: string;
  nextLabel: string | null;
  nextThreshold: number | null;
  prevLabel: string | null;
  prevMax: number | null;
}> = [
  {
    max: 40,
    id: "emerging",
    label: "Emerging Communicator",
    nextLabel: "Developing Communicator",
    nextThreshold: 40,
    prevLabel: null,
    prevMax: null,
  },
  {
    max: 60,
    id: "developing",
    label: "Developing Communicator",
    nextLabel: "Effective Communicator",
    nextThreshold: 60,
    prevLabel: "Emerging Communicator",
    prevMax: 40,
  },
  {
    max: 75,
    id: "effective",
    label: "Effective Communicator",
    nextLabel: "Confident Communicator",
    nextThreshold: 75,
    prevLabel: "Developing Communicator",
    prevMax: 60,
  },
  {
    max: 90,
    id: "confident",
    label: "Confident Communicator",
    nextLabel: "Authoritative Communicator",
    nextThreshold: 90,
    prevLabel: "Effective Communicator",
    prevMax: 75,
  },
];

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

/** Distance down to the previous band’s last inclusive score (`prevMax - 1`). */
function pointsToPrevBand(rounded: number, prevMax: number | null): number {
  if (prevMax == null) return 0;
  return Math.max(0, rounded - (prevMax - 1));
}

export function getSkillBand(score: number): SkillBand {
  const n = clampScore(score);
  const rounded = Math.round(n);
  for (const band of BANDS) {
    if (n < band.max) {
      return {
        id: band.id,
        label: band.label,
        nextLabel: band.nextLabel,
        nextThreshold: band.nextThreshold,
        pointsToNext: Math.max(0, band.max - rounded),
        prevLabel: band.prevLabel,
        pointsToPrev: pointsToPrevBand(rounded, band.prevMax),
      };
    }
  }
  return {
    id: "authoritative",
    label: "Authoritative Communicator",
    nextLabel: null,
    nextThreshold: null,
    pointsToNext: 0,
    prevLabel: "Confident Communicator",
    pointsToPrev: pointsToPrevBand(rounded, 90),
  };
}

/**
 * Footer arrow for a skill row: next communicator on increase, previous on
 * decline (weeklyChange ≤ −3). Emerging has no lower band, so decline still
 * points up. Authoritative with no decline is the max level.
 */
export function getSkillTransition(
  score: number,
  weeklyChange: number,
): SkillTransition {
  const band = getSkillBand(score);
  const declining =
    Number.isFinite(weeklyChange) && weeklyChange <= DECLINE_WEEKLY_CHANGE;

  if (declining && band.prevLabel && band.pointsToPrev > 0) {
    return { kind: "down", points: band.pointsToPrev, label: band.prevLabel };
  }
  if (band.nextLabel && band.pointsToNext > 0) {
    return { kind: "up", points: band.pointsToNext, label: band.nextLabel };
  }
  return { kind: "max", points: 0, label: null };
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
