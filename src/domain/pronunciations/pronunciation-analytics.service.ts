import { Types } from 'mongoose';
import PronunciationAttempt from '@/models/pronunciation-attempt';
import LearnerPronunciationProgress from '@/models/learner-pronunciation-progress';

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

function buildLearnerIdsMatch(learnerIds?: string[]): Record<string, unknown> {
	if (!learnerIds?.length) {
		return {};
	}
	const validIds = learnerIds
		.filter((id) => Types.ObjectId.isValid(id))
		.map((id) => new Types.ObjectId(id));
	if (validIds.length === 0) {
		return { learnerId: { $in: [] } };
	}
	return { learnerId: { $in: validIds } };
}

function buildOverallMatch(days?: number, learnerIds?: string[]): Record<string, unknown> {
	return {
		...buildDateMatch(days),
		...buildLearnerIdsMatch(learnerIds),
	};
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

export async function getOverallProblemAreasWithWords(
	days = 30,
	learnerIds?: string[]
): Promise<{
	topIncorrectPhonemes: PhonemeProblemArea[];
	topIncorrectLetters: LetterProblemArea[];
}> {
	const match = buildOverallMatch(days, learnerIds);
	const [topIncorrectPhonemes, topIncorrectLetters] = await Promise.all([
		aggregateSoundProblems(match, 'incorrectPhonemes', 'phoneme') as Promise<PhonemeProblemArea[]>,
		aggregateSoundProblems(match, 'incorrectLetters', 'letter') as Promise<LetterProblemArea[]>,
	]);

	return { topIncorrectPhonemes, topIncorrectLetters };
}

export async function getOverallStats(
	days = 30,
	learnerIds?: string[]
): Promise<OverallPronunciationStats> {
	const match = buildOverallMatch(days, learnerIds);
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

export async function getOverallDifficultWords(
	days = 30,
	learnerIds?: string[]
): Promise<DifficultWord[]> {
	const match = buildOverallMatch(days, learnerIds);
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

export interface AggregatedWordStats {
	totalWords: number;
	completedWords: number;
	challengingWords: number;
}

/**
 * Returns pronunciation word stats (total practiced, passed, challenging) for a
 * set of learners, matching the same data sources as the per-learner API:
 *
 *  1. Primary: LearnerPronunciationProgress records (modern flow).
 *  2. Fallback: PronunciationAttempt.wordScores for learners who have no
 *     progress records yet (older/mobile flow). A word counts as "completed" if
 *     any attempt scored ≥ 70, and "challenging" if it took > 3 attempts OR the
 *     average score was < 70.
 *
 * All counts are summed across learners so the platform view shows the aggregate
 * of every learner's individual stats rather than platform-unique word counts.
 */
export async function getAggregatedPronunciationWordStats(
	learnerIds?: string[]
): Promise<AggregatedWordStats> {
	const learnerMatch = buildLearnerIdsMatch(learnerIds);

	// ── 1. Progress-based word counts grouped by learner ────────────────────
	const progressByLearner = await LearnerPronunciationProgress.aggregate([
		{ $match: learnerMatch },
		{
			$group: {
				_id: '$learnerId',
				totalWords: { $sum: 1 },
				completedWords: { $sum: { $cond: ['$passed', 1, 0] } },
				challengingWords: { $sum: { $cond: ['$isChallenging', 1, 0] } },
			},
		},
	]);

	// Collect the learner IDs that already have progress records so we can
	// skip them in the attempt fallback below.
	const learnersWithProgress = new Set(
		progressByLearner.map((r: { _id: Types.ObjectId }) => r._id.toString())
	);

	let progressTotal = 0;
	let progressCompleted = 0;
	let progressChallenging = 0;
	for (const r of progressByLearner as Array<{
		totalWords: number;
		completedWords: number;
		challengingWords: number;
	}>) {
		progressTotal += r.totalWords;
		progressCompleted += r.completedWords;
		progressChallenging += r.challengingWords;
	}

	// ── 2. Attempt-fallback for learners with no progress records ───────────
	// Build a learner filter that excludes learners already covered above.
	const fallbackLearnerFilter = buildAttemptFallbackLearnerFilter(
		learnerIds,
		learnersWithProgress
	);

	// Skip the aggregation entirely when every in-scope learner already has
	// a progress record (or no learner IDs were given but progress covers all).
	let fallbackTotal = 0;
	let fallbackCompleted = 0;
	let fallbackChallenging = 0;

	if (fallbackLearnerFilter !== null) {
		const fallbackMatch: Record<string, unknown> = {
			...fallbackLearnerFilter,
			'wordScores.0': { $exists: true },
		};

		const fallbackByLearner = await PronunciationAttempt.aggregate([
			{ $match: fallbackMatch },
			{ $unwind: '$wordScores' },
			{
				$group: {
					_id: { learnerId: '$learnerId', word: { $toLower: '$wordScores.word' } },
					attempts: { $sum: 1 },
					avgScore: { $avg: '$wordScores.score' },
					passedAny: { $max: { $cond: [{ $gte: ['$wordScores.score', 70] }, 1, 0] } },
				},
			},
			{
				$group: {
					_id: null,
					totalWords: { $sum: 1 },
					completedWords: { $sum: '$passedAny' },
					challengingWords: {
						$sum: {
							$cond: [
								{
									$or: [
										{ $gt: ['$attempts', 3] },
										{ $lt: ['$avgScore', 70] },
									],
								},
								1,
								0,
							],
						},
					},
				},
			},
		]);

		if (fallbackByLearner.length > 0) {
			fallbackTotal = fallbackByLearner[0].totalWords ?? 0;
			fallbackCompleted = fallbackByLearner[0].completedWords ?? 0;
			fallbackChallenging = fallbackByLearner[0].challengingWords ?? 0;
		}
	}

	return {
		totalWords: progressTotal + fallbackTotal,
		completedWords: progressCompleted + fallbackCompleted,
		challengingWords: progressChallenging + fallbackChallenging,
	};
}

/**
 * Builds the learnerId match object for the attempt-fallback aggregation.
 *
 * Returns null when there is no point running the fallback:
 * - No specific learnerIds were requested AND every discovered learner already
 *   has progress records (we can't cheaply know that without another query, so
 *   we only skip when learnersWithProgress is non-empty AND no scoped list was
 *   given – edge-case optimisation, conservative approach otherwise).
 *
 * When learnerIds are provided, the returned filter restricts to those IDs that
 * are NOT already covered by progress records.
 */
function buildAttemptFallbackLearnerFilter(
	learnerIds: string[] | undefined,
	learnersWithProgress: Set<string>
): Record<string, unknown> | null {
	if (!learnerIds?.length) {
		// Platform-wide: include all learners that have no progress records.
		// We can't enumerate "all learners" cheaply here, so we just query
		// PronunciationAttempt and exclude the ones with progress.
		if (learnersWithProgress.size === 0) {
			// No progress records at all — fallback covers everyone.
			return {};
		}
		// Exclude learners already covered by the progress aggregation.
		const excludeIds = [...learnersWithProgress]
			.filter((id) => Types.ObjectId.isValid(id))
			.map((id) => new Types.ObjectId(id));
		return { learnerId: { $nin: excludeIds } };
	}

	// Scoped to specific learner IDs: only query those not already covered.
	const remaining = learnerIds
		.filter((id) => Types.ObjectId.isValid(id) && !learnersWithProgress.has(id))
		.map((id) => new Types.ObjectId(id));

	if (remaining.length === 0) {
		// All requested learners are covered by progress records — skip fallback.
		return null;
	}

	return { learnerId: { $in: remaining } };
}

/**
 * Returns the per-word stats array for a single learner from
 * PronunciationAttempt.wordScores. This is the fallback used when the learner
 * has no LearnerPronunciationProgress records (older/mobile flow).
 *
 * Exported so the per-learner analytics API route can reuse this logic instead
 * of maintaining a duplicate pipeline.
 */
export async function getLearnerAttemptFallbackWordStats(
	learnerId: Types.ObjectId
): Promise<
	Array<{
		wordId: null;
		title: string;
		text: string;
		difficulty: string;
		attempts: number;
		bestScore: number;
		averageScore: number;
		isChallenging: boolean;
		status: 'completed' | 'in-progress';
		lastAttemptAt: Date | null;
	}>
> {
	return PronunciationAttempt.aggregate([
		{
			$match: {
				learnerId,
				'wordScores.0': { $exists: true },
			},
		},
		{ $unwind: '$wordScores' },
		{
			$group: {
				_id: { $toLower: '$wordScores.word' },
				title: { $first: '$wordScores.word' },
				text: { $first: '$wordScores.word' },
				attempts: { $sum: 1 },
				bestScore: { $max: '$wordScores.score' },
				averageScore: { $avg: '$wordScores.score' },
				passedAny: {
					$max: { $cond: [{ $gte: ['$wordScores.score', 70] }, 1, 0] },
				},
				lastAttemptAt: { $max: '$createdAt' },
			},
		},
		{
			$project: {
				_id: 0,
				wordId: { $literal: null },
				title: 1,
				text: 1,
				difficulty: { $literal: '' },
				attempts: 1,
				bestScore: { $round: ['$bestScore', 2] },
				averageScore: { $round: ['$averageScore', 2] },
				isChallenging: {
					$or: [
						{ $gt: ['$attempts', 3] },
						{ $lt: ['$averageScore', 70] },
					],
				},
				status: {
					$cond: [{ $eq: ['$passedAny', 1] }, 'completed', 'in-progress'],
				},
				lastAttemptAt: 1,
			},
		},
		{ $sort: { lastAttemptAt: -1 } },
	]);
}
