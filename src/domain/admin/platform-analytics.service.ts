import { Types } from 'mongoose';
import { toUserIdQueryMulti } from '@/lib/api/user-id';
import User from '@/models/user';
import DrillAssignment from '@/models/drill-assignment';
import DrillAttempt from '@/models/drill-attempt';
import LearnerPronunciationProgress from '@/models/learner-pronunciation-progress';
import {
	getOverallProblemAreasWithWords,
	getOverallStats,
	getAggregatedPronunciationWordStats,
	type OverallPronunciationStats,
	type PhonemeProblemArea,
} from '@/domain/pronunciations/pronunciation-analytics.service';

export interface PlatformDrillOverview {
	learners: {
		totalActive: number;
		totalWithAssignments: number;
	};
	drills: {
		totalAssignments: number;
		completed: number;
		inProgress: number;
		pending: number;
		overdue: number;
		averageScore: number;
		completionRatePct: number;
	};
}

export interface LearnerAnalyticsSummary {
	drillCompletionRatePct: number;
	drillAverageScore: number;
	pronunciationAverageScore: number;
	overallProgressPct: number;
}

export interface AnalyticsDashboardDrillStats {
	total: number;
	completed: number;
	inProgress: number;
	pending: number;
	overdue: number;
	pendingReview: number;
	completionRatePct: number;
	averageScore: number;
}

export interface AnalyticsDashboardProgressDrillStats {
	total: number;
	completed: number;
	completionRatePct: number;
	averageScore: number;
}

export interface AnalyticsDashboardProgressPronunciationStats {
	totalWords: number;
	completedWords: number;
	completionRatePct: number;
	averageScore: number;
}

export interface AnalyticsDashboardProgress {
	overallProgressPct: number;
	overallAverageScore: number;
	pendingReviewCount: number;
	drillStats: AnalyticsDashboardProgressDrillStats;
	pronunciationStats: AnalyticsDashboardProgressPronunciationStats;
}

export interface AnalyticsDashboardGrammarStats {
	totalAssignedPatterns: number;
	correctSentence: number;
	incorrectSentence: number;
}

export interface AnalyticsDashboardSentenceStats {
	totalAssignedTargets: number;
	correctSentence: number;
	incorrectSentence: number;
}

export interface AnalyticsDashboardMatchingStats {
	totalAssignedPairs: number;
	accuracyRatePct: number;
	totalAttempts: number;
	fastMatches: number;
	slowMatches: number;
	slowestMatchSeconds: number | null;
	slowestMatchLabel: string | null;
}

export interface DrillTypeAssignmentStats {
	totalAssigned: number;
	totalCompleted: number;
	completionRatePct: number;
}

export interface AnalyticsDashboardFillBlankStats extends DrillTypeAssignmentStats {
	totalAssignedBlanks: number;
	correctBlanks: number;
	incorrectBlanks: number;
	accuracyRatePct: number;
	totalAttempts: number;
	averageScore: number;
}

export interface AnalyticsDashboardKeyPhrasesStats extends DrillTypeAssignmentStats {
	totalAssignedItems: number;
	correctItems: number;
	incorrectItems: number;
	accuracyRatePct: number;
	totalAttempts: number;
	averageScore: number;
	averagePronunciationScore: number;
}

type FillBlankAttemptStats = Omit<
	AnalyticsDashboardFillBlankStats,
	keyof DrillTypeAssignmentStats
>;

type KeyPhrasesAttemptStats = Omit<
	AnalyticsDashboardKeyPhrasesStats,
	keyof DrillTypeAssignmentStats
>;

interface FillBlankFromAttemptsResult {
	stats: FillBlankAttemptStats;
	problemRows: FillBlankProblemRow[];
}

interface KeyPhrasesFromAttemptsResult {
	stats: KeyPhrasesAttemptStats;
	problemRows: KeyPhraseProblemRow[];
}

export interface FillBlankProblemRow {
	id: string;
	sentence: string;
	selectedAnswer: string;
	correctAnswer: string;
	count: number;
}

export interface KeyPhraseProblemRow {
	id: string;
	prompt: string;
	selectedAnswer: string;
	correctAnswer: string;
	count: number;
}

export interface PlatformFillBlankAnalytics {
	stats: AnalyticsDashboardFillBlankStats;
	problemRows: FillBlankProblemRow[];
}

export interface PlatformKeyPhrasesAnalytics {
	stats: AnalyticsDashboardKeyPhrasesStats;
	problemRows: KeyPhraseProblemRow[];
}

export interface AnalyticsDashboardPronunciation {
	overall: OverallPronunciationStats;
	challengingWords?: number;
	problemAreas: {
		topIncorrectPhonemes: PhonemeProblemArea[];
	};
}

export interface AnalyticsDashboardResponse {
	progress: AnalyticsDashboardProgress;
	drills: AnalyticsDashboardDrillStats;
	pronunciation: AnalyticsDashboardPronunciation;
	grammar: AnalyticsDashboardGrammarStats;
	sentence: AnalyticsDashboardSentenceStats;
	matching: AnalyticsDashboardMatchingStats;
	fillBlank: AnalyticsDashboardFillBlankStats;
	keyPhrases: AnalyticsDashboardKeyPhrasesStats;
}

function startOfDay(dateString: string): Date {
	const date = new Date(dateString);
	date.setHours(0, 0, 0, 0);
	return date;
}

function endOfDay(dateString: string): Date {
	const date = new Date(dateString);
	date.setHours(23, 59, 59, 999);
	return date;
}

export function buildLearnerQuery(searchParams: URLSearchParams): Record<string, unknown> {
	const query: Record<string, unknown> = { role: 'user' };

	const search = searchParams.get('search')?.trim();
	const signupDateFrom = searchParams.get('signupDateFrom');
	const signupDateTo = searchParams.get('signupDateTo');
	const status = searchParams.get('status');

	if (search) {
		query.$or = [
			{ firstName: { $regex: search, $options: 'i' } },
			{ lastName: { $regex: search, $options: 'i' } },
			{ name: { $regex: search, $options: 'i' } },
			{ email: { $regex: search, $options: 'i' } },
		];
	}

	if (signupDateFrom || signupDateTo) {
		const createdAt: Record<string, Date> = {};
		if (signupDateFrom) createdAt.$gte = startOfDay(signupDateFrom);
		if (signupDateTo) createdAt.$lte = endOfDay(signupDateTo);
		query.createdAt = createdAt;
	}

	if (status === 'active') {
		query.isActive = { $ne: false };
	} else if (status === 'inactive') {
		query.isActive = false;
	}

	return query;
}

function computeOverallProgressPct(
	drillTotal: number,
	drillCompleted: number,
	wordTotal: number,
	wordCompleted: number
): number {
	const drillCompletionRate =
		drillTotal > 0 ? Math.round((drillCompleted / drillTotal) * 100) : 0;
	const wordCompletionRate =
		wordTotal > 0 ? Math.round((wordCompleted / wordTotal) * 100) : 0;

	if (drillTotal > 0 && wordTotal > 0) {
		return Math.round(drillCompletionRate * 0.5 + wordCompletionRate * 0.5);
	}
	if (drillTotal > 0) return drillCompletionRate;
	if (wordTotal > 0) return wordCompletionRate;
	return 0;
}

export async function getPlatformDrillOverview(): Promise<PlatformDrillOverview> {
	const [totalActive, totalWithAssignments, statusAggregation, avgScoreResult] =
		await Promise.all([
			User.countDocuments({ role: 'user', isActive: { $ne: false } }).exec(),
			DrillAssignment.distinct('learnerId').then((ids) => ids.length),
			DrillAssignment.aggregate([
				{
					$group: {
						_id: '$status',
						count: { $sum: 1 },
					},
				},
			]),
			DrillAssignment.aggregate([
				{ $match: { status: 'completed' } },
				{
					$lookup: {
						from: 'drill_attempts',
						localField: '_id',
						foreignField: 'drillAssignmentId',
						as: 'attempts',
					},
				},
				{ $unwind: { path: '$attempts', preserveNullAndEmptyArrays: true } },
				{
					$group: {
						_id: null,
						avgScore: { $avg: '$attempts.score' },
						count: { $sum: 1 },
					},
				},
			]),
		]);

	const statusCounts = statusAggregation.reduce<Record<string, number>>(
		(acc, item: { _id: string; count: number }) => {
			acc[item._id] = item.count;
			return acc;
		},
		{}
	);

	const totalAssignments = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);
	const completed = statusCounts['completed'] || 0;
	const inProgress = statusCounts['in-progress'] || 0;
	const pending = statusCounts['pending'] || 0;
	const overdue = statusCounts['overdue'] || 0;

	const averageScore =
		avgScoreResult.length > 0 && avgScoreResult[0].count > 0
			? Math.round((avgScoreResult[0].avgScore || 0) * 100) / 100
			: 0;

	const completionRatePct =
		totalAssignments > 0
			? Math.round((completed / totalAssignments) * 100 * 100) / 100
			: 0;

	return {
		learners: {
			totalActive,
			totalWithAssignments,
		},
		drills: {
			totalAssignments,
			completed,
			inProgress,
			pending,
			overdue,
			averageScore,
			completionRatePct,
		},
	};
}

async function getLearnerSummaryMaps(learnerIds: Types.ObjectId[]): Promise<
	Map<string, LearnerAnalyticsSummary>
> {
	if (learnerIds.length === 0) {
		return new Map();
	}

	const [drillStats, drillScores, pronunciationStats] = await Promise.all([
		DrillAssignment.aggregate([
			{ $match: { learnerId: { $in: learnerIds } } },
			{
				$group: {
					_id: '$learnerId',
					total: { $sum: 1 },
					completed: {
						$sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
					},
				},
			},
		]),
		DrillAssignment.aggregate([
			{
				$match: {
					learnerId: { $in: learnerIds },
					status: 'completed',
				},
			},
			{
				$lookup: {
					from: 'drill_attempts',
					localField: '_id',
					foreignField: 'drillAssignmentId',
					as: 'attempts',
				},
			},
			{ $unwind: { path: '$attempts', preserveNullAndEmptyArrays: false } },
			{
				$group: {
					_id: '$learnerId',
					avgScore: { $avg: '$attempts.score' },
				},
			},
		]),
		LearnerPronunciationProgress.aggregate([
			{ $match: { learnerId: { $in: learnerIds } } },
			{
				$group: {
					_id: '$learnerId',
					totalWords: { $sum: 1 },
					completedWords: {
						$sum: { $cond: ['$passed', 1, 0] },
					},
					avgScore: { $avg: '$averageScore' },
				},
			},
		]),
	]);

	const drillMap = new Map(
		drillStats.map((d: { _id: Types.ObjectId; total: number; completed: number }) => [
			d._id.toString(),
			d,
		])
	);
	const scoreMap = new Map(
		drillScores.map((d: { _id: Types.ObjectId; avgScore: number }) => [
			d._id.toString(),
			d.avgScore || 0,
		])
	);
	const pronunciationMap = new Map(
		pronunciationStats.map(
			(p: {
				_id: Types.ObjectId;
				totalWords: number;
				completedWords: number;
				avgScore: number;
			}) => [p._id.toString(), p]
		)
	);

	const summaryMap = new Map<string, LearnerAnalyticsSummary>();

	for (const id of learnerIds) {
		const idStr = id.toString();
		const drill = drillMap.get(idStr) as { total: number; completed: number } | undefined;
		const pronunciation = pronunciationMap.get(idStr) as
			| { totalWords: number; completedWords: number; avgScore: number }
			| undefined;

		const drillTotal = drill?.total || 0;
		const drillCompleted = drill?.completed || 0;
		const wordTotal = pronunciation?.totalWords || 0;
		const wordCompleted = pronunciation?.completedWords || 0;

		const drillCompletionRatePct =
			drillTotal > 0 ? Math.round((drillCompleted / drillTotal) * 100) : 0;
		const drillAverageScore = Math.round((scoreMap.get(idStr) as number) || 0);
		const pronunciationAverageScore = Math.round(pronunciation?.avgScore || 0);

		summaryMap.set(idStr, {
			drillCompletionRatePct,
			drillAverageScore,
			pronunciationAverageScore,
			overallProgressPct: computeOverallProgressPct(
				drillTotal,
				drillCompleted,
				wordTotal,
				wordCompleted
			),
		});
	}

	return summaryMap;
}

export async function getAnalyticsLearners(searchParams: URLSearchParams) {
	const limit = parseInt(searchParams.get('limit') || '20', 10);
	const offset = parseInt(searchParams.get('offset') || '0', 10);
	const query = buildLearnerQuery(searchParams);

	const total = await User.countDocuments(query).exec();

	const users = await User.find(query)
		.select('-password -__v')
		.sort({ createdAt: -1 })
		.limit(limit)
		.skip(offset)
		.lean()
		.exec();

	const learnerIds = users.map((u) => u._id as Types.ObjectId);
	const summaryMap = await getLearnerSummaryMaps(learnerIds);

	const learners = users.map((user) => {
		const idStr = user._id.toString();
		const summary = summaryMap.get(idStr) || {
			drillCompletionRatePct: 0,
			drillAverageScore: 0,
			pronunciationAverageScore: 0,
			overallProgressPct: 0,
		};

		return {
			...user,
			summary,
		};
	});

	return {
		learners,
		pagination: {
			total,
			limit,
			offset,
			hasMore: offset + users.length < total,
		},
	};
}

function buildLearnerIdMatch(learnerIds?: string[]): Record<string, unknown> {
	if (!learnerIds?.length) {
		return {};
	}
	const validIds = toUserIdQueryMulti(learnerIds.filter((id) => id));
	if (validIds.length === 0) {
		return { learnerId: { $in: [] } };
	}
	return { learnerId: { $in: validIds } };
}

function buildCompletedAtFilter(days?: number): Record<string, unknown> {
	if (days == null) {
		return {};
	}
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);
	return { completedAt: { $gte: startDate } };
}

function computeOverallAverageScore(
	drillAverageScore: number,
	pronunciationAverageScore: number
): number {
	if (drillAverageScore > 0 && pronunciationAverageScore > 0) {
		return Math.round((drillAverageScore + pronunciationAverageScore) / 2);
	}
	if (drillAverageScore > 0) return Math.round(drillAverageScore);
	if (pronunciationAverageScore > 0) return Math.round(pronunciationAverageScore);
	return 0;
}

async function getDrillTypeAssignmentStats(
	learnerMatch: Record<string, unknown>,
	drillType: 'fill_blank' | 'key_phrases',
	dateRange?: { from?: Date; to?: Date }
): Promise<DrillTypeAssignmentStats> {
	const dateFilter: Record<string, unknown> = {};
	if (dateRange?.from || dateRange?.to) {
		const completedAt: { $gte?: Date; $lte?: Date } = {};
		if (dateRange.from) completedAt.$gte = dateRange.from;
		if (dateRange.to) completedAt.$lte = dateRange.to;
		if (Object.keys(completedAt).length > 0) {
			dateFilter.completedAt = completedAt;
		}
	}

	const result = await DrillAssignment.aggregate([
		{ $match: { ...learnerMatch, ...dateFilter } },
		{
			$lookup: {
				from: 'drills',
				localField: 'drillId',
				foreignField: '_id',
				as: 'drill',
			},
		},
		{ $unwind: '$drill' },
		{ $match: { 'drill.type': drillType } },
		{
			$group: {
				_id: null,
				totalAssigned: { $sum: 1 },
				totalCompleted: {
					$sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
				},
			},
		},
	]);

	const totalAssigned = result[0]?.totalAssigned ?? 0;
	const totalCompleted = result[0]?.totalCompleted ?? 0;
	const completionRatePct =
		totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

	return { totalAssigned, totalCompleted, completionRatePct };
}

async function getDrillAssignmentAggregates(
	learnerMatch: Record<string, unknown>
): Promise<{
	statusCounts: Record<string, number>;
	averageScore: number;
	pendingReview: number;
}> {
	const [statusAggregation, avgScoreResult, pendingReviewResult] = await Promise.all([
		DrillAssignment.aggregate([
			{ $match: learnerMatch },
			{
				$group: {
					_id: '$status',
					count: { $sum: 1 },
				},
			},
		]),
		DrillAssignment.aggregate([
			{ $match: { ...learnerMatch, status: 'completed' } },
			{
				$lookup: {
					from: 'drill_attempts',
					localField: '_id',
					foreignField: 'drillAssignmentId',
					as: 'attempts',
				},
			},
			{ $unwind: { path: '$attempts', preserveNullAndEmptyArrays: true } },
			{
				$group: {
					_id: null,
					avgScore: { $avg: '$attempts.score' },
					count: { $sum: 1 },
				},
			},
		]),
		DrillAssignment.aggregate([
			{ $match: learnerMatch },
			{
				$lookup: {
					from: 'drill_attempts',
					localField: '_id',
					foreignField: 'drillAssignmentId',
					as: 'attempts',
				},
			},
			{
				$match: {
					attempts: { $elemMatch: { requiresReview: true } },
				},
			},
			{ $count: 'count' },
		]),
	]);

	const statusCounts = statusAggregation.reduce<Record<string, number>>(
		(acc, item: { _id: string; count: number }) => {
			acc[item._id] = item.count;
			return acc;
		},
		{}
	);

	const averageScore =
		avgScoreResult.length > 0 && avgScoreResult[0].count > 0
			? Math.round((avgScoreResult[0].avgScore || 0) * 100) / 100
			: 0;

	return {
		statusCounts,
		averageScore,
		pendingReview: pendingReviewResult[0]?.count ?? 0,
	};
}

async function aggregateGrammarStats(
	learnerMatch: Record<string, unknown>,
	days?: number
): Promise<AnalyticsDashboardGrammarStats> {
	const filter: Record<string, unknown> = {
		...learnerMatch,
		'grammarResults.patterns.0': { $exists: true },
		...buildCompletedAtFilter(days),
	};

	const attempts = await DrillAttempt.find(filter)
		.select('grammarResults')
		.lean()
		.exec();

	let totalAssignedPatterns = 0;
	let correctSentence = 0;
	let incorrectSentence = 0;

	for (const att of attempts) {
		const gr = att.grammarResults as
			| {
					patterns?: Array<{ sentences?: Array<{ text?: string; index?: number }> }>;
					reviewStatus?: string;
					patternReviews?: Array<{
						patternIndex: number;
						sentenceIndex: number;
						isCorrect: boolean;
					}>;
			  }
			| undefined;

		const patterns = gr?.patterns ?? [];
		totalAssignedPatterns += patterns.length;

		if (gr?.reviewStatus !== 'reviewed' || !gr.patternReviews?.length) {
			continue;
		}

		for (const rev of gr.patternReviews) {
			if (rev.isCorrect) {
				correctSentence += 1;
			} else {
				incorrectSentence += 1;
			}
		}
	}

	return { totalAssignedPatterns, correctSentence, incorrectSentence };
}

type SentenceSlot = {
	globalIndex: number;
	wordIndex: number;
	learnerText: string;
	sentIndexField: number;
};

function flattenSentenceSlots(sr: {
	word?: string;
	definition?: string;
	sentences?: Array<{ text?: string; index?: number }>;
	words?: Array<{
		word?: string;
		sentences?: Array<{ text?: string; index?: number }>;
	}>;
}): SentenceSlot[] {
	const useWords = sr.words && Array.isArray(sr.words) && sr.words.length > 0;
	const words: Array<{
		word?: string;
		definition?: string;
		sentences?: Array<{ text?: string; index?: number }>;
	}> = useWords && sr.words
		? [...sr.words]
		: [{ word: sr.word, definition: sr.definition, sentences: sr.sentences || [] }];
	const slots: SentenceSlot[] = [];
	let g = 0;
	for (let wi = 0; wi < words.length; wi++) {
		const w = words[wi];
		const sents = w.sentences || [];
		for (let si = 0; si < sents.length; si++) {
			const sent = sents[si];
			slots.push({
				globalIndex: g,
				wordIndex: wi,
				learnerText: String(sent.text ?? ''),
				sentIndexField: typeof sent.index === 'number' ? sent.index : si,
			});
			g++;
		}
	}
	return slots;
}

async function aggregateSentenceStats(
	learnerMatch: Record<string, unknown>,
	days?: number
): Promise<AnalyticsDashboardSentenceStats> {
	const filter: Record<string, unknown> = {
		...learnerMatch,
		sentenceResults: { $exists: true, $ne: null },
		$or: [
			{ 'sentenceResults.sentences.0': { $exists: true } },
			{ 'sentenceResults.words.0': { $exists: true } },
		],
		...buildCompletedAtFilter(days),
	};

	const attempts = await DrillAttempt.find(filter)
		.select('sentenceResults')
		.lean()
		.exec();

	let totalAssignedTargets = 0;
	let correctSentence = 0;
	let incorrectSentence = 0;

	for (const att of attempts) {
		const sr = att.sentenceResults as
			| {
					word?: string;
					definition?: string;
					sentences?: Array<{ text?: string; index?: number }>;
					words?: Array<{
						word?: string;
						sentences?: Array<{ text?: string; index?: number }>;
					}>;
					reviewStatus?: string;
					sentenceReviews?: Array<{
						sentenceIndex: number;
						isCorrect: boolean;
					}>;
			  }
			| undefined;

		if (!sr) continue;

		const slots = flattenSentenceSlots(sr);
		if (slots.length === 0) continue;

		totalAssignedTargets += slots.length;

		if (sr.reviewStatus !== 'reviewed' || !sr.sentenceReviews?.length) {
			continue;
		}

		for (const rev of sr.sentenceReviews) {
			if (rev.isCorrect) {
				correctSentence += 1;
			} else {
				incorrectSentence += 1;
			}
		}
	}

	return { totalAssignedTargets, correctSentence, incorrectSentence };
}

type MatchingResultsLean = {
	pairsMatched?: number;
	totalPairs?: number;
	incorrectPairs?: Array<{ left?: string; right?: string; attemptedMatch?: string }>;
	pairMatchEvents?: Array<{ durationSec?: number; left?: string; right?: string }>;
};

function splitByMedian(durations: number[]): { fast: number; slow: number } {
	if (durations.length === 0) return { fast: 0, slow: 0 };
	const sorted = [...durations].sort((a, b) => a - b);
	const n = sorted.length;
	const median =
		n % 2 === 1
			? sorted[Math.floor(n / 2)]
			: (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
	let fast = 0;
	let slow = 0;
	for (const d of durations) {
		if (d < median) fast++;
		else slow++;
	}
	return { fast, slow };
}

type FillBlankResultsLean = {
	items?: Array<{
		sentence?: string;
		blanks?: Array<{
			position?: number;
			selectedAnswer?: string;
			correctAnswer?: string;
			isCorrect?: boolean;
		}>;
	}>;
	totalBlanks?: number;
	correctBlanks?: number;
	score?: number;
};

type KeyPhrasesResultsLean = {
	items?: Array<{
		prompt?: string;
		selectedAnswer?: string;
		correctAnswer?: string;
		isCorrect?: boolean;
		pronunciationScore?: number;
		attempts?: number;
	}>;
	totalItems?: number;
	correctItems?: number;
	score?: number;
};

const MAX_PROBLEM_ROWS = 20;

function aggregateFillBlankFromAttempts(
	attempts: Array<{ fillBlankResults?: FillBlankResultsLean }>,
	includeProblemRows = false
): FillBlankFromAttemptsResult {
	let totalAssignedBlanks = 0;
	let correctBlanks = 0;
	let incorrectBlanks = 0;
	let totalAttempts = 0;
	let scoreSum = 0;
	let scoreCount = 0;
	const problemMap = new Map<string, FillBlankProblemRow>();

	for (const att of attempts) {
		const fb = att.fillBlankResults;
		if (!fb?.items?.length) continue;

		totalAttempts++;

		let attemptBlanks = 0;
		let attemptCorrect = 0;

		if (typeof fb.totalBlanks === 'number' && fb.totalBlanks > 0) {
			attemptBlanks = fb.totalBlanks;
			attemptCorrect =
				typeof fb.correctBlanks === 'number' ? fb.correctBlanks : 0;
		} else {
			for (const item of fb.items) {
				for (const blank of item.blanks ?? []) {
					attemptBlanks++;
					if (blank.isCorrect) attemptCorrect++;
				}
			}
		}

		if (includeProblemRows) {
			for (const item of fb.items) {
				for (const blank of item.blanks ?? []) {
					if (blank.isCorrect) continue;
					const sentence = String(item.sentence ?? '').trim();
					const selectedAnswer = String(blank.selectedAnswer ?? '').trim();
					const correctAnswer = String(blank.correctAnswer ?? '').trim();
					const key = `${sentence}|${selectedAnswer}|${correctAnswer}`;
					const prev = problemMap.get(key);
					problemMap.set(key, {
						id: key,
						sentence: sentence || '(empty)',
						selectedAnswer: selectedAnswer || '(empty)',
						correctAnswer: correctAnswer || '(empty)',
						count: (prev?.count ?? 0) + 1,
					});
				}
			}
		}

		totalAssignedBlanks += attemptBlanks;
		correctBlanks += attemptCorrect;
		incorrectBlanks += attemptBlanks - attemptCorrect;

		if (typeof fb.score === 'number' && Number.isFinite(fb.score)) {
			scoreSum += fb.score;
			scoreCount++;
		}
	}

	const accuracyRatePct =
		totalAssignedBlanks > 0
			? Math.round((correctBlanks / totalAssignedBlanks) * 100)
			: 0;

	const problemRows = [...problemMap.values()]
		.sort((a, b) => b.count - a.count)
		.slice(0, MAX_PROBLEM_ROWS);

	return {
		stats: {
			totalAssignedBlanks,
			correctBlanks,
			incorrectBlanks,
			accuracyRatePct,
			totalAttempts,
			averageScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0,
		},
		problemRows,
	};
}

function aggregateKeyPhrasesFromAttempts(
	attempts: Array<{ keyPhrasesResults?: KeyPhrasesResultsLean }>,
	includeProblemRows = false
): KeyPhrasesFromAttemptsResult {
	let totalAssignedItems = 0;
	let correctItems = 0;
	let incorrectItems = 0;
	let totalAttempts = 0;
	let scoreSum = 0;
	let scoreCount = 0;
	let pronunciationSum = 0;
	let pronunciationCount = 0;
	const problemMap = new Map<string, KeyPhraseProblemRow>();

	for (const att of attempts) {
		const kp = att.keyPhrasesResults;
		if (!kp?.items?.length) continue;

		totalAttempts++;

		let attemptItems = 0;
		let attemptCorrect = 0;

		if (typeof kp.totalItems === 'number' && kp.totalItems > 0) {
			attemptItems = kp.totalItems;
			attemptCorrect =
				typeof kp.correctItems === 'number' ? kp.correctItems : 0;
		} else {
			for (const item of kp.items) {
				attemptItems++;
				if (item.isCorrect) attemptCorrect++;
			}
		}

		for (const item of kp.items) {
			if (typeof item.pronunciationScore === 'number' && Number.isFinite(item.pronunciationScore)) {
				pronunciationSum += item.pronunciationScore;
				pronunciationCount++;
			}
			if (includeProblemRows && !item.isCorrect) {
				const prompt = String(item.prompt ?? '').trim();
				const selectedAnswer = String(item.selectedAnswer ?? '').trim();
				const correctAnswer = String(item.correctAnswer ?? '').trim();
				const key = `${prompt}|${selectedAnswer}|${correctAnswer}`;
				const prev = problemMap.get(key);
				problemMap.set(key, {
					id: key,
					prompt: prompt || '(empty)',
					selectedAnswer: selectedAnswer || '(empty)',
					correctAnswer: correctAnswer || '(empty)',
					count: (prev?.count ?? 0) + 1,
				});
			}
		}

		totalAssignedItems += attemptItems;
		correctItems += attemptCorrect;
		incorrectItems += attemptItems - attemptCorrect;

		if (typeof kp.score === 'number' && Number.isFinite(kp.score)) {
			scoreSum += kp.score;
			scoreCount++;
		}
	}

	const accuracyRatePct =
		totalAssignedItems > 0
			? Math.round((correctItems / totalAssignedItems) * 100)
			: 0;

	const problemRows = [...problemMap.values()]
		.sort((a, b) => b.count - a.count)
		.slice(0, MAX_PROBLEM_ROWS);

	return {
		stats: {
			totalAssignedItems,
			correctItems,
			incorrectItems,
			accuracyRatePct,
			totalAttempts,
			averageScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0,
			averagePronunciationScore:
				pronunciationCount > 0
					? Math.round(pronunciationSum / pronunciationCount)
					: 0,
		},
		problemRows,
	};
}

async function aggregateFillBlankStats(
	learnerMatch: Record<string, unknown>,
	days?: number
): Promise<AnalyticsDashboardFillBlankStats> {
	const filter: Record<string, unknown> = {
		...learnerMatch,
		'fillBlankResults.items.0': { $exists: true },
		...buildCompletedAtFilter(days),
	};

	const [attempts, assignmentStats] = await Promise.all([
		DrillAttempt.find(filter).select('fillBlankResults').lean().exec(),
		getDrillTypeAssignmentStats(learnerMatch, 'fill_blank'),
	]);

	return {
		...assignmentStats,
		...aggregateFillBlankFromAttempts(attempts).stats,
	};
}

async function aggregateKeyPhrasesStats(
	learnerMatch: Record<string, unknown>,
	days?: number
): Promise<AnalyticsDashboardKeyPhrasesStats> {
	const filter: Record<string, unknown> = {
		...learnerMatch,
		'keyPhrasesResults.items.0': { $exists: true },
		...buildCompletedAtFilter(days),
	};

	const [attempts, assignmentStats] = await Promise.all([
		DrillAttempt.find(filter).select('keyPhrasesResults').lean().exec(),
		getDrillTypeAssignmentStats(learnerMatch, 'key_phrases'),
	]);

	return {
		...assignmentStats,
		...aggregateKeyPhrasesFromAttempts(attempts).stats,
	};
}

function parseDateRange(
	range?: { from?: string; to?: string }
): { from?: Date; to?: Date } | undefined {
	if (!range?.from && !range?.to) return undefined;
	const result: { from?: Date; to?: Date } = {};
	if (range.from) {
		const d = new Date(range.from);
		if (!Number.isNaN(d.getTime())) result.from = d;
	}
	if (range.to) {
		const d = new Date(range.to);
		if (!Number.isNaN(d.getTime())) result.to = d;
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

function buildDateRangeFilter(
	range?: { from?: string; to?: string },
	days?: number
): Record<string, unknown> {
	if (range?.from || range?.to) {
		const completedAt: { $gte?: Date; $lte?: Date } = {};
		if (range.from) {
			const d = new Date(range.from);
			if (!Number.isNaN(d.getTime())) completedAt.$gte = d;
		}
		if (range.to) {
			const d = new Date(range.to);
			if (!Number.isNaN(d.getTime())) completedAt.$lte = d;
		}
		if (Object.keys(completedAt).length > 0) {
			return { completedAt };
		}
	}
	return buildCompletedAtFilter(days);
}

export async function getLearnerFillBlankAnalytics(
	learnerId: string,
	range?: { from?: string; to?: string }
): Promise<PlatformFillBlankAnalytics & { attemptsConsidered: number }> {
	const filter: Record<string, unknown> = {
		learnerId: new Types.ObjectId(learnerId),
		'fillBlankResults.items.0': { $exists: true },
		...buildDateRangeFilter(range),
	};

	const dateRange = parseDateRange(range);
	const [attempts, assignmentStats] = await Promise.all([
		DrillAttempt.find(filter).select('fillBlankResults').lean().exec(),
		getDrillTypeAssignmentStats(
			{ learnerId: new Types.ObjectId(learnerId) },
			'fill_blank',
			dateRange
		),
	]);

	const result = aggregateFillBlankFromAttempts(attempts, true);
	return {
		...result,
		stats: { ...assignmentStats, ...result.stats },
		attemptsConsidered: result.stats.totalAttempts,
	};
}

export async function getLearnerKeyPhrasesAnalytics(
	learnerId: string,
	range?: { from?: string; to?: string }
): Promise<PlatformKeyPhrasesAnalytics & { attemptsConsidered: number }> {
	const filter: Record<string, unknown> = {
		learnerId: new Types.ObjectId(learnerId),
		'keyPhrasesResults.items.0': { $exists: true },
		...buildDateRangeFilter(range),
	};

	const dateRange = parseDateRange(range);
	const [attempts, assignmentStats] = await Promise.all([
		DrillAttempt.find(filter).select('keyPhrasesResults').lean().exec(),
		getDrillTypeAssignmentStats(
			{ learnerId: new Types.ObjectId(learnerId) },
			'key_phrases',
			dateRange
		),
	]);

	const result = aggregateKeyPhrasesFromAttempts(attempts, true);
	return {
		...result,
		stats: { ...assignmentStats, ...result.stats },
		attemptsConsidered: result.stats.totalAttempts,
	};
}

export async function getPlatformFillBlankAnalytics(
	days = 30,
	learnerIds?: string[]
): Promise<PlatformFillBlankAnalytics> {
	const filter: Record<string, unknown> = {
		...buildLearnerIdMatch(learnerIds),
		'fillBlankResults.items.0': { $exists: true },
		...buildCompletedAtFilter(days),
	};

	const learnerMatch = buildLearnerIdMatch(learnerIds);
	const [attempts, assignmentStats] = await Promise.all([
		DrillAttempt.find(filter).select('fillBlankResults').lean().exec(),
		getDrillTypeAssignmentStats(learnerMatch, 'fill_blank'),
	]);

	const result = aggregateFillBlankFromAttempts(attempts, true);
	return {
		...result,
		stats: { ...assignmentStats, ...result.stats },
	};
}

export async function getPlatformKeyPhrasesAnalytics(
	days = 30,
	learnerIds?: string[]
): Promise<PlatformKeyPhrasesAnalytics> {
	const filter: Record<string, unknown> = {
		...buildLearnerIdMatch(learnerIds),
		'keyPhrasesResults.items.0': { $exists: true },
		...buildCompletedAtFilter(days),
	};

	const learnerMatch = buildLearnerIdMatch(learnerIds);
	const [attempts, assignmentStats] = await Promise.all([
		DrillAttempt.find(filter).select('keyPhrasesResults').lean().exec(),
		getDrillTypeAssignmentStats(learnerMatch, 'key_phrases'),
	]);

	const result = aggregateKeyPhrasesFromAttempts(attempts, true);
	return {
		...result,
		stats: { ...assignmentStats, ...result.stats },
	};
}

async function aggregateMatchingStats(
	learnerMatch: Record<string, unknown>,
	days?: number
): Promise<AnalyticsDashboardMatchingStats> {
	const filter: Record<string, unknown> = {
		...learnerMatch,
		'matchingResults.totalPairs': { $gt: 0 },
		...buildCompletedAtFilter(days),
	};

	const attempts = await DrillAttempt.find(filter)
		.select('matchingResults')
		.lean()
		.exec();

	let sumTotalPairs = 0;
	let sumPairsMatched = 0;
	let totalAttempts = 0;
	const allDurations: number[] = [];
	let slowest: { durationSec: number; left: string; right: string } | null = null;

	for (const a of attempts) {
		const m = a.matchingResults as MatchingResultsLean | undefined;
		if (!m || typeof m.totalPairs !== 'number' || m.totalPairs <= 0) continue;

		totalAttempts++;
		sumTotalPairs += m.totalPairs;
		sumPairsMatched += typeof m.pairsMatched === 'number' ? m.pairsMatched : 0;

		for (const ev of m.pairMatchEvents ?? []) {
			if (typeof ev.durationSec !== 'number' || !Number.isFinite(ev.durationSec)) continue;
			allDurations.push(ev.durationSec);
			if (!slowest || ev.durationSec > slowest.durationSec) {
				slowest = {
					durationSec: ev.durationSec,
					left: String(ev.left ?? ''),
					right: String(ev.right ?? ''),
				};
			}
		}
	}

	const accuracyRatePct =
		sumTotalPairs > 0 ? Math.round((sumPairsMatched / sumTotalPairs) * 100) : 0;

	const { fast, slow } = splitByMedian(allDurations);

	return {
		totalAssignedPairs: sumTotalPairs,
		accuracyRatePct,
		totalAttempts,
		fastMatches: fast,
		slowMatches: slow,
		slowestMatchSeconds: slowest?.durationSec ?? null,
		slowestMatchLabel:
			slowest && (slowest.left || slowest.right)
				? `${slowest.left} → ${slowest.right}`
				: null,
	};
}

export async function getAnalyticsDashboard(
	learnerIds?: string[],
	days = 30
): Promise<AnalyticsDashboardResponse> {
	const learnerMatch = buildLearnerIdMatch(learnerIds);

	const [
		drillAggregates,
		pronunciationWordStats,
		pronunciationOverall,
		problemAreas,
		grammar,
		sentence,
		matching,
		fillBlank,
		keyPhrases,
	] = await Promise.all([
		getDrillAssignmentAggregates(learnerMatch),
		getAggregatedPronunciationWordStats(learnerIds),
		getOverallStats(days, learnerIds),
		getOverallProblemAreasWithWords(days, learnerIds),
		aggregateGrammarStats(learnerMatch, undefined),
		aggregateSentenceStats(learnerMatch, undefined),
		aggregateMatchingStats(learnerMatch, days),
		aggregateFillBlankStats(learnerMatch, days),
		aggregateKeyPhrasesStats(learnerMatch, days),
	]);

	const statusCounts = drillAggregates.statusCounts;
	const total = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);
	const completed = statusCounts['completed'] || 0;
	const inProgress = statusCounts['in-progress'] || 0;
	const pending = statusCounts['pending'] || 0;
	const overdue = statusCounts['overdue'] || 0;
	const pendingReview = drillAggregates.pendingReview;

	const completionRatePct =
		total > 0 ? Math.round((completed / total) * 100 * 100) / 100 : 0;

	const drillCompletionRatePct =
		total > 0 ? Math.round((completed / total) * 100) : 0;
	const wordCompletionRatePct =
		pronunciationWordStats.totalWords > 0
			? Math.round(
					(pronunciationWordStats.completedWords / pronunciationWordStats.totalWords) * 100
				)
			: 0;

	const overallProgressPct = computeOverallProgressPct(
		total,
		completed,
		pronunciationWordStats.totalWords,
		pronunciationWordStats.completedWords
	);

	const overallAverageScore = computeOverallAverageScore(
		drillAggregates.averageScore,
		pronunciationOverall.averageScore
	);

	const drills: AnalyticsDashboardDrillStats = {
		total,
		completed,
		inProgress,
		pending,
		overdue,
		pendingReview,
		completionRatePct,
		averageScore: drillAggregates.averageScore,
	};

	return {
		progress: {
			overallProgressPct,
			overallAverageScore,
			pendingReviewCount: pendingReview,
			drillStats: {
				total,
				completed,
				completionRatePct: drillCompletionRatePct,
				averageScore: drillAggregates.averageScore,
			},
			pronunciationStats: {
				totalWords: pronunciationWordStats.totalWords,
				completedWords: pronunciationWordStats.completedWords,
				completionRatePct: wordCompletionRatePct,
				averageScore: pronunciationOverall.averageScore,
			},
		},
		drills,
		pronunciation: {
			overall: pronunciationOverall,
			challengingWords: pronunciationWordStats.challengingWords,
			problemAreas: {
				topIncorrectPhonemes: problemAreas.topIncorrectPhonemes,
			},
		},
		grammar,
		sentence,
		matching,
		fillBlank,
		keyPhrases,
	};
}
