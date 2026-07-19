// GET /api/v1/cron/weekly-challenge
// Auth: CRON_SECRET (Vercel) or WEEKLY_CHALLENGE_CRON_SECRET (local)
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { isWeeklyChallengeDayUtc, currentWeekStartUtc } from '@/lib/challenges/utc-week-challenge';
import { aggregateWeaknesses } from '@/domain/challenges/weakness-aggregator';
import { generateWeeklyChallenge } from '@/domain/challenges/challenge-generator';
import WeeklyChallengeModel from '@/models/weekly-challenge';
import UserModel from '@/models/user';
import StudentContext from '@/models/studentContext';
import { authorizeCron, isCronConfigured } from '@/lib/api/cron-auth';
import '@/models/drill-attempt';
import '@/models/pronunciation-attempt';
import '@/models/free-talk-attempt';
import '@/models/weekly-challenge-dispatch';
import { notifyWeeklyChallengeReadyFromDoc } from '@/domain/challenges/weekly-challenge-notification.service';
import '@/models/drill';

const ROUTE_SECRET_ENV = 'WEEKLY_CHALLENGE_CRON_SECRET';

export async function GET(req: NextRequest) {
  if (!isCronConfigured(ROUTE_SECRET_ENV)) {
    return NextResponse.json(
      {
        code: 'NotConfigured',
        message: 'Set CRON_SECRET (Vercel) or WEEKLY_CHALLENGE_CRON_SECRET (local)',
      },
      { status: 503 },
    );
  }

  if (!authorizeCron(req, ROUTE_SECRET_ENV)) {
    return NextResponse.json(
      { code: 'Unauthorized', message: 'Invalid cron secret' },
      { status: 401 },
    );
  }

  await connectToDatabase();

  const now = new Date();
  const weekStartDate = currentWeekStartUtc(now);

  let generated = 0;
  let skipped = 0;
  let errors = 0;
  let notified = 0;
  let notifySkipped = 0;
  const notifyErrors: string[] = [];

  const learners = await UserModel.find({
    role: 'user',
    subscriptionActivatedAt: { $exists: true, $ne: null },
  })
    .select('_id firstName lastName email subscriptionActivatedAt')
    .lean();

  const contexts = await StudentContext.find({
    studentId: { $in: learners.map((l) => l._id) },
  })
    .select('studentId country')
    .lean();
  const countryByStudentId = new Map(
    contexts.map((c) => [String(c.studentId), c.country]),
  );

  const BATCH_SIZE = 5;

  for (let i = 0; i < learners.length; i += BATCH_SIZE) {
    const batch = learners.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (learner) => {
      try {
        if (!isWeeklyChallengeDayUtc(now, learner.subscriptionActivatedAt as Date)) {
          skipped++;
          return;
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
          return;
        }

        const profile = await aggregateWeaknesses(learner._id, weekStartDate);
        const country = countryByStudentId.get(String(learner._id));
        const content = await generateWeeklyChallenge(profile, { country });

        const saved = await WeeklyChallengeModel.findOneAndUpdate(
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

        if (
          saved &&
          Array.isArray(saved.content?.drillSequence) &&
          saved.content.drillSequence.length > 0
        ) {
          try {
            const notifyResult = await notifyWeeklyChallengeReadyFromDoc(saved);
            if (notifyResult.status === 'sent') {
              notified++;
            } else {
              notifySkipped++;
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            notifyErrors.push(`${String(learner._id)}: ${msg}`);
            logger.warn('[weekly-challenge cron] notification failed', {
              learnerId: String(learner._id),
              error: msg,
            });
          }
        }
      } catch (err: any) {
        logger.error('[weekly-challenge cron] error processing learner', {
          learnerId: String(learner._id),
          error: err.message,
        });
        errors++;
      }
    }));
  }

  return NextResponse.json({ generated, skipped, errors, notified, notifySkipped, notifyErrors });
}
