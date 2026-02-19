import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/api/db';
import DrillAttempt from '@/models/drill-attempt';
import LearnerPronunciationModel from '@/models/learner-pronunciation';
import { logger } from '@/lib/api/logger';

// ─────────────────────────────────────────────────────────────
// Pronunciation Metrics Service
// Aggregates pronunciation scores from vocabulary and roleplay drills
// ─────────────────────────────────────────────────────────────

export async function computePronunciationMetrics(learnerId: string) {
  await connectToDatabase();
  const learnerObjId = new Types.ObjectId(learnerId);

  // Fetch all vocabulary and roleplay attempts for the learner
  // We only care about attempts that have results
  const attempts = await DrillAttempt.find({
    learnerId: learnerObjId,
    $or: [{ 'vocabularyResults.wordScores': { $exists: true, $ne: [] } }, { 'roleplayResults.sceneScores': { $exists: true, $ne: [] } }],
  })
    .select('vocabularyResults roleplayResults drillType completedAt')
    .sort({ completedAt: 1 }) // Process in chronological order
    .lean();

  let totalScoreSum = 0;
  let totalCount = 0;

  // Iterate through all attempts to aggregate scores
  for (const attempt of attempts) {
    // 1. Vocabulary Drills
    if (attempt.vocabularyResults?.wordScores) {
      for (const word of attempt.vocabularyResults.wordScores) {
        // Use pronunciationScore if available, otherwise fall back to score if sensible
        // Only count valid scores > 0 to avoid skewing with skipped words
        const score = word.pronunciationScore ?? word.score;
        if (typeof score === 'number' && score > 0) {
          totalScoreSum += score;
          totalCount++;
        }
      }
    }

    // 2. Roleplay Drills
    if (attempt.roleplayResults?.sceneScores) {
      for (const scene of attempt.roleplayResults.sceneScores) {
        const score = scene.pronunciationScore ?? scene.score;
        if (typeof score === 'number' && score > 0) {
          totalScoreSum += score;
          totalCount++;
        }
      }
    }
  }

  const overallScore = totalCount > 0 ? Math.round(totalScoreSum / totalCount) : 0;

  // Retrieve existing document to update history
  const existingDoc = await LearnerPronunciationModel.findOne({ learnerId: learnerObjId }).lean();
  
  let history = existingDoc?.history || [];
  
  // Add new history entry
  // We strictly append a new snapshot if the score or count has changed, or if it's a new day?
  // User request implies just getting the current state. 
  // Let's simplified: push to history every time we recompute? 
  // To avoid spamming history on every single drill, maybe limit it?
  // For now, let's push every time, but slice to keep it manageable (e.g., last 50 entries)
  
  const newHistoryEntry = {
    score: overallScore,
    wordsCount: totalCount,
    computedAt: new Date(),
  };

  const updatedHistory = [...history, newHistoryEntry].slice(-50); // Keep last 50

  const result = await LearnerPronunciationModel.findOneAndUpdate(
    { learnerId: learnerObjId },
    {
      $set: {
        overallScore,
        totalWordsPronounced: totalCount,
        history: updatedHistory,
        lastComputedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  ).lean();

  logger.info('Pronunciation metrics computed', {
    learnerId,
    overallScore,
    totalWords: totalCount,
  });

  return result;
}

export async function getStoredPronunciation(learnerId: string) {
  await connectToDatabase();
  return LearnerPronunciationModel.findOne({
    learnerId: new Types.ObjectId(learnerId),
  }).lean();
}
