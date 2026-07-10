import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	accumulatePhonemeHits,
	buildPhonemeProblemAreas,
	extractPhonemesFromReviewSnapshot,
	mergePhonemeProblemAreas,
} from './pronunciation-phoneme-utils';

describe('extractPhonemesFromReviewSnapshot', () => {
	it('extracts phonemes below threshold and ignores passing ones', () => {
		const snapshot = {
			passThreshold: 70,
			groups: [
				{
					rows: [
						{
							text: 'think',
							textScore: {
								word_score_list: [
									{
										word: 'think',
										quality_score: 55,
										phone_score_list: [
											{ phone: 'θ', quality_score: 40 },
											{ phone: 'ɪ', quality_score: 85 },
											{ phone: 'ŋ', quality_score: 90 },
											{ phone: 'k', quality_score: 80 },
										],
									},
								],
							},
						},
					],
				},
			],
		};

		const result = extractPhonemesFromReviewSnapshot(snapshot, 70);

		assert.deepEqual(result.incorrectPhonemes, ['θ']);
		assert.ok(result.incorrectLetters.includes('t'));
		assert.equal(result.wordScores.length, 1);
		assert.equal(result.wordScores[0].word, 'think');
		assert.equal(result.wordScores[0].phonemes.length, 4);
	});

	it('returns empty arrays for null snapshot', () => {
		const result = extractPhonemesFromReviewSnapshot(null);
		assert.deepEqual(result.incorrectPhonemes, []);
		assert.deepEqual(result.incorrectLetters, []);
		assert.deepEqual(result.wordScores, []);
		assert.equal(result.textScore, 0);
	});
});

describe('mergePhonemeProblemAreas', () => {
	it('merges counts and word lists by phoneme', () => {
		const merged = mergePhonemeProblemAreas(
			[
				{
					phoneme: 'θ',
					count: 2,
					words: [{ word: 'think', count: 2 }],
				},
			],
			[
				{
					phoneme: 'θ',
					count: 3,
					words: [
						{ word: 'think', count: 1 },
						{ word: 'three', count: 2 },
					],
				},
				{
					phoneme: 'r',
					count: 1,
					words: [{ word: 'red', count: 1 }],
				},
			]
		);

		assert.equal(merged[0].phoneme, 'θ');
		assert.equal(merged[0].count, 5);
		assert.equal(merged[0].words.find((w) => w.word === 'think')?.count, 3);
		assert.equal(merged[1].phoneme, 'r');
	});
});

describe('buildPhonemeProblemAreas and accumulatePhonemeHits', () => {
	it('accumulates phoneme hits from extracted snapshot data', () => {
		const extracted = extractPhonemesFromReviewSnapshot(
			{
				groups: [
					{
						rows: [
							{
								text: 'think',
								textScore: {
									word_score_list: [
										{
											word: 'think',
											quality_score: 50,
											phone_score_list: [{ phone: 'θ', quality_score: 40 }],
										},
									],
								},
							},
						],
					},
				],
			},
			70
		);

		const counts = new Map<string, { count: number; words: Map<string, number> }>();
		accumulatePhonemeHits(counts, extracted, 70);

		const areas = buildPhonemeProblemAreas(counts);
		assert.equal(areas.length, 1);
		assert.equal(areas[0].phoneme, 'θ');
		assert.equal(areas[0].count, 1);
		assert.equal(areas[0].words[0].word, 'think');
	});
});
