/**
 * Progress Scorecard Service
 *
 * Computes the four learner-facing metrics defined in docs/progress-scorecard.md:
 *
 *   Pronunciation = avg Speechace scores across all completed drills
 *   Accuracy      = avg score across completed key_phrases + fill_blank assigned drills
 *   Fluency       = avg overallScore across Eklan Free Talk scenarios
 *   Confidence    = avg of whichever of the three pillars have data
 *
 * Weekly change is derived by comparing the rolling 7-day window to the prior 7-day window.
 */
import { connectToDatabase } from '@/lib/api/db';
import DrillAttempt from '@/models/drill-attempt';
import FreeTalkAttempt from '@/models/free-talk-attempt';
import { toUserIdQuery } from '@/lib/api/user-id';
import { extractDrillQualityScore, getConfidenceLabel } from '@/domain/confidence/confidence.service';
import type { ConfidenceLabel } from '@/models/learner-confidence';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ProgressScorecardMetrics {
	pronunciation: number;
	accuracy: number;
	fluency: number;
	confidence: number;
	pronunciationWeeklyChange: number;
	accuracyWeeklyChange: number;
	fluencyWeeklyChange: number;
	confidenceWeeklyChange: number;
	confidenceLabel: ConfidenceLabel;
	confidenceTrend: 'improving' | 'stable' | 'declining';
	sampleCounts: {
		pronunciationDrills: number;
		accuracyDrills: number;
		fluencyScenarios: number;
	};
}

const ACCURACY_TYPES = new Set(['key_phrases', 'fill_blank']);

/** Infer drill type from stored results when drillType was not persisted (legacy attempts). */
function resolveDrillType(attempt: Record<string, unknown>): string {
	const explicit = attempt.drillType;
	if (typeof explicit === 'string' && explicit.length > 0) return explicit;
	if (attempt.keyPhrasesResults) return 'key_phrases';
	if (attempt.fillBlankResults) return 'fill_blank';
	if (attempt.vocabularyResults) return 'vocabulary';
	if (attempt.pronunciationResults) return 'pronunciation';
	if (attempt.roleplayResults) return 'roleplay';
	if (attempt.matchingResults) return 'matching';
	if (attempt.definitionResults) return 'definition';
	if (attempt.grammarResults) return 'grammar';
	if (attempt.sentenceResults || attempt.sentenceWritingResults) return 'sentence';
	if (attempt.summaryResults) return 'summary';
	if (attempt.listeningResults) return 'listening';
	return '';
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function safeAvg(nums: number[]): number {
	if (nums.length === 0) return 0;
	return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Extract one avg Speechace score from a completed drill attempt.
 * Returns null if the attempt has no Speechace data at all.
 */
function speechaceAvgFromAttempt(attempt: Record<string, unknown>): number | null {
	const scores: number[] = [];

	const vocabResults = attempt.vocabularyResults as
		| { wordScores?: Array<{ pronunciationScore?: number; score?: number }> }
		| undefined;
	if (vocabResults?.wordScores?.length) {
		for (const w of vocabResults.wordScores) {
			const s = w.pronunciationScore ?? w.score;
			if (typeof s === 'number' && s > 0) scores.push(s);
		}
	}

	const pronResults = attempt.pronunciationResults as
		| { wordScores?: Array<{ pronunciationScore?: number; score?: number }> }
		| undefined;
	if (pronResults?.wordScores?.length) {
		for (const w of pronResults.wordScores) {
			const s = w.pronunciationScore ?? w.score;
			if (typeof s === 'number' && s > 0) scores.push(s);
		}
	}

	const roleResults = attempt.roleplayResults as
		| { sceneScores?: Array<{ pronunciationScore?: number; score?: number }> }
		| undefined;
	if (roleResults?.sceneScores?.length) {
		for (const scene of roleResults.sceneScores) {
			const s = scene.pronunciationScore ?? scene.score;
			if (typeof s === 'number' && s > 0) scores.push(s);
		}
	}

	return scores.length > 0 ? safeAvg(scores) : null;
}

function deriveTrend(weeklyChange: number): 'improving' | 'stable' | 'declining' {
	if (weeklyChange >= 3) return 'improving';
	if (weeklyChange <= -3) return 'declining';
	return 'stable';
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

export async function computeProgressScorecard(
	learnerId: string,
): Promise<ProgressScorecardMetrics> {
	await connectToDatabase();
	// learnerId may be a UUID (Better Auth web sign-up, incl. Google/Apple
	// OAuth) or an ObjectId hex string (legacy/mobile accounts). DrillAttempt
	// and FreeTalkAttempt both store `learnerId` as Schema.Types.Mixed, so a
	// raw `new Types.ObjectId(...)` would throw for UUID learners (crashing
	// this learner-facing scorecard endpoint) and would fail to auto-cast for
	// ObjectId learners anyway since Mixed's castForQuery is a no-op.
	const oid = toUserIdQuery(learnerId);

	const now = new Date();
	const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
	const thisWeekStart = new Date(now.getTime() - WEEK_MS);
	const lastWeekStart = new Date(now.getTime() - 2 * WEEK_MS);

	// ── 1. Load drill attempts ────────────────────────────────────
	const drillAttempts = await DrillAttempt.find({
		learnerId: oid,
		completedAt: { $ne: null },
	})
		.select(
			'drillType drillAssignmentId completedAt score vocabularyResults pronunciationResults roleplayResults fillBlankResults keyPhrasesResults',
		)
		.sort({ completedAt: -1 })
		.limit(500)
		.lean()
		.exec();

	// ── 2. Load free talk attempts ────────────────────────────────
	const freeTalkAttempts = await FreeTalkAttempt.find({
		learnerId: oid,
		'gradeResult.overallScore': { $exists: true, $ne: null },
	})
		.select('gradeResult createdAt')
		.sort({ createdAt: -1 })
		.limit(200)
		.lean()
		.exec();

	// ── 3. Compute all-time scores ────────────────────────────────

	// Pronunciation: avg of per-drill Speechace averages
	const pronScoresAll: number[] = [];
	const pronScoresThis: number[] = [];
	const pronScoresLast: number[] = [];

	// Accuracy: avg of key_phrases + fill_blank assigned drills
	const accScoresAll: number[] = [];
	const accScoresThis: number[] = [];
	const accScoresLast: number[] = [];

	for (const raw of drillAttempts) {
		const a = raw as Record<string, unknown>;
		const drillType = resolveDrillType(a);
		const completedAt = a.completedAt ? new Date(a.completedAt as Date) : null;
		if (!completedAt) continue;

		const inThisWeek = completedAt >= thisWeekStart;
		const inLastWeek = completedAt >= lastWeekStart && completedAt < thisWeekStart;

		// Pronunciation pillar
		const speechaceAvg = speechaceAvgFromAttempt(a);
		if (speechaceAvg !== null) {
			pronScoresAll.push(speechaceAvg);
			if (inThisWeek) pronScoresThis.push(speechaceAvg);
			else if (inLastWeek) pronScoresLast.push(speechaceAvg);
		}

		// Accuracy pillar — assigned drills only
		if (ACCURACY_TYPES.has(drillType) && a.drillAssignmentId) {
			const q = extractDrillQualityScore({ ...a, drillType });
			if (q != null) {
				accScoresAll.push(q);
				if (inThisWeek) accScoresThis.push(q);
				else if (inLastWeek) accScoresLast.push(q);
			}
		}
	}

	// Fluency pillar
	const fluScoresAll: number[] = [];
	const fluScoresThis: number[] = [];
	const fluScoresLast: number[] = [];

	for (const raw of freeTalkAttempts) {
		const a = raw as Record<string, unknown>;
		const grade = a.gradeResult as { overallScore?: number } | null;
		const score = grade?.overallScore;
		if (typeof score !== 'number') continue;
		const createdAt = a.createdAt ? new Date(a.createdAt as Date) : null;
		if (!createdAt) continue;

		fluScoresAll.push(score);
		const inThisWeek = createdAt >= thisWeekStart;
		const inLastWeek = createdAt >= lastWeekStart && createdAt < thisWeekStart;
		if (inThisWeek) fluScoresThis.push(score);
		else if (inLastWeek) fluScoresLast.push(score);
	}

	// ── 4. Aggregate ─────────────────────────────────────────────

	const pronunciation = Math.round(safeAvg(pronScoresAll));
	const accuracy = Math.round(safeAvg(accScoresAll));
	const fluency = Math.round(safeAvg(fluScoresAll));

	// Confidence: average only pillars with data
	const confidencePillars: number[] = [];
	if (pronScoresAll.length > 0) confidencePillars.push(pronunciation);
	if (accScoresAll.length > 0) confidencePillars.push(accuracy);
	if (fluScoresAll.length > 0) confidencePillars.push(fluency);
	const confidence = Math.round(safeAvg(confidencePillars));

	// ── 5. Weekly changes ─────────────────────────────────────────

	const pronunciationWeeklyChange =
		pronScoresThis.length && pronScoresLast.length
			? Math.round(safeAvg(pronScoresThis) - safeAvg(pronScoresLast))
			: 0;

	const accuracyWeeklyChange =
		accScoresThis.length && accScoresLast.length
			? Math.round(safeAvg(accScoresThis) - safeAvg(accScoresLast))
			: 0;

	const fluencyWeeklyChange =
		fluScoresThis.length && fluScoresLast.length
			? Math.round(safeAvg(fluScoresThis) - safeAvg(fluScoresLast))
			: 0;

	// For confidence weekly change, recompute on week-windowed data
	const confidenceThis: number[] = [];
	if (pronScoresThis.length > 0) confidenceThis.push(Math.round(safeAvg(pronScoresThis)));
	if (accScoresThis.length > 0) confidenceThis.push(Math.round(safeAvg(accScoresThis)));
	if (fluScoresThis.length > 0) confidenceThis.push(Math.round(safeAvg(fluScoresThis)));

	const confidenceLast: number[] = [];
	if (pronScoresLast.length > 0) confidenceLast.push(Math.round(safeAvg(pronScoresLast)));
	if (accScoresLast.length > 0) confidenceLast.push(Math.round(safeAvg(accScoresLast)));
	if (fluScoresLast.length > 0) confidenceLast.push(Math.round(safeAvg(fluScoresLast)));

	const confidenceWeeklyChange =
		confidenceThis.length && confidenceLast.length
			? Math.round(safeAvg(confidenceThis) - safeAvg(confidenceLast))
			: 0;

	return {
		pronunciation,
		accuracy,
		fluency,
		confidence,
		pronunciationWeeklyChange,
		accuracyWeeklyChange,
		fluencyWeeklyChange,
		confidenceWeeklyChange,
		confidenceLabel: getConfidenceLabel(confidence),
		confidenceTrend: deriveTrend(confidenceWeeklyChange),
		sampleCounts: {
			pronunciationDrills: pronScoresAll.length,
			accuracyDrills: accScoresAll.length,
			fluencyScenarios: fluScoresAll.length,
		},
	};
}
