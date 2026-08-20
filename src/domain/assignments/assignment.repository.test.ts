import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import DrillAssignment from '@/models/drill-assignment';
import {
  AssignmentRepository,
  buildAssignmentStatusUpdateFilter,
} from './assignment.repository';

const ASSIGNMENT_ID = '507f1f77bcf86cd799439011';

describe('buildAssignmentStatusUpdateFilter', () => {
  it('does not match completed assignments when setting in-progress', () => {
    assert.deepEqual(buildAssignmentStatusUpdateFilter(ASSIGNMENT_ID, 'in-progress'), {
      _id: ASSIGNMENT_ID,
      status: { $ne: 'completed' },
    });
  });

  it('does not guard completed, pending, overdue, or skipped writes', () => {
    for (const status of ['completed', 'pending', 'overdue', 'skipped'] as const) {
      assert.deepEqual(buildAssignmentStatusUpdateFilter(ASSIGNMENT_ID, status), {
        _id: ASSIGNMENT_ID,
      });
    }
  });
});

describe('AssignmentRepository.updateStatus', () => {
  const originalFindOneAndUpdate = DrillAssignment.findOneAndUpdate.bind(DrillAssignment);
  let findOneAndUpdate: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    findOneAndUpdate = mock.fn(() => {
      const chain = {
        lean: mock.fn(() => chain),
        exec: mock.fn(async () => ({ _id: ASSIGNMENT_ID, status: 'in-progress' })),
      };
      return chain;
    });
    DrillAssignment.findOneAndUpdate = findOneAndUpdate as typeof DrillAssignment.findOneAndUpdate;
  });

  afterEach(() => {
    DrillAssignment.findOneAndUpdate = originalFindOneAndUpdate;
  });

  it('passes the completed-guard filter when flipping to in-progress', async () => {
    const repo = new AssignmentRepository();
    await repo.updateStatus(ASSIGNMENT_ID, 'in-progress');

    assert.equal(findOneAndUpdate.mock.calls.length, 1);
    const [filter, update] = findOneAndUpdate.mock.calls[0].arguments;
    assert.deepEqual(filter, {
      _id: ASSIGNMENT_ID,
      status: { $ne: 'completed' },
    });
    assert.deepEqual(update, { status: 'in-progress' });
  });

  it('allows completed without the in-progress guard', async () => {
    const completedAt = new Date('2026-08-19T00:00:00.000Z');
    const repo = new AssignmentRepository();
    await repo.updateStatus(ASSIGNMENT_ID, 'completed', completedAt);

    const [filter, update] = findOneAndUpdate.mock.calls[0].arguments;
    assert.deepEqual(filter, { _id: ASSIGNMENT_ID });
    assert.deepEqual(update, { status: 'completed', completedAt });
  });
});
