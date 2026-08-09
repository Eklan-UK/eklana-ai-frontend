import { Types } from 'mongoose';

export type DrillAssignmentStatus =
	| 'pending'
	| 'in-progress'
	| 'completed'
	| 'overdue'
	| string;

export interface DrillAttemptLike {
	score?: number | null;
	completedAt?: Date | string | null;
	startedAt?: Date | string | null;
	timeSpent?: number | null;
	vocabularyResults?: unknown;
	pronunciationResults?: unknown;
	roleplayResults?: unknown;
	performanceReviewSnapshot?: unknown;
	grammarResults?: {
		reviewStatus?: string;
		accuracy?: number;
		patterns?: unknown[];
		[key: string]: unknown;
	};
	sentenceResults?: {
		reviewStatus?: string;
		[key: string]: unknown;
	};
	summaryResults?: {
		reviewStatus?: string;
		[key: string]: unknown;
	};
	matchingResults?: {
		pairsMatched?: number;
		totalPairs?: number;
		[key: string]: unknown;
	};
}

export interface DrillAssignmentLike {
	_id: Types.ObjectId | string;
	drillId?: unknown;
	status?: string;
	assignedAt?: Date | string;
	dueDate?: Date | string;
	completedAt?: Date | string | null;
	assignedBy?: unknown;
	score?: number | null;
}

export interface ReviewStatusResult {
	reviewStatus: 'pending' | 'reviewed' | null;
	requiresReview: boolean;
}

export interface EnrichedDrillAssignment {
	_id: Types.ObjectId | string;
	drillId: unknown;
	drill: Record<string, unknown> | null;
	status: DrillAssignmentStatus;
	assignedAt?: Date | string;
	dueDate?: Date | string;
	completedAt?: Date | string | null;
	assignedBy?: unknown;
	attemptsCount: number;
	latestAttempt: {
		score?: number | null;
		completedAt?: Date | string | null;
		startedAt?: Date | string | null;
		timeSpent?: number | null;
		vocabularyResults?: unknown;
		pronunciationResults?: unknown;
		roleplayResults?: unknown;
		performanceReviewSnapshot?: unknown;
		grammarResults?: DrillAttemptLike['grammarResults'];
		sentenceResults?: DrillAttemptLike['sentenceResults'];
		summaryResults?: DrillAttemptLike['summaryResults'];
		matchingResults?: DrillAttemptLike['matchingResults'];
	} | null;
	bestScore: number | null;
	reviewStatus: 'pending' | 'reviewed' | null;
	requiresReview: boolean;
}

export interface DrillAssignmentStatistics {
	total: number;
	completed: number;
	inProgress: number;
	pending: number;
	overdue: number;
	pendingReview: number;
	averageScore: number;
	completionRate: number;
}

export function isPopulatedDrillRef(
	drillId: unknown
): drillId is Record<string, unknown> {
	return Boolean(drillId && typeof drillId === 'object' && '_id' in drillId);
}

export function deriveEffectiveStatus(
	assignment: DrillAssignmentLike,
	latestAttempt: DrillAttemptLike | null
): DrillAssignmentStatus {
	if (
		assignment.status === 'completed' ||
		assignment.completedAt ||
		latestAttempt?.completedAt
	) {
		return 'completed';
	}
	return assignment.status || 'pending';
}

/**
 * Profile enrichment: only Grammar drills require review.
 *
 * Important: DrillAttempt.create historically applied a nested mongoose
 * default of grammarResults.reviewStatus='pending' on EVERY attempt
 * (including roleplay/key_phrases). Gate on drill type + real grammar
 * content (patterns) — never trust reviewStatus alone.
 *
 * Sentence/Summary keep their own review queues and are not surfaced here.
 */
export function deriveReviewStatus(
	latestAttempt: DrillAttemptLike | null,
	drillType?: string | null
): ReviewStatusResult {
	if (!latestAttempt) {
		return { reviewStatus: null, requiresReview: false };
	}

	const normalizedType =
		typeof drillType === 'string' ? drillType.trim().toLowerCase() : null;

	if (normalizedType !== 'grammar') {
		return { reviewStatus: null, requiresReview: false };
	}

	const patterns = latestAttempt.grammarResults?.patterns;
	const hasGrammarPatterns = Array.isArray(patterns) && patterns.length > 0;
	if (!hasGrammarPatterns) {
		return { reviewStatus: null, requiresReview: false };
	}

	const grammarStatus = latestAttempt.grammarResults?.reviewStatus;
	const reviewStatus =
		grammarStatus === 'pending' || grammarStatus === 'reviewed'
			? grammarStatus
			: null;

	return {
		reviewStatus,
		requiresReview: reviewStatus === 'pending',
	};
}

export function groupAttemptsByAssignmentId(
	attempts: Array<DrillAttemptLike & { drillAssignmentId?: unknown }>
): Map<string, DrillAttemptLike[]> {
	const attemptsByAssignment = new Map<string, DrillAttemptLike[]>();

	for (const attempt of attempts) {
		const assignmentId = attempt.drillAssignmentId?.toString();
		if (!assignmentId) {
			continue;
		}
		if (!attemptsByAssignment.has(assignmentId)) {
			attemptsByAssignment.set(assignmentId, []);
		}
		attemptsByAssignment.get(assignmentId)!.push(attempt);
	}

	return attemptsByAssignment;
}

function sortAttemptsByRecency(attempts: DrillAttemptLike[]): DrillAttemptLike[] {
	return [...attempts].sort((a, b) => {
		const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
		const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
		return bTime - aTime;
	});
}

export function enrichDrillAssignment(
	assignment: DrillAssignmentLike,
	attempts: DrillAttemptLike[]
): EnrichedDrillAssignment {
	const sortedAttempts = sortAttemptsByRecency(attempts);
	const latestAttempt = sortedAttempts[0] || null;
	const bestAttempt =
		[...attempts].sort((a, b) => (b.score || 0) - (a.score || 0))[0] || null;
	const drill = isPopulatedDrillRef(assignment.drillId) ? assignment.drillId : null;
	const drillType =
		typeof drill?.type === 'string' ? (drill.type as string) : null;
	const { reviewStatus, requiresReview } = deriveReviewStatus(
		latestAttempt,
		drillType
	);

	return {
		_id: assignment._id,
		drillId: drill?._id || assignment.drillId,
		drill,
		status: deriveEffectiveStatus(assignment, latestAttempt),
		assignedAt: assignment.assignedAt,
		dueDate: assignment.dueDate,
		completedAt: assignment.completedAt,
		assignedBy: assignment.assignedBy,
		attemptsCount: attempts.length,
		latestAttempt: latestAttempt
			? {
					score: latestAttempt.score,
					completedAt: latestAttempt.completedAt,
					startedAt: latestAttempt.startedAt,
					timeSpent: latestAttempt.timeSpent,
					vocabularyResults: latestAttempt.vocabularyResults,
					pronunciationResults: latestAttempt.pronunciationResults,
					roleplayResults: latestAttempt.roleplayResults,
					performanceReviewSnapshot: latestAttempt.performanceReviewSnapshot,
					grammarResults: latestAttempt.grammarResults,
					sentenceResults: latestAttempt.sentenceResults,
					summaryResults: latestAttempt.summaryResults,
					matchingResults: latestAttempt.matchingResults,
				}
			: null,
		bestScore: bestAttempt?.score ?? assignment.score ?? null,
		reviewStatus,
		requiresReview,
	};
}

export function computeDrillAssignmentStatistics(
	enrichedAssignments: EnrichedDrillAssignment[]
): DrillAssignmentStatistics {
	const statusCounts = enrichedAssignments.reduce(
		(acc, assignment) => {
			const status = assignment.status;
			acc[status] = (acc[status] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>
	);

	const completedAssignments = statusCounts.completed || 0;
	const total = enrichedAssignments.length;

	const completedScores = enrichedAssignments
		.filter((assignment) => assignment.status === 'completed')
		.map((assignment) => assignment.bestScore ?? assignment.latestAttempt?.score)
		.filter((score): score is number => score != null && !Number.isNaN(score));

	const averageScore =
		completedScores.length > 0
			? Math.round(
					(completedScores.reduce((sum, score) => sum + score, 0) /
						completedScores.length) *
						100
				) / 100
			: 0;

	const pendingReview = enrichedAssignments.filter(
		(assignment) => assignment.requiresReview
	).length;

	return {
		total,
		completed: completedAssignments,
		inProgress: statusCounts['in-progress'] || 0,
		pending: statusCounts.pending || 0,
		overdue: statusCounts.overdue || 0,
		pendingReview,
		averageScore,
		completionRate:
			total > 0
				? Math.round((completedAssignments / total) * 100 * 100) / 100
				: 0,
	};
}
