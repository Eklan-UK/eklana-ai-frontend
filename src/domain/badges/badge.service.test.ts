import { BADGE_DEFINITIONS } from './badge.definitions';
import { __test__ } from './badge.service';
import type { BadgeView } from './badge.types';

const {
  longestConsecutiveQualifyingDays,
  pickFeaturedBadge,
  toBadgeView,
  MIN_PRACTICE_SECONDS,
  SEVEN_DAY_TARGET,
} = __test__;

describe('badge.service helpers', () => {
  describe('longestConsecutiveQualifyingDays', () => {
    it('returns met when 7 consecutive days meet the minutes threshold', () => {
      const map = new Map<string, number>();
      for (let i = 0; i < 7; i++) {
        map.set(`2026-06-${String(10 + i).padStart(2, '0')}`, MIN_PRACTICE_SECONDS);
      }

      const result = longestConsecutiveQualifyingDays(
        map,
        MIN_PRACTICE_SECONDS,
        SEVEN_DAY_TARGET
      );
      expect(result.met).toBe(true);
    });

    it('returns not met when days are below the minutes threshold', () => {
      const map = new Map<string, number>([
        ['2026-06-10', 60],
        ['2026-06-11', 120],
      ]);

      const result = longestConsecutiveQualifyingDays(
        map,
        MIN_PRACTICE_SECONDS,
        SEVEN_DAY_TARGET
      );
      expect(result.met).toBe(false);
      expect(result.currentRun).toBe(0);
    });
  });

  describe('pickFeaturedBadge', () => {
    it('picks the most recently unlocked badge', () => {
      const badges: BadgeView[] = BADGE_DEFINITIONS.map((def, i) =>
        toBadgeView(
          def,
          i < 2
            ? {
                badgeId: def.badgeId,
                badgeName: def.badgeName,
                unlockedAt: new Date(`2026-06-${10 + i}T12:00:00.000Z`),
              }
            : undefined,
          null
        )
      );

      const featured = pickFeaturedBadge(badges);
      expect(featured.badgeId).toBe('seven-day-stretch');
    });

    it('falls back to first locked badge when none unlocked', () => {
      const badges: BadgeView[] = BADGE_DEFINITIONS.map((def) =>
        toBadgeView(def, undefined, { current: 0, target: 1 })
      );

      const featured = pickFeaturedBadge(badges);
      expect(featured.badgeId).toBe('first-steps');
      expect(featured.unlocked).toBe(false);
    });
  });
});
