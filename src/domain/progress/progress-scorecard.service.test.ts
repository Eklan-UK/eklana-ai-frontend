/**
 * Unit tests for progress-scorecard.service.ts
 *
 * These tests exercise the computation logic directly, using mock attempt objects
 * that match the shape returned by Mongoose .lean() queries.
 *
 * Run: node --import tsx --test src/domain/progress/progress-scorecard.service.test.ts
 */

import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import DrillAttempt from '@/models/drill-attempt';
import FreeTalkAttempt from '@/models/free-talk-attempt';
import { computeProgressScorecard } from './progress-scorecard.service';

const LEARNER_ID = '507f1f77bcf86cd799439011';
const noopConnect = async () => undefined;

const mockDrillAttemptFind = mock.fn(() => mockFind([]));
const mockFreeTalkAttemptFind = mock.fn(() => mockFind([]));

type FindFn = typeof DrillAttempt.find;
const originalDrillFind = DrillAttempt.find.bind(DrillAttempt);
const originalFreeTalkFind = FreeTalkAttempt.find.bind(FreeTalkAttempt);

function thisWeek(): Date {
	return new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
}

function lastWeek(): Date {
	return new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
}

function mockFind(docs: Record<string, unknown>[]) {
	const chain = {
		select: mock.fn(() => chain),
		sort: mock.fn(() => chain),
		limit: mock.fn(() => chain),
		lean: mock.fn(() => chain),
		exec: mock.fn(async () => docs),
	};
	return chain;
}

function stubFinds(
	drillDocs: Record<string, unknown>[],
	freeTalkDocs: Record<string, unknown>[] = [],
) {
	mockDrillAttemptFind.mock.mockImplementation(() => mockFind(drillDocs));
	mockFreeTalkAttemptFind.mock.mockImplementation(() => mockFind(freeTalkDocs));
}

function runScorecard() {
	return computeProgressScorecard(LEARNER_ID, { connect: noopConnect });
}

describe('computeProgressScorecard', () => {
	beforeEach(() => {
		mockDrillAttemptFind.mock.resetCalls();
		mockFreeTalkAttemptFind.mock.resetCalls();
		stubFinds([]);
		DrillAttempt.find = ((...args: unknown[]) =>
			mockDrillAttemptFind(...args)) as FindFn;
		FreeTalkAttempt.find = ((...args: unknown[]) =>
			mockFreeTalkAttemptFind(...args)) as FindFn;
	});

	afterEach(() => {
		DrillAttempt.find = originalDrillFind;
		FreeTalkAttempt.find = originalFreeTalkFind;
	});

	describe('Pronunciation', () => {
		it('returns 0 when no drill attempts exist', async () => {
			stubFinds([]);

			const result = await runScorecard();
			assert.equal(result.pronunciation, 0);
			assert.equal(result.sampleCounts.pronunciationDrills, 0);
		});

		it('averages Speechace pronunciationScores from vocabulary drills', async () => {
			const attempts = [
				{
					drillType: 'vocabulary',
					drillAssignmentId: 'asgn-1',
					completedAt: thisWeek(),
					vocabularyResults: {
						wordScores: [
							{ word: 'hello', pronunciationScore: 80, score: 70 },
							{ word: 'world', pronunciationScore: 60, score: 50 },
						],
					},
				},
			];
			stubFinds(attempts);

			const result = await runScorecard();
			// avg Speechace = (80 + 60) / 2 = 70
			assert.equal(result.pronunciation, 70);
			assert.equal(result.sampleCounts.pronunciationDrills, 1);
		});

		it('ignores word scores of 0 from Speechace results', async () => {
			const attempts = [
				{
					drillType: 'pronunciation',
					drillAssignmentId: 'asgn-1',
					completedAt: thisWeek(),
					pronunciationResults: {
						wordScores: [
							{ word: 'cat', pronunciationScore: 90, score: 90 },
							{ word: 'dog', pronunciationScore: 0, score: 0 }, // should be excluded
						],
					},
				},
			];
			stubFinds(attempts);

			const result = await runScorecard();
			assert.equal(result.pronunciation, 90);
		});

		it('averages across multiple drills (each drill contributes one avg)', async () => {
			const attempts = [
				{
					drillType: 'vocabulary',
					drillAssignmentId: 'asgn-1',
					completedAt: thisWeek(),
					vocabularyResults: {
						wordScores: [{ word: 'a', pronunciationScore: 100, score: 100 }],
					},
				},
				{
					drillType: 'vocabulary',
					drillAssignmentId: 'asgn-2',
					completedAt: thisWeek(),
					vocabularyResults: {
						wordScores: [{ word: 'b', pronunciationScore: 60, score: 60 }],
					},
				},
			];
			stubFinds(attempts);

			const result = await runScorecard();
			assert.equal(result.pronunciation, 80); // (100 + 60) / 2
		});
	});

	describe('Accuracy', () => {
		it('only counts key_phrases and fill_blank drills that have a drillAssignmentId', async () => {
			const attempts = [
				{
					drillType: 'key_phrases',
					drillAssignmentId: 'asgn-1',
					completedAt: thisWeek(),
					keyPhrasesResults: { score: 80 },
				},
				{
					drillType: 'fill_blank',
					drillAssignmentId: 'asgn-2',
					completedAt: thisWeek(),
					fillBlankResults: { score: 60 },
				},
				{
					// roleplay — should NOT contribute to accuracy
					drillType: 'roleplay',
					drillAssignmentId: 'asgn-3',
					completedAt: thisWeek(),
					score: 90,
				},
				{
					// key_phrases with no assignment (weekly challenge, free practice) — excluded
					drillType: 'key_phrases',
					drillAssignmentId: null,
					completedAt: thisWeek(),
					keyPhrasesResults: { score: 100 },
				},
			];
			stubFinds(attempts);

			const result = await runScorecard();
			assert.equal(result.accuracy, 70); // (80 + 60) / 2
			assert.equal(result.sampleCounts.accuracyDrills, 2);
		});

		it('returns 0 when no accuracy drills exist', async () => {
			const attempts = [
				{
					drillType: 'vocabulary',
					drillAssignmentId: 'asgn-1',
					completedAt: thisWeek(),
					vocabularyResults: {
						wordScores: [{ word: 'a', pronunciationScore: 90, score: 90 }],
					},
				},
			];
			stubFinds(attempts);

			const result = await runScorecard();
			assert.equal(result.accuracy, 0);
		});

		it('infers key_phrases type from results when drillType is missing (legacy attempts)', async () => {
			const attempts = [
				{
					drillAssignmentId: 'asgn-1',
					completedAt: thisWeek(),
					keyPhrasesResults: { score: 85 },
				},
			];
			stubFinds(attempts);

			const result = await runScorecard();
			assert.equal(result.accuracy, 85);
			assert.equal(result.sampleCounts.accuracyDrills, 1);
		});
	});

	describe('Fluency', () => {
		it('averages gradeResult.overallScore from free talk attempts', async () => {
			stubFinds(
				[],
				[
					{ gradeResult: { overallScore: 70 }, createdAt: thisWeek() },
					{ gradeResult: { overallScore: 90 }, createdAt: lastWeek() },
				],
			);

			const result = await runScorecard();
			assert.equal(result.fluency, 80); // (70 + 90) / 2
			assert.equal(result.sampleCounts.fluencyScenarios, 2);
		});

		it('ignores attempts without gradeResult', async () => {
			stubFinds(
				[],
				[
					{ gradeResult: null, createdAt: thisWeek() },
					{ gradeResult: { overallScore: 80 }, createdAt: thisWeek() },
				],
			);

			const result = await runScorecard();
			assert.equal(result.fluency, 80);
			assert.equal(result.sampleCounts.fluencyScenarios, 1);
		});
	});

	describe('Confidence', () => {
		it('is the average of available pillars (all three)', async () => {
			const attempts = [
				{
					drillType: 'vocabulary',
					drillAssignmentId: 'asgn-1',
					completedAt: thisWeek(),
					vocabularyResults: { wordScores: [{ word: 'a', pronunciationScore: 80, score: 80 }] },
				},
				{
					drillType: 'key_phrases',
					drillAssignmentId: 'asgn-2',
					completedAt: thisWeek(),
					keyPhrasesResults: { score: 60 },
				},
			];
			stubFinds(attempts, [{ gradeResult: { overallScore: 70 }, createdAt: thisWeek() }]);

			const result = await runScorecard();
			// pronunciation=80, accuracy=60, fluency=70 → confidence=(80+60+70)/3 = 70
			assert.equal(result.confidence, 70);
		});

		it('divides only by pillars with data (2-of-3 case)', async () => {
			const attempts = [
				{
					drillType: 'vocabulary',
					drillAssignmentId: 'asgn-1',
					completedAt: thisWeek(),
					vocabularyResults: { wordScores: [{ word: 'a', pronunciationScore: 80, score: 80 }] },
				},
			];
			stubFinds(attempts, [{ gradeResult: { overallScore: 60 }, createdAt: thisWeek() }]);

			const result = await runScorecard();
			// pronunciation=80, fluency=60, accuracy=0 (no data) → confidence=(80+60)/2 = 70
			assert.equal(result.confidence, 70);
		});

		it('returns 0 when no pillars have data', async () => {
			stubFinds([]);

			const result = await runScorecard();
			assert.equal(result.confidence, 0);
		});
	});

	describe('Weekly change', () => {
		it('computes positive pronunciationWeeklyChange when this week > last week', async () => {
			const attempts = [
				{
					drillType: 'vocabulary',
					drillAssignmentId: 'asgn-1',
					completedAt: thisWeek(),
					vocabularyResults: { wordScores: [{ word: 'a', pronunciationScore: 90, score: 90 }] },
				},
				{
					drillType: 'vocabulary',
					drillAssignmentId: 'asgn-2',
					completedAt: lastWeek(),
					vocabularyResults: { wordScores: [{ word: 'b', pronunciationScore: 60, score: 60 }] },
				},
			];
			stubFinds(attempts);

			const result = await runScorecard();
			assert.equal(result.pronunciationWeeklyChange, 30); // 90 - 60
		});

		it('returns 0 weekly change when only one window has data', async () => {
			const attempts = [
				{
					drillType: 'vocabulary',
					drillAssignmentId: 'asgn-1',
					completedAt: thisWeek(),
					vocabularyResults: { wordScores: [{ word: 'a', pronunciationScore: 90, score: 90 }] },
				},
			];
			stubFinds(attempts);

			const result = await runScorecard();
			assert.equal(result.pronunciationWeeklyChange, 0);
		});
	});

	describe('confidenceTrend', () => {
		it('is "improving" when confidenceWeeklyChange >= 3', async () => {
			const makeAttempts = (completedAt: Date, score: number) => ({
				drillType: 'vocabulary',
				drillAssignmentId: 'asgn-1',
				completedAt,
				vocabularyResults: { wordScores: [{ word: 'a', pronunciationScore: score, score }] },
			});
			stubFinds([makeAttempts(thisWeek(), 90), makeAttempts(lastWeek(), 50)]);

			const result = await runScorecard();
			assert.equal(result.confidenceTrend, 'improving');
		});

		it('is "stable" when change is within ±3', async () => {
			const makeAttempts = (completedAt: Date, score: number) => ({
				drillType: 'vocabulary',
				drillAssignmentId: 'asgn-1',
				completedAt,
				vocabularyResults: { wordScores: [{ word: 'a', pronunciationScore: score, score }] },
			});
			stubFinds([makeAttempts(thisWeek(), 80), makeAttempts(lastWeek(), 79)]);

			const result = await runScorecard();
			assert.equal(result.confidenceTrend, 'stable');
		});
	});
});
