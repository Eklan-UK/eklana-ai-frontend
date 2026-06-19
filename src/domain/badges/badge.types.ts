export type BadgeId =
  | 'first-steps'
  | 'seven-day-stretch'
  | 'done-and-dusted'
  | 'deja-vu'
  | 'monthly-challenge'
  | 'master-collector'
  | 'medication-master'
  | 'handover-hero'
  | 'nightingale-award'
  | 'skill-keeper';

export interface BadgeDefinition {
  badgeId: BadgeId;
  badgeName: string;
  icon: string;
  sortOrder: number;
  beforeDescription: string;
  afterOutcome: string;
  humorousLine: string;
}

export interface BadgeProgress {
  current: number;
  target: number;
}

export interface StoredBadge {
  badgeId: string;
  badgeName: string;
  unlockedAt: Date;
  milestone?: number;
}

export interface BadgeView extends BadgeDefinition {
  unlocked: boolean;
  unlockedAt: string | null;
  progress: BadgeProgress | null;
}

export interface BadgeStateResponse {
  badges: BadgeView[];
  featuredBadge: BadgeView;
}
