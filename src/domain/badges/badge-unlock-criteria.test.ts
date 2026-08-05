/**
 * Focused badge unlock criteria tests (no live Mongo).
 *
 * Run: node --import tsx --test src/domain/badges/badge-unlock-criteria.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { toUserIdQuery } from '@/lib/api/user-id';
import { __test__ } from './badge.service';

const {
  masterCollectorFromBookmarkCount,
  userStreakReadFilter,
  userStreakWriteFilter,
  objectIdOnlyUserId,
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

  it('objectIdOnlyUserId returns null for UUID (ObjectId-only evaluators skip)', () => {
    assert.equal(objectIdOnlyUserId(UUID), null);
  });

  it('objectIdOnlyUserId returns ObjectId for hex ids', () => {
    const oid = objectIdOnlyUserId(OBJECT_ID_HEX);
    assert.ok(oid instanceof Types.ObjectId);
    assert.equal(String(oid), OBJECT_ID_HEX);
  });
});
