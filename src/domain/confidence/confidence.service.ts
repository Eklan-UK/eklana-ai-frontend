/**
 * Confidence Metrics Service
 *
 * Computes a single 0-100 confidence score per learner:
 *   confidence = (completion_rate × 40) + (quality_score × 0.60)
 *
 * Quality score is a weighted average of per-drill scores extracted
 * from Speechace pronunciation data and accuracy metrics.
 */
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/api/db';
import DrillAssignment from '@/models/drill-assignment';
import DrillAttempt from '@/models/drill-attempt';
import LearnerConfidenceModel, {
  ConfidenceLabel,
  ConfidenceTrend,
} from '@/models/learner-confidence';
import { logger } from '@/lib/api/logger';

// ─────────────────────────────────────────────────────────────
// Drill type weights (how much each drill type counts toward quality)
// ─────────────────────────────────────────────────────────────
const DRILL_WEIGHTS: Record<string, number> = {
  vocabulary: 1.2,
  roleplay: 1.5,
  matching: 0.7,
  definition: 0.7,
  fillBlank: 0.7,
  sentence: 1.0,
  grammar: 1.0,
  summary: 1.2,
  listening: 0.6,
  reading: 0.8,
};

// Speechace-based drills (higher signal for pronunciation confidence sub-score)
const SPEECHACE_DRILLS = new Set(['vocabulary', 'roleplay']);

// ─────────────────────────────────────────────────────────────
// Word score: combines best, last, mean attempts
// ─────────────────────────────────────────────────────────────
export function computeWordScore(scores: number[]): number {
  if (!scores || scores.length === 0) return 0;
  const best = Math.max(...scores);
  const last = scores[scores.length - 1];
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  return best * 0.4 + last * 0.4 + mean * 0.2;
}

// ─────────────────────────────────────────────────────────────
// Extract a normalised 0-100 quality score from a drill attempt
// ─────────────────────────────────────────────────────────────
export function extractDrillQualityScore(attempt: any): number | null {
  const type = attempt.drillType || attempt.drill?.type;

  // ── Vocabulary ──────────────────────────────────────────────
  if (type === 'vocabulary' && attempt.vocabularyResults?.wordScores?.length) {
    const scores = attempt.vocabularyResults.wordScores
      .map((w: any) => w.pronunciationScore ?? w.score ?? 0)
      .filter((s: number) => s > 0);
    if (scores.length === 0) return attempt.score ?? null;
    return scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
  }

  // ── Roleplay ────────────────────────────────────────────────
  if (type === 'roleplay' && attempt.roleplayResults?.sceneScores?.length) {
    const scores = attempt.roleplayResults.sceneScores
      .map((s: any) => s.pronunciationScore ?? s.fluencyScore ?? s.score ?? 0)
      .filter((s: number) => s > 0);
    if (scores.length === 0) return attempt.score ?? null;
    return scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
  }

  // ── Matching ────────────────────────────────────────────────
  if (type === 'matching' && attempt.matchingResults) {
    return attempt.matchingResults.accuracy != null
      ? attempt.matchingResults.accuracy * 100
      : attempt.score ?? null;
  }

  // ── Fill-in-the-blank ───────────────────────────────────────
  if (attempt.fillBlankResults) {
    return attempt.fillBlankResults.score ?? attempt.score ?? null;
  }

  // ── Sentence writing (review-based) ─────────────────────────
  if (type === 'sentence' && attempt.sentenceResults) {
    const reviews = attempt.sentenceResults.sentenceReviews ?? [];
    if (reviews.length === 0) return attempt.score ?? null;
    const correct = reviews.filter((r: any) => r.isCorrect).length;
    return (correct / reviews.length) * 100;
  }

  // ── Grammar (review-based) ──────────────────────────────────
  if (type === 'grammar' && attempt.grammarResults?.patternReviews?.length) {
    const reviews = attempt.grammarResults.patternReviews;
    const correct = reviews.filter((r: any) => r.isCorrect).length;
    return (correct / reviews.length) * 100;
  }

  // ── Summary writing (coach reviewed) ────────────────────────
  if (type === 'summary' && attempt.summaryResults) {
    if (attempt.summaryResults.qualityScore != null) {
      return attempt.summaryResults.qualityScore;
    }
    if (attempt.summaryResults.review?.isAcceptable != null) {
      return attempt.summaryResults.review.isAcceptable ? 85 : 50;
    }
    return attempt.score ?? null;
  }

  // ── Listening (completion-based) ────────────────────────────
  if (type === 'listening' && attempt.listeningResults) {
    return attempt.listeningResults.completed ? 80 : 40;
  }

  // ── Definition / reading ────────────────────────────────────
  if (type === 'definition' && attempt.definitionResults) {
    return typeof attempt.definitionResults.accuracy === 'number'
      ? attempt.definitionResults.accuracy * 100
      : attempt.score ?? null;
  }

  // ── Fallback to raw attempt score ───────────────────────────
  return attempt.score ?? null;
}

// ─────────────────────────────────────────────────────────────
// Label lookup
// ─────────────────────────────────────────────────────────────
export function getConfidenceLabel(score: number): ConfidenceLabel {
  if (score >= 95) return 'Excellent';
  if (score >= 88) return 'Very Good';
  if (score >= 82) return 'Good';
  if (score >= 75) return 'Average';
  if (score >= 60) return 'Developing';
  return 'Needs Improvement';
}

// ─────────────────────────────────────────────────────────────
// Trend: compare current score against last 3 history entries
// ─────────────────────────────────────────────────────────────
function computeTrend(
  history: Array<{ score: number }>,
  currentScore: number
): ConfidenceTrend {
  const recent = history.slice(-3).map((h) => h.score);
  if (recent.length < 2) return 'stable';
  const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
  if (currentScore >= avgRecent + 3) return 'improving';
  if (currentScore <= avgRecent - 3) return 'declining';
  return 'stable';
}

// ─────────────────────────────────────────────────────────────
// Main: compute and upsert confidence metrics for a learner
// ─────────────────────────────────────────────────────────────
export async function computeConfidenceMetrics(learnerId: string) {
  await connectToDatabase();

  const learnerObjId = new Types.ObjectId(learnerId);

  // 1. Fetch all assignments (to get total assigned count)
  const assignments = await DrillAssignment.find({ learnerId: learnerObjId })
    .select('_id status completedAt drillId')
    .lean();

  const drillsAssigned = assignments.length;
  if (drillsAssigned === 0) {
    return upsertConfidence(learnerId, {
      drillsAssigned: 0,
      drillsCompleted: 0,
      completionRate: 0,
      completionContribution: 0,
      qualityScore: 0,
      qualityContribution: 0,
      pronunciationConfidence: 0,
      completionConfidence: 0,
      confidenceScore: 0,
    });
  }

  // 2. Find completed assignment IDs
  const completedAssignments = assignments.filter(
    (a) => a.status === 'completed' || a.completedAt
  );
  const drillsCompleted = completedAssignments.length;

  // 3. Fetch latest attempt per completed assignment
  const assignmentIds = completedAssignments.map((a) => a._id);
  const latestAttempts = await DrillAttempt.aggregate([
    {
      $match: {
        drillAssignmentId: { $in: assignmentIds },
        completedAt: { $ne: null },
      },
    },
    { $sort: { completedAt: -1 } },
    {
      $group: {
        _id: '$drillAssignmentId',
        attempt: { $first: '$$ROOT' },
      },
    },
  ]);

  // 4. Compute quality score (weighted average)
  let weightedScoreSum = 0;
  let weightSum = 0;
  let speechaceScores: number[] = [];
  let completionScores: number[] = [];

  for (const { attempt } of latestAttempts) {
    // Find the assignment to get the drill type
    const assignment = completedAssignments.find(
      (a) => a._id.toString() === attempt.drillAssignmentId.toString()
    );
    
    const drillType = attempt.drillType || 'vocabulary'; // fallback
    const weight = DRILL_WEIGHTS[drillType] ?? 1.0;

    // Extract quality score
    const qs = extractDrillQualityScore(attempt);
    if (qs == null) continue;

    weightedScoreSum += qs * weight;
    weightSum += weight;

    // Track sub-scores
    if (SPEECHACE_DRILLS.has(drillType)) {
      speechaceScores.push(qs);
    } else {
      completionScores.push(qs);
    }
  }

  const qualityScore = weightSum > 0 ? weightedScoreSum / weightSum : 0;
  const pronunciationConfidence =
    speechaceScores.length > 0
      ? speechaceScores.reduce((a, b) => a + b, 0) / speechaceScores.length
      : 0;
  const completionConfidence =
    completionScores.length > 0
      ? completionScores.reduce((a, b) => a + b, 0) / completionScores.length
      : 0;

  // 5. Compute final score
  const completionRate = drillsAssigned > 0 ? drillsCompleted / drillsAssigned : 0;
  const completionContribution = completionRate * 40;
  const qualityContribution = qualityScore * 0.6;
  const confidenceScore = Math.min(
    100,
    Math.round(completionContribution + qualityContribution)
  );

  return upsertConfidence(learnerId, {
    drillsAssigned,
    drillsCompleted,
    completionRate,
    completionContribution: Math.round(completionContribution * 10) / 10,
    qualityScore: Math.round(qualityScore * 10) / 10,
    qualityContribution: Math.round(qualityContribution * 10) / 10,
    pronunciationConfidence: Math.round(pronunciationConfidence * 10) / 10,
    completionConfidence: Math.round(completionConfidence * 10) / 10,
    confidenceScore,
  });
}

// ─────────────────────────────────────────────────────────────
// Upsert the confidence document
// ─────────────────────────────────────────────────────────────
async function upsertConfidence(
  learnerId: string,
  data: {
    drillsAssigned: number;
    drillsCompleted: number;
    completionRate: number;
    completionContribution: number;
    qualityScore: number;
    qualityContribution: number;
    pronunciationConfidence: number;
    completionConfidence: number;
    confidenceScore: number;
  }
) {
  const label = getConfidenceLabel(data.confidenceScore);

  // Load existing document for trend + history
  const existing = await LearnerConfidenceModel.findOne({
    learnerId: new Types.ObjectId(learnerId),
  }).lean();

  const history: Array<{ score: number; label: ConfidenceLabel; computedAt: Date; drillsCompleted: number }> =
    existing?.history ?? [];

  const trend = computeTrend(history, data.confidenceScore);

  // Append current score to history (keep last 20)
  const newHistoryEntry = {
    score: data.confidenceScore,
    label,
    computedAt: new Date(),
    drillsCompleted: data.drillsCompleted,
  };
  const updatedHistory = [...history, newHistoryEntry].slice(-20);

  const result = await LearnerConfidenceModel.findOneAndUpdate(
    { learnerId: new Types.ObjectId(learnerId) },
    {
      $set: {
        ...data,
        label,
        trend,
        history: updatedHistory,
        lastComputedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  ).lean();

  logger.info('Confidence metrics computed', {
    learnerId,
    confidenceScore: data.confidenceScore,
    label,
    trend,
  });

  return result;
}

// ─────────────────────────────────────────────────────────────
// Get stored confidence (no recompute)
// ─────────────────────────────────────────────────────────────
export async function getStoredConfidence(learnerId: string) {
  await connectToDatabase();
  return LearnerConfidenceModel.findOne({
    learnerId: new Types.ObjectId(learnerId),
  }).lean();
}
