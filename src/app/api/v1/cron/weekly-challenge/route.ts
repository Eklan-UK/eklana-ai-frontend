import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { isWeeklyChallengeDayUtc, currentWeekStartUtc } from '@/lib/challenges/utc-week-challenge';
import { aggregateWeaknesses } from '@/domain/challenges/weakness-aggregator';
import { generateWeeklyChallenge } from '@/domain/challenges/challenge-generator';
import WeeklyChallengeModel from '@/models/weekly-challenge';
import UserModel from '@/models/user';
import '@/models/drill-attempt';
import '@/models/pronunciation-attempt';
import '@/models/free-talk-attempt';

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ code: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();

  const now = new Date();
  const weekStartDate = currentWeekStartUtc(now);

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  const learners = await UserModel.find({
    role: 'user',
    subscriptionActivatedAt: { $exists: true, $ne: null },
  })
    .select('_id firstName lastName email subscriptionActivatedAt')
    .lean();

  for (const learner of learners) {
    try {
      if (!isWeeklyChallengeDayUtc(now, learner.subscriptionActivatedAt as Date)) {
        skipped++;
        continue;
      }

      const existing = await WeeklyChallengeModel.findOne({
        learnerId: learner._id,
        weekStartDate,
      }).lean();

      if (
        existing &&
        Array.isArray(existing.content?.drillSequence) &&
        existing.content.drillSequence.length > 0
      ) {
        skipped++;
        continue;
      }

      const profile = await aggregateWeaknesses(learner._id, weekStartDate);
      const content = await generateWeeklyChallenge(profile);

      await WeeklyChallengeModel.findOneAndUpdate(
        { learnerId: learner._id, weekStartDate },
        {
          $set: {
            learnerId: learner._id,
            weekStartDate,
            weaknessProfile: profile,
            challengeType: 'structured_drill_sequence',
            content,
            status: 'ready',
            generatedAt: now,
          },
        },
        { upsert: true, new: true },
      );

      generated++;
    } catch (err: any) {
      logger.error('[weekly-challenge cron] error processing learner', {
        learnerId: String(learner._id),
        error: err.message,
      });
      errors++;
    }
  }

  return NextResponse.json({ generated, skipped, errors });
}
