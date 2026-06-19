/**
 * Unit tests for progress-scorecard.service.ts
 *
 * These tests exercise the computation logic directly, using mock attempt objects
 * that match the shape returned by Mongoose .lean() queries.
 */

import {
	computeProgressScorecard,
	type ProgressScorecardMetrics,
} from './progress-scorecard.service';

// ── Mocks ──────────────────────────────────────────────────────

jest.mock('@/lib/api/db', () => ({
	connectToDatabase: jest.fn().mockResolvedValue(undefined),
}));

const mockDrillAttemptFind = jest.fn();
const mockFreeTalkAttemptFind = jest.fn();

jest.mock('@/models/drill-attempt', () => ({
	__esModule: true,
	default: {
		find: (...args: unknown[]) => mockDrillAttemptFind(...args),
	},
}));

jest.mock('@/models/free-talk-attempt', () => ({
	__esModule: true,
	default: {
		find: (...args: unknown[]) => mockFreeTalkAttemptFind(...args),
	},
}));

// ── Helpers ────────────────────────────────────────────────────

const NOW = new Date('2026-06-17T12:00:00.000Z');
const THIS_WEEK = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
const LAST_WEEK = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

beforeEach(() => {
	jest.useFakeTimers().setSystemTime(NOW);
	mockDrillAttemptFind.mockReset();
	mockFreeTalkAttemptFind.mockReset();
});

afterEach(() => {
	jest.useRealTimers();
});

/** Chain-able find mock that returns the given docs. */
function mockFind(docs: Record<string, unknown>[]) {
	const chain = {
		select: jest.fn().mockReturnThis(),
		sort: jest.fn().mockReturnThis(),
		limit: jest.fn().mockReturnThis(),
		lean: jest.fn().mockReturnThis(),
		exec: jest.fn().mockResolvedValue(docs),
	};
	return chain;
}

// ── Tests ──────────────────────────────────────────────────────

describe('computeProgressScorecard', () => {
	const LEARNER_ID = '507f1f77bcf86cd799439011';

	describe('Pronunciation', () => {
		it('returns 0 when no drill attempts exist', async () => {
			mockDrillAttemptFind.mockReturnValue(mockFind([]));
			mockFreeTalkAttemptFind.mockReturnValue(mockFind([]));

			const result = await computeProgressScorecard(LEARNER_ID);
			expect(result.pronunciation).toBe(0);
			expect(result.sampleCounts.pronunciationDrills).toBe(0);
		});

		it('averages Speechace pronunciationScores from vocabulary drills', async () => {
			const attempts = [
				{
					drillType: 'vocabulary',
					drillAssignmentId: 'asgn-1',
					completedAt: THIS_WEEK,
					vocabularyResults: {
						wordScores: [
							{ word: 'hello', pronunciationScore: 80, score: 70 },
							{ word: 'world', pronunciationScore: 60, score: 50 },
						],
					},
				},
			];
			mockDrillAttemptFind.mockReturnValue(mockFind(attempts));
			mockFreeTalkAttemptFind.mockReturnValue(mockFind([]));

			const result = await computeProgressScorecard(LEARNER_ID);
			// avg Speechace = (80 + 60) / 2 = 70
			expect(result.pronunciation).toBe(70);
			expect(result.sampleCounts.pronunciationDrills).toBe(1);
		});

		it('ignores word scores of 0 from Speechace results', async () => {
			const attempts = [
				{
					drillType: 'pronunciation',
					drillAssignmentId: 'asgn-1',
					completedAt: THIS_WEEK,
					pronunciationResults: {
						wordScores: [
							{ word: 'cat', pronunciationScore: 90, score: 90 },
							{ word: 'dog', pronunciationScore: 0, score: 0 }, // should be excluded
						],
					},
				},
			];
			mockDrillAttemptFind.mockReturnValue(mockFind(attempts));
			mockFreeTalkAttemptFind.mockReturnValue(mockFind([]));

			const result = await computeProgressScorecard(LEARNER_ID);
			expect(result.pronunciation).toBe(90);
		});

		it('averages across multiple drills (each drill contributes one avg)', async () => {
			const attempts = [
				{
					drillType: 'vocabulary',
					drillAssignmentId: 'asgn-1',
					completedAt: THIS_WEEK,
					vocabularyResults: {
						wordScores: [{ word: 'a', pronunciationScore: 100, score: 100 }],
					},
				},
				{
					drillType: 'vocabulary',
					drillAssignmentId: 'asgn-2',
					completedAt: THIS_WEEK,
					vocabularyResults: {
						wordScores: [{ word: 'b', pronunciationScore: 60, score: 60 }],
					},
				},
			];
			mockDrillAttemptFind.mockReturnValue(mockFind(attempts));
			mockFreeTalkAttemptFind.mockReturnValue(mockFind([]));

			const result = await computeProgressScorecard(LEARNER_ID);
			expect(result.pronunciation).toBe(80); // (100 + 60) / 2
		});
	});

	describe('Accuracy', () => {
		it('only counts key_phrases and fill_blank drills that have a drillAssignmentId', async () => {
			const attempts = [
				{
					drillType: 'key_phrases',
					drillAssignmentId: 'asgn-1',
					completedAt: THIS_WEEK,
					keyPhrasesResults: { score: 80 },
				},
				{
					drillType: 'fill_blank',
					drillAssignmentId: 'asgn-2',
					completedAt: THIS_WEEK,
					fillBlankResults: { score: 60 },
				},
				{
					// roleplay — should NOT contribute to accuracy
					drillType: 'roleplay',
					drillAssignmentId: 'asgn-3',
					completedAt: THIS_WEEK,
					score: 90,
				},
				{
					// key_phrases with no assignment (weekly challenge, free practice) — excluded
					drillType: 'key_phrases',
					drillAssignmentId: null,
					completedAt: THIS_WEEK,
					keyPhrasesResults: { score: 100 },
				},
			];
			mockDrillAttemptFind.mockReturnValue(mockFind(attempts));
			mockFreeTalkAttemptFind.mockReturnValue(mockFind([]));

			const result = await computeProgressScorecard(LEARNER_ID);
			expect(result.accuracy).toBe(70); // (80 + 60) / 2
			expect(result.sampleCounts.accuracyDrills).toBe(2);
		});

		it('returns 0 when no accuracy drills exist', async () => {
			const attempts = [
				{ drillType: 'vocabulary', drillAssignmentId: 'asgn-1', completedAt: THIS_WEEK, vocabularyResults: { wordScores: [{ word: 'a', pronunciationScore: 90, score: 90 }] } },
			];
			mockDrillAttemptFind.mockReturnValue(mockFind(attempts));
			mockFreeTalkAttemptFind.mockReturnValue(mockFind([]));

			const result = await computeProgressScorecard(LEARNER_ID);
			expect(result.accuracy).toBe(0);
		});
	});

	describe('Fluency', () => {
		it('averages gradeResult.overallScore from free talk attempts', async () => {
			mockDrillAttemptFind.mockReturnValue(mockFind([]));
			mockFreeTalkAttemptFind.mockReturnValue(mockFind([
				{ gradeResult: { overallScore: 70 }, createdAt: THIS_WEEK },
				{ gradeResult: { overallScore: 90 }, createdAt: LAST_WEEK },
			]));

			const result = await computeProgressScorecard(LEARNER_ID);
			expect(result.fluency).toBe(80); // (70 + 90) / 2
			expect(result.sampleCounts.fluencyScenarios).toBe(2);
		});

		it('ignores attempts without gradeResult', async () => {
			mockDrillAttemptFind.mockReturnValue(mockFind([]));
			mockFreeTalkAttemptFind.mockReturnValue(mockFind([
				{ gradeResult: null, createdAt: THIS_WEEK },
				{ gradeResult: { overallScore: 80 }, createdAt: THIS_WEEK },
			]));

			const result = await computeProgressScorecard(LEARNER_ID);
			expect(result.fluency).toBe(80);
			expect(result.sampleCounts.fluencyScenarios).toBe(1);
		});
	});

	describe('Confidence', () => {
		it('is the average of available pillars (all three)', async () => {
			const attempts = [
				{
					drillType: 'vocabulary',
					drillAssignmentId: 'asgn-1',
					completedAt: THIS_WEEK,
					vocabularyResults: { wordScores: [{ word: 'a', pronunciationScore: 80, score: 80 }] },
				},
				{
					drillType: 'key_phrases',
					drillAssignmentId: 'asgn-2',
					completedAt: THIS_WEEK,
					keyPhrasesResults: { score: 60 },
				},
			];
			mockDrillAttemptFind.mockReturnValue(mockFind(attempts));
			mockFreeTalkAttemptFind.mockReturnValue(mockFind([
				{ gradeResult: { overallScore: 70 }, createdAt: THIS_WEEK },
			]));

			const result = await computeProgressScorecard(LEARNER_ID);
			// pronunciation=80, accuracy=60, fluency=70 → confidence=(80+60+70)/3 = 70
			expect(result.confidence).toBe(70);
		});

		it('divides only by pillars with data (2-of-3 case)', async () => {
			const attempts = [
				{
					drillType: 'vocabulary',
					drillAssignmentId: 'asgn-1',
					completedAt: THIS_WEEK,
					vocabularyResults: { wordScores: [{ word: 'a', pronunciationScore: 80, score: 80 }] },
				},
			];
			mockDrillAttemptFind.mockReturnValue(mockFind(attempts));
			mockFreeTalkAttemptFind.mockReturnValue(mockFind([
				{ gradeResult: { overallScore: 60 }, createdAt: THIS_WEEK },
			]));

			const result = await computeProgressScorecard(LEARNER_ID);
			// pronunciation=80, fluency=60, accuracy=0 (no data) → confidence=(80+60)/2 = 70
			expect(result.confidence).toBe(70);
		});

		it('returns 0 when no pillars have data', async () => {
			mockDrillAttemptFind.mockReturnValue(mockFind([]));
			mockFreeTalkAttemptFind.mockReturnValue(mockFind([]));

			const result = await computeProgressScorecard(LEARNER_ID);
			expect(result.confidence).toBe(0);
		});
	});

	describe('Weekly change', () => {
		it('computes positive pronunciationWeeklyChange when this week > last week', async () => {
			const attempts = [
				{
					drillType: 'vocabulary',
					drillAssignmentId: 'asgn-1',
					completedAt: THIS_WEEK,
					vocabularyResults: { wordScores: [{ word: 'a', pronunciationScore: 90, score: 90 }] },
				},
				{
					drillType: 'vocabulary',
					drillAssignmentId: 'asgn-2',
					completedAt: LAST_WEEK,
					vocabularyResults: { wordScores: [{ word: 'b', pronunciationScore: 60, score: 60 }] },
				},
			];
			mockDrillAttemptFind.mockReturnValue(mockFind(attempts));
			mockFreeTalkAttemptFind.mockReturnValue(mockFind([]));

			const result = await computeProgressScorecard(LEARNER_ID);
			expect(result.pronunciationWeeklyChange).toBe(30); // 90 - 60
		});

		it('returns 0 weekly change when only one window has data', async () => {
			const attempts = [
				{
					drillType: 'vocabulary',
					drillAssignmentId: 'asgn-1',
					completedAt: THIS_WEEK,
					vocabularyResults: { wordScores: [{ word: 'a', pronunciationScore: 90, score: 90 }] },
				},
			];
			mockDrillAttemptFind.mockReturnValue(mockFind(attempts));
			mockFreeTalkAttemptFind.mockReturnValue(mockFind([]));

			const result = await computeProgressScorecard(LEARNER_ID);
			expect(result.pronunciationWeeklyChange).toBe(0);
		});
	});

	describe('confidenceTrend', () => {
		it('is "improving" when confidenceWeeklyChange >= 3', async () => {
			// Set up data so confidence this week > last week by enough
			const makeAttempts = (completedAt: Date, score: number) => ({
				drillType: 'vocabulary',
				drillAssignmentId: 'asgn-1',
				completedAt,
				vocabularyResults: { wordScores: [{ word: 'a', pronunciationScore: score, score }] },
			});
			mockDrillAttemptFind.mockReturnValue(
				mockFind([makeAttempts(THIS_WEEK, 90), makeAttempts(LAST_WEEK, 50)]),
			);
			mockFreeTalkAttemptFind.mockReturnValue(mockFind([]));

			const result = await computeProgressScorecard(LEARNER_ID);
			expect(result.confidenceTrend).toBe('improving');
		});

		it('is "stable" when change is within ±3', async () => {
			const makeAttempts = (completedAt: Date, score: number) => ({
				drillType: 'vocabulary',
				drillAssignmentId: 'asgn-1',
				completedAt,
				vocabularyResults: { wordScores: [{ word: 'a', pronunciationScore: score, score }] },
			});
			mockDrillAttemptFind.mockReturnValue(
				mockFind([makeAttempts(THIS_WEEK, 80), makeAttempts(LAST_WEEK, 79)]),
			);
			mockFreeTalkAttemptFind.mockReturnValue(mockFind([]));

			const result = await computeProgressScorecard(LEARNER_ID);
			expect(result.confidenceTrend).toBe('stable');
		});
	});
});
