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

const GRAMMAR_PATTERNS = [
	{
		pattern: 'Present simple',
		example: 'I walk',
		sentences: [{ text: 'I walk every day', index: 0 }],
	},
];

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

function makeGrammarPendingAttempt(
	overrides: Partial<DrillAttemptLike> = {}
): DrillAttemptLike {
	return makeAttempt({
		grammarResults: {
			reviewStatus: 'pending',
			patterns: GRAMMAR_PATTERNS,
		},
		...overrides,
	});
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
	it('ignores pending sentenceResults (grammar-only profile review)', () => {
		const result = deriveReviewStatus(
			{ sentenceResults: { reviewStatus: 'pending' } },
			'grammar'
		);
		assert.deepEqual(result, {
			reviewStatus: null,
			requiresReview: false,
		});
	});

	it('ignores pending summaryResults (grammar-only profile review)', () => {
		const result = deriveReviewStatus(
			{ summaryResults: { reviewStatus: 'pending' } },
			'grammar'
		);
		assert.deepEqual(result, {
			reviewStatus: null,
			requiresReview: false,
		});
	});

	it('derives pending review when type is grammar with patterns', () => {
		const result = deriveReviewStatus(
			{
				sentenceResults: { reviewStatus: 'reviewed' },
				summaryResults: { reviewStatus: 'pending' },
				grammarResults: {
					reviewStatus: 'pending',
					patterns: GRAMMAR_PATTERNS,
				},
			},
			'grammar'
		);
		assert.deepEqual(result, {
			reviewStatus: 'pending',
			requiresReview: true,
		});
	});

	it('uses grammarResults even when sentence/summary are pending', () => {
		assert.deepEqual(
			deriveReviewStatus(
				{
					sentenceResults: { reviewStatus: 'pending' },
					summaryResults: { reviewStatus: 'pending' },
					grammarResults: {
						reviewStatus: 'reviewed',
						patterns: GRAMMAR_PATTERNS,
					},
				},
				'grammar'
			),
			{
				reviewStatus: 'reviewed',
				requiresReview: false,
			}
		);

		assert.deepEqual(
			deriveReviewStatus(
				{
					grammarResults: {
						reviewStatus: 'reviewed',
						patterns: GRAMMAR_PATTERNS,
					},
				},
				'grammar'
			),
			{
				reviewStatus: 'reviewed',
				requiresReview: false,
			}
		);
	});

	it('does not require review for grammar without real patterns (contaminated default)', () => {
		assert.deepEqual(
			deriveReviewStatus(
				{ grammarResults: { reviewStatus: 'pending' } },
				'grammar'
			),
			{ reviewStatus: null, requiresReview: false }
		);
		assert.deepEqual(
			deriveReviewStatus(
				{ grammarResults: { reviewStatus: 'pending', patterns: [] } },
				'grammar'
			),
			{ reviewStatus: null, requiresReview: false }
		);
	});

	it('does not require review for non-grammar types even with contaminated grammarResults', () => {
		const contaminated = {
			grammarResults: { reviewStatus: 'pending' },
		};

		for (const type of [
			'roleplay',
			'key_phrases',
			'vocabulary',
			'pronunciation',
			'sentence',
			'summary',
		]) {
			assert.deepEqual(
				deriveReviewStatus(contaminated, type),
				{ reviewStatus: null, requiresReview: false },
				`expected no review for type=${type}`
			);
		}
	});

	it('does not require review when drill type is missing', () => {
		assert.deepEqual(
			deriveReviewStatus(
				{
					grammarResults: {
						reviewStatus: 'pending',
						patterns: GRAMMAR_PATTERNS,
					},
				},
				null
			),
			{ reviewStatus: null, requiresReview: false }
		);
		assert.deepEqual(
			deriveReviewStatus({
				grammarResults: {
					reviewStatus: 'pending',
					patterns: GRAMMAR_PATTERNS,
				},
			}),
			{ reviewStatus: null, requiresReview: false }
		);
	});

	it('returns no review requirement when attempt is missing', () => {
		assert.deepEqual(deriveReviewStatus(null, 'grammar'), {
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
				grammarResults: {
					reviewStatus: 'pending',
					accuracy: 72,
					patterns: GRAMMAR_PATTERNS,
				},
			}),
		]);

		assert.equal(enriched.requiresReview, true);
		assert.equal(enriched.reviewStatus, 'pending');
		assert.equal(enriched.status, 'completed');
		assert.deepEqual(enriched.latestAttempt?.grammarResults, {
			reviewStatus: 'pending',
			accuracy: 72,
			patterns: GRAMMAR_PATTERNS,
		});
	});

	it('does not set requiresReview for roleplay with contaminated grammarResults', () => {
		const enriched = enrichDrillAssignment(
			makeAssignment({
				drillId: {
					_id: DRILL_ID,
					title: 'Roleplay Drill',
					type: 'roleplay',
				},
			}),
			[
				makeAttempt({
					grammarResults: { reviewStatus: 'pending' },
					roleplayResults: { sceneScores: [] },
				}),
			]
		);

		assert.equal(enriched.requiresReview, false);
		assert.equal(enriched.reviewStatus, null);
	});

	it('does not set requiresReview for key_phrases with contaminated grammarResults', () => {
		const enriched = enrichDrillAssignment(
			makeAssignment({
				drillId: {
					_id: DRILL_ID,
					title: 'Key Phrases Drill',
					type: 'key_phrases',
				},
			}),
			[makeAttempt({ grammarResults: { reviewStatus: 'pending' } })]
		);

		assert.equal(enriched.requiresReview, false);
		assert.equal(enriched.reviewStatus, null);
	});

	it('does not set requiresReview for grammar when patterns are missing', () => {
		const enriched = enrichDrillAssignment(makeAssignment(), [
			makeAttempt({ grammarResults: { reviewStatus: 'pending' } }),
		]);

		assert.equal(enriched.requiresReview, false);
		assert.equal(enriched.reviewStatus, null);
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

	it('counts pendingReview from derived requiresReview (grammar + patterns only)', () => {
		const assignments = [
			enrichDrillAssignment(makeAssignment({ _id: 'a1', status: 'completed' }), [
				makeGrammarPendingAttempt(),
			]),
			enrichDrillAssignment(makeAssignment({ _id: 'a2', status: 'completed' }), [
				makeAttempt({
					grammarResults: {
						reviewStatus: 'reviewed',
						patterns: GRAMMAR_PATTERNS,
					},
				}),
			]),
			enrichDrillAssignment(
				makeAssignment({
					_id: 'a3',
					status: 'completed',
					drillId: {
						_id: DRILL_ID,
						title: 'Roleplay',
						type: 'roleplay',
					},
				}),
				[makeAttempt({ grammarResults: { reviewStatus: 'pending' } })]
			),
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
