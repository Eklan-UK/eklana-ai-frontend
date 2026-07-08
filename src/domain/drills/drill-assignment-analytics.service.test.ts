import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	computeDrillAssignmentStatistics,
	deriveEffectiveStatus,
	deriveReviewStatus,
	enrichDrillAssignment,
	groupAttemptsByAssignmentId,
	type DrillAssignmentLike,
	type DrillAttemptLike,
} from './drill-assignment-analytics.service';

const ASSIGNMENT_ID = '507f1f77bcf86cd799439011';
const DRILL_ID = '507f1f77bcf86cd799439012';

function makeAssignment(
	overrides: Partial<DrillAssignmentLike> & { drillId?: unknown } = {}
): DrillAssignmentLike & { drillId?: unknown } {
	return {
		_id: ASSIGNMENT_ID,
		drillId: {
			_id: DRILL_ID,
			title: 'Test Drill',
			type: 'grammar',
		},
		status: 'in-progress',
		assignedAt: '2026-01-01T00:00:00.000Z',
		...overrides,
	};
}

function makeAttempt(overrides: Partial<DrillAttemptLike> = {}): DrillAttemptLike {
	return {
		score: 80,
		completedAt: '2026-01-02T00:00:00.000Z',
		...overrides,
	};
}

describe('groupAttemptsByAssignmentId', () => {
	it('groups multiple attempts under the same assignment id', () => {
		const grouped = groupAttemptsByAssignmentId([
			{
				drillAssignmentId: ASSIGNMENT_ID,
				score: 70,
				completedAt: '2026-01-03T00:00:00.000Z',
			},
			{
				drillAssignmentId: ASSIGNMENT_ID,
				score: 90,
				completedAt: '2026-01-02T00:00:00.000Z',
			},
			{
				drillAssignmentId: '507f1f77bcf86cd799439099',
				score: 50,
			},
		]);

		assert.equal(grouped.get(ASSIGNMENT_ID)?.length, 2);
		assert.equal(grouped.get('507f1f77bcf86cd799439099')?.length, 1);
	});

	it('skips attempts without an assignment id', () => {
		const grouped = groupAttemptsByAssignmentId([
			{ score: 80 },
			{
				drillAssignmentId: ASSIGNMENT_ID,
				score: 80,
			},
		]);

		assert.equal(grouped.size, 1);
		assert.equal(grouped.get(ASSIGNMENT_ID)?.length, 1);
	});
});

describe('deriveEffectiveStatus', () => {
	it('returns completed when DB status lags but latest attempt has completedAt', () => {
		const status = deriveEffectiveStatus(
			makeAssignment({ status: 'in-progress' }),
			makeAttempt({ completedAt: '2026-01-02T00:00:00.000Z' })
		);
		assert.equal(status, 'completed');
	});

	it('returns completed when assignment has completedAt', () => {
		const status = deriveEffectiveStatus(
			makeAssignment({
				status: 'in-progress',
				completedAt: '2026-01-02T00:00:00.000Z',
			}),
			null
		);
		assert.equal(status, 'completed');
	});

	it('preserves non-completed status when no completion signals exist', () => {
		const status = deriveEffectiveStatus(makeAssignment({ status: 'pending' }), null);
		assert.equal(status, 'pending');
	});
});

describe('deriveReviewStatus', () => {
	it('derives pending review from sentenceResults', () => {
		const result = deriveReviewStatus({
			sentenceResults: { reviewStatus: 'pending' },
		});
		assert.deepEqual(result, {
			reviewStatus: 'pending',
			requiresReview: true,
		});
	});

	it('prefers sentenceResults over summary and grammar results', () => {
		const result = deriveReviewStatus({
			sentenceResults: { reviewStatus: 'reviewed' },
			summaryResults: { reviewStatus: 'pending' },
			grammarResults: { reviewStatus: 'pending' },
		});
		assert.equal(result.reviewStatus, 'reviewed');
		assert.equal(result.requiresReview, false);
	});

	it('falls back to summaryResults then grammarResults', () => {
		assert.deepEqual(
			deriveReviewStatus({
				summaryResults: { reviewStatus: 'pending' },
				grammarResults: { reviewStatus: 'reviewed' },
			}),
			{
				reviewStatus: 'pending',
				requiresReview: true,
			}
		);

		assert.deepEqual(
			deriveReviewStatus({
				grammarResults: { reviewStatus: 'reviewed' },
			}),
			{
				reviewStatus: 'reviewed',
				requiresReview: false,
			}
		);
	});

	it('returns no review requirement when attempt is missing', () => {
		assert.deepEqual(deriveReviewStatus(null), {
			reviewStatus: null,
			requiresReview: false,
		});
	});
});

describe('enrichDrillAssignment', () => {
	it('exposes review fields and result payloads on latestAttempt', () => {
		const enriched = enrichDrillAssignment(makeAssignment(), [
			makeAttempt({
				score: 72,
				grammarResults: { reviewStatus: 'pending', accuracy: 72 },
			}),
		]);

		assert.equal(enriched.requiresReview, true);
		assert.equal(enriched.reviewStatus, 'pending');
		assert.equal(enriched.status, 'completed');
		assert.deepEqual(enriched.latestAttempt?.grammarResults, {
			reviewStatus: 'pending',
			accuracy: 72,
		});
	});

	it('uses best attempt score for bestScore', () => {
		const enriched = enrichDrillAssignment(makeAssignment({ score: 60 }), [
			makeAttempt({ score: 70, completedAt: '2026-01-03T00:00:00.000Z' }),
			makeAttempt({ score: 90, completedAt: '2026-01-02T00:00:00.000Z' }),
		]);

		assert.equal(enriched.bestScore, 90);
		assert.equal(enriched.latestAttempt?.score, 70);
	});
});

describe('computeDrillAssignmentStatistics', () => {
	it('excludes assignments with null drill refs from enriched input set', () => {
		const valid = enrichDrillAssignment(makeAssignment({ status: 'completed' }), [
			makeAttempt({ score: 80 }),
		]);
		const stats = computeDrillAssignmentStatistics([valid]);

		assert.equal(stats.total, 1);
		assert.equal(stats.completed, 1);
		assert.equal(stats.completionRate, 100);
	});

	it('keeps total, completed, and completion rate on the same denominator', () => {
		const assignments = [
			enrichDrillAssignment(makeAssignment({ _id: 'a1', status: 'completed' }), [
				makeAttempt({ score: 80 }),
			]),
			enrichDrillAssignment(
				makeAssignment({ _id: 'a2', status: 'in-progress' }),
				[]
			),
			enrichDrillAssignment(makeAssignment({ _id: 'a3', status: 'pending' }), []),
		];

		const stats = computeDrillAssignmentStatistics(assignments);

		assert.equal(stats.total, 3);
		assert.equal(stats.completed, 1);
		assert.equal(stats.inProgress, 1);
		assert.equal(stats.pending, 1);
		assert.equal(stats.completionRate, 33.33);
	});

	it('counts pendingReview from derived requiresReview', () => {
		const assignments = [
			enrichDrillAssignment(makeAssignment({ _id: 'a1', status: 'completed' }), [
				makeAttempt({ grammarResults: { reviewStatus: 'pending' } }),
			]),
			enrichDrillAssignment(makeAssignment({ _id: 'a2', status: 'completed' }), [
				makeAttempt({ grammarResults: { reviewStatus: 'reviewed' } }),
			]),
		];

		const stats = computeDrillAssignmentStatistics(assignments);
		assert.equal(stats.pendingReview, 1);
	});

	it('averages one score per completed assignment using bestScore', () => {
		const assignments = [
			enrichDrillAssignment(makeAssignment({ _id: 'a1', status: 'completed' }), [
				makeAttempt({ score: 60, completedAt: '2026-01-01T00:00:00.000Z' }),
				makeAttempt({ score: 100, completedAt: '2026-01-02T00:00:00.000Z' }),
			]),
			enrichDrillAssignment(makeAssignment({ _id: 'a2', status: 'completed' }), [
				makeAttempt({ score: 80 }),
			]),
		];

		const stats = computeDrillAssignmentStatistics(assignments);
		assert.equal(stats.averageScore, 90);
	});

	it('treats completedAt on assignment as completed for statistics', () => {
		const assignments = [
			enrichDrillAssignment(
				makeAssignment({
					_id: 'a1',
					status: 'in-progress',
					completedAt: '2026-01-02T00:00:00.000Z',
				}),
				[makeAttempt({ score: 75 })]
			),
		];

		const stats = computeDrillAssignmentStatistics(assignments);
		assert.equal(stats.completed, 1);
		assert.equal(stats.averageScore, 75);
	});
});
