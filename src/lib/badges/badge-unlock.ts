import { BADGE_BY_ID } from '@/domain/badges/badge.definitions';
import type { BadgeDefinition, BadgeId } from '@/domain/badges/badge.types';

export type BadgeUnlockCelebration = Pick<
  BadgeDefinition,
  'badgeId' | 'badgeName' | 'icon' | 'afterOutcome' | 'humorousLine'
>;

export function badgeIdsToCelebrations(ids: BadgeId[]): BadgeUnlockCelebration[] {
  const celebrations: BadgeUnlockCelebration[] = [];
  for (const id of ids) {
    const def = BADGE_BY_ID.get(id);
    if (!def) continue;
    celebrations.push({
      badgeId: def.badgeId,
      badgeName: def.badgeName,
      icon: def.icon,
      afterOutcome: def.afterOutcome,
      humorousLine: def.humorousLine,
    });
  }
  return celebrations;
}

function isCelebration(value: unknown): value is BadgeUnlockCelebration {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.badgeId === 'string' &&
    typeof v.badgeName === 'string' &&
    typeof v.icon === 'string'
  );
}

function normalizeCelebration(value: unknown): BadgeUnlockCelebration | null {
  if (isCelebration(value)) return value;
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.badgeId !== 'string') return null;
  const def = BADGE_BY_ID.get(v.badgeId as BadgeId);
  if (!def) return null;
  return {
    badgeId: def.badgeId,
    badgeName: def.badgeName,
    icon: def.icon,
    afterOutcome: def.afterOutcome,
    humorousLine: def.humorousLine,
  };
}

/** Extract badge unlock payloads from varied API response shapes. */
export function extractBadgesUnlocked(response: unknown): BadgeUnlockCelebration[] {
  if (!response || typeof response !== 'object') return [];

  const root = response as Record<string, unknown>;
  const data =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root;

  const fromArray = data.badgesUnlocked;
  if (Array.isArray(fromArray)) {
    return fromArray
      .map((item) => normalizeCelebration(item))
      .filter((item): item is BadgeUnlockCelebration => item !== null);
  }

  const legacy = normalizeCelebration(data.badgeUnlocked ?? root.badgeUnlocked);
  return legacy ? [legacy] : [];
}
