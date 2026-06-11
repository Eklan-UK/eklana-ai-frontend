import { Types } from 'mongoose';
import PronunciationAttempt from '@/models/pronunciation-attempt';

export interface StrugglingWord {
	word: string;
	count: number;
}

export interface PhonemeProblemArea {
	phoneme: string;
	count: number;
	words: StrugglingWord[];
}

export interface LetterProblemArea {
	letter: string;
	count: number;
	words: StrugglingWord[];
}

export interface OverallPronunciationStats {
	totalAttempts: number;
	averageScore: number;
	passRate: number;
}

export interface DifficultWord {
	word: string;
	attempts: number;
	avgScore: number;
}

const MAX_PHONEMES = 10;
const MAX_LETTERS = 10;
const MAX_WORDS_PER_SOUND = 5;
const MAX_DIFFICULT_WORDS = 10;
const MIN_ATTEMPTS_FOR_DIFFICULT_WORD = 2;

/**
 * Resolve the practiced word label from an attempt document.
 * Supports problem-based (wordId), legacy assignment (pronunciationId), and drill wordScores.
 */
const struggledWordField = {
	$let: {
		vars: {
			fromWord: { $arrayElemAt: ['$pronunciationWord.word', 0] },
			fromPronunciation: { $arrayElemAt: ['$pronunciation.title', 0] },
			fromWordScores: { $arrayElemAt: ['$wordScores.word', 0] },
		},
		in: {
			$cond: [
				{ $and: [{ $ne: ['$$fromWord', null] }, { $ne: ['$$fromWord', ''] }] },
				'$$fromWord',
				{
					$cond: [
						{
							$and: [
								{ $ne: ['$$fromPronunciation', null] },
								{ $ne: ['$$fromPronunciation', ''] },
							],
						},
						'$$fromPronunciation',
						'$$fromWordScores',
					],
				},
			],
		},
	},
};

const wordLookupStages = [
	{
		$lookup: {
			from: 'pronunciation_words',
			localField: 'wordId',
			foreignField: '_id',
			as: 'pronunciationWord',
		},
	},
	{
		$lookup: {
			from: 'pronunciations',
			localField: 'pronunciationId',
			foreignField: '_id',
			as: 'pronunciation',
		},
	},
	{
		$addFields: {
			struggledWord: struggledWordField,
		},
	},
];

function buildDateMatch(days?: number): Record<string, unknown> {
	if (days == null) {
		return {};
	}
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);
	return { createdAt: { $gte: startDate } };
}

async function aggregateSoundProblems(
	match: Record<string, unknown>,
	field: 'incorrectPhonemes' | 'incorrectLetters',
	outputKey: 'phoneme' | 'letter'
): Promise<PhonemeProblemArea[] | LetterProblemArea[]> {
	const results = await PronunciationAttempt.aggregate([
		{ $match: match },
		{ $unwind: `$${field}` },
		{ $match: { [field]: { $nin: [null, ''] } } },
		...wordLookupStages,
		// Do NOT filter by struggledWord here — drill-based attempts may have no wordId/
		// pronunciationId and empty wordScores, so struggledWord would be null for them.
		// We still count every phoneme/letter error; the words list just omits null entries.
		{
			$group: {
				_id: {
					sound: `$${field}`,
					word: '$struggledWord',
				},
				count: { $sum: 1 },
			},
		},
		{
			$group: {
				_id: '$_id.sound',
				count: { $sum: '$count' },
				words: {
					$push: {
						$cond: [
							{ $and: [{ $ne: ['$_id.word', null] }, { $ne: ['$_id.word', ''] }] },
							{ word: '$_id.word', count: '$count' },
							null,
						],
					},
				},
			},
		},
		{ $sort: { count: -1 } },
		{
			$limit: outputKey === 'phoneme' ? MAX_PHONEMES : MAX_LETTERS,
		},
		{
			$project: {
				_id: 0,
				[outputKey]: '$_id',
				count: 1,
				words: {
					$slice: [
						{
							$sortArray: {
								input: {
									$filter: {
										input: '$words',
										cond: { $ne: ['$$this', null] },
									},
								},
								sortBy: { count: -1 },
							},
						},
						MAX_WORDS_PER_SOUND,
					],
				},
			},
		},
	]);

	return results;
}

export async function getProblemAreasWithWords(learnerId: Types.ObjectId): Promise<{
	topIncorrectPhonemes: PhonemeProblemArea[];
	topIncorrectLetters: LetterProblemArea[];
}> {
	const match = { learnerId };
	const [topIncorrectPhonemes, topIncorrectLetters] = await Promise.all([
		aggregateSoundProblems(match, 'incorrectPhonemes', 'phoneme') as Promise<PhonemeProblemArea[]>,
		aggregateSoundProblems(match, 'incorrectLetters', 'letter') as Promise<LetterProblemArea[]>,
	]);

	return { topIncorrectPhonemes, topIncorrectLetters };
}

export async function getOverallProblemAreasWithWords(days = 30): Promise<{
	topIncorrectPhonemes: PhonemeProblemArea[];
	topIncorrectLetters: LetterProblemArea[];
}> {
	const match = buildDateMatch(days);
	const [topIncorrectPhonemes, topIncorrectLetters] = await Promise.all([
		aggregateSoundProblems(match, 'incorrectPhonemes', 'phoneme') as Promise<PhonemeProblemArea[]>,
		aggregateSoundProblems(match, 'incorrectLetters', 'letter') as Promise<LetterProblemArea[]>,
	]);

	return { topIncorrectPhonemes, topIncorrectLetters };
}

export async function getOverallStats(days = 30): Promise<OverallPronunciationStats> {
	const match = buildDateMatch(days);
	const overallStats = await PronunciationAttempt.aggregate([
		{ $match: match },
		{
			$group: {
				_id: null,
				totalAttempts: { $sum: 1 },
				averageScore: { $avg: '$textScore' },
				passedCount: {
					$sum: { $cond: [{ $eq: ['$passed', true] }, 1, 0] },
				},
			},
		},
		{
			$project: {
				_id: 0,
				totalAttempts: 1,
				averageScore: { $round: ['$averageScore', 1] },
				passRate: {
					$cond: [
						{ $gt: ['$totalAttempts', 0] },
						{
							$multiply: [
								{ $divide: ['$passedCount', '$totalAttempts'] },
								100,
							],
						},
						0,
					],
				},
			},
		},
	]);

	const stats = overallStats[0] || {
		totalAttempts: 0,
		averageScore: 0,
		passRate: 0,
	};

	return {
		totalAttempts: stats.totalAttempts,
		averageScore: stats.averageScore ?? 0,
		passRate: Math.round((stats.passRate ?? 0) * 10) / 10,
	};
}

export async function getOverallDifficultWords(days = 30): Promise<DifficultWord[]> {
	const match = buildDateMatch(days);
	const results = await PronunciationAttempt.aggregate([
		{ $match: match },
		...wordLookupStages,
		{ $match: { struggledWord: { $nin: [null, ''] } } },
		{
			$group: {
				_id: '$struggledWord',
				attempts: { $sum: 1 },
				avgScore: { $avg: '$textScore' },
			},
		},
		{ $match: { attempts: { $gte: MIN_ATTEMPTS_FOR_DIFFICULT_WORD } } },
		{
			$project: {
				_id: 0,
				word: '$_id',
				attempts: 1,
				avgScore: { $round: ['$avgScore', 1] },
			},
		},
		{ $sort: { avgScore: 1 } },
		{ $limit: MAX_DIFFICULT_WORDS },
	]);

	return results;
}
