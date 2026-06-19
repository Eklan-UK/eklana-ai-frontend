// GET /api/v1/pronunciation
// Returns the current learner's pronunciation metrics derived from the progress scorecard.
// The scorecard is the canonical source; this route exists for backward compatibility with
// usePronunciation() on the Profile page.
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { Types } from 'mongoose';
import { apiResponse } from '@/lib/api/response';
import { computeProgressScorecard } from '@/domain/progress/progress-scorecard.service';

async function getHandler(
  _req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
) {
  const scorecard = await computeProgressScorecard(context.userId.toString());

  // Map to the PronunciationMetrics shape expected by usePronunciation()
  return apiResponse.success({
    pronunciation: {
      learnerId: context.userId.toString(),
      overallScore: scorecard.pronunciation,
      totalWordsPronounced: scorecard.sampleCounts.pronunciationDrills,
      history: [],
      lastComputedAt: new Date().toISOString(),
    },
  });
}

export const GET = withRole(['user'], withErrorHandler(getHandler));
