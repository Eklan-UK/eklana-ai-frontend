import type { BadgeUnlockCelebration } from '@/lib/badges/badge-unlock';
import { extractBadgesUnlocked } from '@/lib/badges/badge-unlock';

type CelebrateHandler = (badges: BadgeUnlockCelebration[]) => void;

let handler: CelebrateHandler | null = null;

export function registerBadgeUnlockHandler(next: CelebrateHandler | null) {
  handler = next;
}

export function celebrateBadgeUnlock(
  badges: BadgeUnlockCelebration | BadgeUnlockCelebration[],
) {
  const list = Array.isArray(badges) ? badges : [badges];
  if (list.length === 0) return;
  handler?.(list);
}

export function celebrateBadgesFromApiResponse(response: unknown) {
  const badges = extractBadgesUnlocked(response);
  if (badges.length > 0) {
    celebrateBadgeUnlock(badges);
  }
}
