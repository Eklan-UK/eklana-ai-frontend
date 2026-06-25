import './load-env';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import UserModel from '@/models/user';
import DrillAttemptModel from '@/models/drill-attempt';
import WeeklyChallengeModel from '@/models/weekly-challenge';
import { aggregateWeaknesses } from '@/domain/challenges/weakness-aggregator';
import { generateWeeklyChallenge } from '@/domain/challenges/challenge-generator';
import { currentWeekStartUtc } from '@/lib/challenges/utc-week-challenge';
import '@/models/pronunciation-attempt';
import '@/models/free-talk-attempt';

async function main() {
  await connectToDatabase();

  const weekStartDate = currentWeekStartUtc();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const learners = await UserModel.find({ role: 'user' })
    .select('_id firstName lastName email')
    .lean();

  console.log(`Processing ${learners.length} learners for week starting ${weekStartDate.toISOString()}\n`);

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const learner of learners) {
    const tag = `learnerId=${learner._id} (${learner.email})`;

    try {
      // Skip if valid challenge already exists for this week
      const existing = await WeeklyChallengeModel.findOne({
        learnerId: learner._id,
        weekStartDate,
      }).lean();

      if (
        existing &&
        Array.isArray(existing.content?.drillSequence) &&
        existing.content.drillSequence.length > 0
      ) {
        console.log(`[skipped - already has challenge] ${tag}`);
        skipped++;
        continue;
      }

      // Skip if no drill activity in the past 14 days
      const recentAttempt = await DrillAttemptModel.findOne({
        learnerId: learner._id,
        completedAt: { $gte: fourteenDaysAgo },
      })
        .select('_id')
        .lean();

      if (!recentAttempt) {
        console.log(`[skipped - no drill history] ${tag}`);
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
            generatedAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );

      console.log(`[regenerated] ${tag}`);
      generated++;
    } catch (err: any) {
      console.error(`[error] ${tag} — ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone — generated: ${generated}, skipped: ${skipped}, errors: ${errors}`);

  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
