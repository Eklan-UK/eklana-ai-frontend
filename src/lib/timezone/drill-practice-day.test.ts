import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import DrillAttempt from '@/models/drill-attempt';
import { hasQualifyingDrillTodayLocal } from './drill-practice-day';

const OBJECT_ID_LEARNER = '507f1f77bcf86cd799439011';
const UUID_LEARNER = '550e8400-e29b-41d4-a716-446655440000';
const TIME_ZONE = 'America/New_York';

// 2026-07-17 18:30 EDT = 2026-07-17 22:30 UTC
const NOW = new Date('2026-07-17T22:30:00.000Z');
const SAME_LOCAL_DAY = new Date('2026-07-17T14:00:00.000Z'); // 10:00 EDT
const PREVIOUS_LOCAL_DAY = new Date('2026-07-16T22:00:00.000Z'); // 18:00 EDT previous day

type FindFn = typeof DrillAttempt.find;

describe('hasQualifyingDrillTodayLocal', () => {
  let originalFind: FindFn;
  let findMock: ReturnType<typeof mock.fn>;
  let lastQuery: Record<string, unknown> | undefined;
  let leanResult: Array<{ completedAt?: Date }> = [];

  beforeEach(() => {
    originalFind = DrillAttempt.find.bind(DrillAttempt);
    lastQuery = undefined;
    leanResult = [];

    findMock = mock.fn((query: Record<string, unknown>) => {
      lastQuery = query;
      return {
        select: () => ({
          lean: async () => leanResult,
        }),
      };
    });

    DrillAttempt.find = findMock as unknown as FindFn;
  });

  afterEach(() => {
    DrillAttempt.find = originalFind;
  });

  it('queries ObjectId learnerId with $in including string and ObjectId', async () => {
    leanResult = [];
    await hasQualifyingDrillTodayLocal(OBJECT_ID_LEARNER, TIME_ZONE, NOW);

    assert.equal(findMock.mock.callCount(), 1);
    assert.ok(lastQuery);

    const learnerFilter = lastQuery.learnerId as { $in: Array<Types.ObjectId | string> };
    assert.ok(learnerFilter?.$in);
    assert.equal(learnerFilter.$in.length, 2);
    assert.equal(learnerFilter.$in[0], OBJECT_ID_LEARNER);
    assert.ok(learnerFilter.$in[1] instanceof Types.ObjectId);
    assert.equal(String(learnerFilter.$in[1]), OBJECT_ID_LEARNER);

    assert.deepEqual(lastQuery.score, { $gte: 70 });
    assert.ok(
      (lastQuery.completedAt as { $gte: Date }).$gte instanceof Date,
    );
  });

  it('queries UUID learnerId with $in containing only the string id', async () => {
    leanResult = [];
    await hasQualifyingDrillTodayLocal(UUID_LEARNER, TIME_ZONE, NOW);

    assert.equal(findMock.mock.callCount(), 1);
    assert.ok(lastQuery);

    const learnerFilter = lastQuery.learnerId as { $in: Array<Types.ObjectId | string> };
    assert.ok(learnerFilter?.$in);
    assert.deepEqual(learnerFilter.$in, [UUID_LEARNER]);
    assert.deepEqual(lastQuery.score, { $gte: 70 });
  });

  it('returns true when a qualifying attempt falls on the local calendar day', async () => {
    leanResult = [{ completedAt: SAME_LOCAL_DAY }];

    const practiced = await hasQualifyingDrillTodayLocal(
      OBJECT_ID_LEARNER,
      TIME_ZONE,
      NOW,
    );

    assert.equal(practiced, true);
  });

  it('returns false when find returns no attempts (score < 70 filtered by query)', async () => {
    // Mongo would exclude score < 70 via score: { $gte: 70 }; empty lean = no qualifying practice.
    leanResult = [];

    const practiced = await hasQualifyingDrillTodayLocal(
      OBJECT_ID_LEARNER,
      TIME_ZONE,
      NOW,
    );

    assert.equal(practiced, false);
    assert.deepEqual(lastQuery?.score, { $gte: 70 });
  });

  it('returns false when completedAt is on a different local calendar day', async () => {
    leanResult = [{ completedAt: PREVIOUS_LOCAL_DAY }];

    const practiced = await hasQualifyingDrillTodayLocal(
      OBJECT_ID_LEARNER,
      TIME_ZONE,
      NOW,
    );

    assert.equal(practiced, false);
  });
});
