/**
 * Focused badge unlock criteria tests (no live Mongo).
 *
 * Run: node --import tsx --test src/domain/badges/badge-unlock-criteria.test.ts
 * Or:  npm run test:badges
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { toUserIdQuery } from '@/lib/api/user-id';
import { __test__ } from './badge.service';

const {
  masterCollectorFromBookmarkCount,
  doneAndDustedFromWeekAssignments,
  skillKeeperFromFirstCompletionCount,
  handoverHeroFromPassingCount,
  HANDOVER_HERO_SCENARIO_TYPES,
  medicationMasterFromUniqueWordCount,
  firstStepsFromPassingCounts,
  userStreakReadFilter,
  userStreakWriteFilter,
} = __test__;

const UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const OBJECT_ID_HEX = '507f1f77bcf86cd799439011';

describe('masterCollectorFromBookmarkCount', () => {
  it('earns with any drill bookmark count ≥ 1', () => {
    const result = masterCollectorFromBookmarkCount(1);
    assert.equal(result.earned, true);
    assert.equal(result.progress, null);
  });

  it('earns with multiple bookmarks (difficulty-agnostic)', () => {
    const result = masterCollectorFromBookmarkCount(3);
    assert.equal(result.earned, true);
    assert.equal(result.progress, null);
  });

  it('stays locked with zero bookmarks and progress 0/1', () => {
    const result = masterCollectorFromBookmarkCount(0);
    assert.equal(result.earned, false);
    assert.deepEqual(result.progress, { current: 0, target: 1 });
  });
});

describe('doneAndDustedFromWeekAssignments', () => {
  it('stays locked when the week has no assignments', () => {
    const result = doneAndDustedFromWeekAssignments([]);
    assert.equal(result.earned, false);
    assert.deepEqual(result.progress, { current: 0, target: 1 });
  });

  it('earns when every assignment is completed', () => {
    const result = doneAndDustedFromWeekAssignments([
      'completed',
      'completed',
      'completed',
    ]);
    assert.equal(result.earned, true);
    assert.equal(result.progress, null);
  });

  it('stays locked with mixed progress and reports completed/total', () => {
    const result = doneAndDustedFromWeekAssignments([
      'completed',
      'in_progress',
      'assigned',
      'completed',
    ]);
    assert.equal(result.earned, false);
    assert.deepEqual(result.progress, { current: 2, target: 4 });
  });
});

describe('skillKeeperFromFirstCompletionCount', () => {
  it('stays locked at 0', () => {
    const result = skillKeeperFromFirstCompletionCount(0);
    assert.equal(result.earned, false);
    assert.deepEqual(result.progress, { current: 0, target: 1 });
  });

  it('earns at ≥ 1', () => {
    assert.equal(skillKeeperFromFirstCompletionCount(1).earned, true);
    assert.equal(skillKeeperFromFirstCompletionCount(1).progress, null);
    assert.equal(skillKeeperFromFirstCompletionCount(5).earned, true);
  });
});

describe('handoverHeroFromPassingCount', () => {
  it('includes both handover and handover_receive scenario types', () => {
    assert.ok(HANDOVER_HERO_SCENARIO_TYPES.includes('handover'));
    assert.ok(HANDOVER_HERO_SCENARIO_TYPES.includes('handover_receive'));
    assert.equal(HANDOVER_HERO_SCENARIO_TYPES.length, 2);
  });

  it('stays locked at 0 passing attempts', () => {
    const result = handoverHeroFromPassingCount(0);
    assert.equal(result.earned, false);
    assert.deepEqual(result.progress, { current: 0, target: 1 });
  });

  it('earns at ≥ 1 passing attempt', () => {
    const result = handoverHeroFromPassingCount(1);
    assert.equal(result.earned, true);
    assert.equal(result.progress, null);
  });
});

describe('medicationMasterFromUniqueWordCount', () => {
  it('stays locked below 50 with current/target progress', () => {
    const result = medicationMasterFromUniqueWordCount(49);
    assert.equal(result.earned, false);
    assert.deepEqual(result.progress, { current: 49, target: 50 });
  });

  it('earns at 50 unique words', () => {
    const result = medicationMasterFromUniqueWordCount(50);
    assert.equal(result.earned, true);
    assert.equal(result.progress, null);
  });

  it('earns above 50', () => {
    assert.equal(medicationMasterFromUniqueWordCount(51).earned, true);
  });
});

describe('firstStepsFromPassingCounts', () => {
  it('stays locked when both drill and focus are 0', () => {
    const result = firstStepsFromPassingCounts(0, 0);
    assert.equal(result.earned, false);
    assert.deepEqual(result.progress, { current: 0, target: 1 });
  });

  it('earns when drill count ≥ 1', () => {
    const result = firstStepsFromPassingCounts(1, 0);
    assert.equal(result.earned, true);
    assert.equal(result.progress, null);
  });

  it('earns when focus count ≥ 1', () => {
    const result = firstStepsFromPassingCounts(0, 1);
    assert.equal(result.earned, true);
    assert.equal(result.progress, null);
  });

  it('earns when either count is ≥ 1', () => {
    assert.equal(firstStepsFromPassingCounts(2, 3).earned, true);
  });
});

describe('UserStreak badge persistence query helpers', () => {
  it('write filter uses toUserIdQuery (ObjectId for hex ids)', () => {
    const filter = userStreakWriteFilter(OBJECT_ID_HEX);
    assert.ok(filter.userId instanceof Types.ObjectId);
    assert.equal(String(filter.userId), OBJECT_ID_HEX);
  });

  it('write filter keeps UUID as string (does not throw)', () => {
    const filter = userStreakWriteFilter(UUID);
    assert.equal(filter.userId, UUID);
    assert.equal(typeof filter.userId, 'string');
  });

  it('read filter includes UUID string candidate', () => {
    const filter = userStreakReadFilter(UUID);
    assert.ok(Array.isArray(filter.userId.$in));
    assert.ok(filter.userId.$in.includes(UUID));
  });

  it('read filter includes ObjectId + string candidates for hex ids', () => {
    const filter = userStreakReadFilter(OBJECT_ID_HEX);
    const candidates = filter.userId.$in;
    assert.ok(candidates.some((c) => c === OBJECT_ID_HEX));
    assert.ok(candidates.some((c) => c instanceof Types.ObjectId));
  });

  it('toUserIdQuery does not throw for UUID (evaluateAndUnlock path)', () => {
    assert.doesNotThrow(() => toUserIdQuery(UUID));
    assert.equal(toUserIdQuery(UUID), UUID);
  });
});
