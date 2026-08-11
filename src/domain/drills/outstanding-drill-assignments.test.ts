import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NON_OUTSTANDING_ASSIGNMENT_STATUSES,
  OUTSTANDING_ASSIGNMENT_STATUSES,
  isOutstandingAssignmentStatus,
  orderTitlesForOutstandingDigest,
  outstandingAssignmentMongoMatch,
  outstandingDigestRemainingCount,
} from './outstanding-drill-assignments';

describe('OUTSTANDING_ASSIGNMENT_STATUSES', () => {
  it('includes pending, in-progress, and overdue', () => {
    assert.deepEqual([...OUTSTANDING_ASSIGNMENT_STATUSES], [
      'pending',
      'in-progress',
      'overdue',
    ]);
  });

  it('does not include completed or skipped', () => {
    for (const status of NON_OUTSTANDING_ASSIGNMENT_STATUSES) {
      assert.equal(
        (OUTSTANDING_ASSIGNMENT_STATUSES as readonly string[]).includes(status),
        false,
      );
    }
  });
});

describe('isOutstandingAssignmentStatus', () => {
  it('returns true for outstanding statuses', () => {
    assert.equal(isOutstandingAssignmentStatus('pending'), true);
    assert.equal(isOutstandingAssignmentStatus('in-progress'), true);
    assert.equal(isOutstandingAssignmentStatus('overdue'), true);
  });

  it('returns false for completed, skipped, and unknown', () => {
    assert.equal(isOutstandingAssignmentStatus('completed'), false);
    assert.equal(isOutstandingAssignmentStatus('skipped'), false);
    assert.equal(isOutstandingAssignmentStatus('unknown'), false);
    assert.equal(isOutstandingAssignmentStatus(undefined), false);
    assert.equal(isOutstandingAssignmentStatus(null), false);
  });
});

describe('outstandingAssignmentMongoMatch', () => {
  it('matches outstanding statuses and excludes precision_clinic', () => {
    assert.deepEqual(outstandingAssignmentMongoMatch(), {
      status: { $in: ['pending', 'in-progress', 'overdue'] },
      source: { $ne: 'precision_clinic' },
    });
  });

  it('merges extra filters (e.g. learnerId) without dropping exclusions', () => {
    assert.deepEqual(
      outstandingAssignmentMongoMatch({ learnerId: 'learner-1' }),
      {
        status: { $in: ['pending', 'in-progress', 'overdue'] },
        source: { $ne: 'precision_clinic' },
        learnerId: 'learner-1',
      },
    );
  });
});

describe('orderTitlesForOutstandingDigest', () => {
  it('preserves assignment order and stops at limit', () => {
    const titleByDrillId = new Map([
      ['a', 'Alpha'],
      ['b', 'Beta'],
      ['c', 'Gamma'],
    ]);
    assert.deepEqual(
      orderTitlesForOutstandingDigest(['c', 'a', 'b'], titleByDrillId, 2),
      ['Gamma', 'Alpha'],
    );
  });

  it('skips missing drills without inventing titles', () => {
    const titleByDrillId = new Map([['a', 'Alpha']]);
    assert.deepEqual(
      orderTitlesForOutstandingDigest(['missing', 'a', 'gone'], titleByDrillId),
      ['Alpha'],
    );
  });
});

describe('outstandingDigestRemainingCount', () => {
  it('uses assignment-row drillCount minus listed titles', () => {
    assert.equal(outstandingDigestRemainingCount(10, 5), 5);
    assert.equal(outstandingDigestRemainingCount(3, 3), 0);
    assert.equal(outstandingDigestRemainingCount(2, 5), 0);
  });
});
