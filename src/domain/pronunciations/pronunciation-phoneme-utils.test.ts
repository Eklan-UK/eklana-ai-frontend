import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	accumulateLetterHits,
	accumulatePhonemeHits,
	buildLetterProblemAreas,
	buildPhonemeProblemAreas,
	extractPhonemesFromReviewSnapshot,
	mergeLetterProblemAreas,
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

describe('mergeLetterProblemAreas', () => {
	it('merges counts and word lists by letter', () => {
		const merged = mergeLetterProblemAreas(
			[
				{
					letter: 't',
					count: 2,
					words: [{ word: 'think', count: 2 }],
				},
			],
			[
				{
					letter: 't',
					count: 3,
					words: [
						{ word: 'think', count: 1 },
						{ word: 'three', count: 2 },
					],
				},
				{
					letter: 'r',
					count: 1,
					words: [{ word: 'red', count: 1 }],
				},
			]
		);

		assert.equal(merged[0].letter, 't');
		assert.equal(merged[0].count, 5);
		assert.equal(merged[0].words.find((w) => w.word === 'think')?.count, 3);
		assert.equal(merged[1].letter, 'r');
	});
});

describe('buildLetterProblemAreas and accumulateLetterHits', () => {
	it('accumulates unique a-z letters from failing words only', () => {
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
							{
								text: 'good',
								textScore: {
									word_score_list: [
										{
											word: 'good',
											quality_score: 90,
											phone_score_list: [{ phone: 'g', quality_score: 90 }],
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
		accumulateLetterHits(counts, extracted, 70);

		const areas = buildLetterProblemAreas(counts);
		assert.ok(areas.length >= 1);
		assert.ok(areas.every((a) => a.letter.length === 1 && /[a-z]/.test(a.letter)));
		assert.ok(!areas.some((a) => a.words.some((w) => w.word === 'good')));

		const t = areas.find((a) => a.letter === 't');
		assert.ok(t);
		assert.equal(t.count, 1);
		assert.equal(t.words[0].word, 'think');

		// Duplicate letters within a word count once (e.g. "book" → o once)
		const bookCounts = new Map<string, { count: number; words: Map<string, number> }>();
		accumulateLetterHits(
			bookCounts,
			{
				incorrectPhonemes: [],
				incorrectLetters: [],
				wordScores: [{ word: 'book', score: 40, phonemes: [] }],
				textScore: 40,
			},
			70
		);
		assert.equal(bookCounts.get('o')?.count, 1);
		assert.equal(bookCounts.get('b')?.count, 1);
		assert.equal(bookCounts.get('k')?.count, 1);
	});
});
