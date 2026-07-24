// npx tsx --env-file=.env.local src/scripts/weekly-challenge-report-single.ts

import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import WeeklyChallengeModel from '@/models/weekly-challenge';
import UserModel from '@/models/user';
import mongoose from 'mongoose';
import { DRILL_LABELS, summariseContent } from './lib/weekly-challenge-format';

const LEARNER_FILTER = '6995750e9882aa80e597d516';

async function main() {
  await connectToDatabase();

  const query: Record<string, any> = {
    'content.drillSequence.0': { $exists: true },
  };

  if (LEARNER_FILTER) {
    query.learnerId = new mongoose.Types.ObjectId(LEARNER_FILTER);
  }

  const challenges = await WeeklyChallengeModel.find(query)
    .sort({ createdAt: -1 })
    .lean();

  if (challenges.length === 0) {
    console.log('No weekly challenges found.');
    await disconnectFromDatabase();
    return;
  }

  const learnerIds = [...new Set(challenges.map((c) => String(c.learnerId)))];
  const users = await UserModel.find({ _id: { $in: learnerIds } })
    .select('_id firstName lastName email')
    .lean();

  const userMap = new Map(
    users.map((u) => [
      String(u._id),
      { name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(), email: u.email },
    ]),
  );

  const HR = '═'.repeat(70);

  console.log(`\nWeekly Challenge Report — ${challenges.length} challenge${challenges.length !== 1 ? 's' : ''}\n`);

  for (const challenge of challenges) {
    const user = userMap.get(String(challenge.learnerId));
    const name = user?.name ?? '(unknown)';
    const email = user?.email ?? '(unknown)';
    const generatedAt = challenge.generatedAt
      ? challenge.generatedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
      : '—';
    const sequence: any[] = challenge.content?.drillSequence ?? [];
    const totalMin = challenge.content?.totalEstimatedMinutes;
    const summary = challenge.content?.summaryMessage;

    console.log(HR);
    console.log(`  ${name}  <${email}>`);
    console.log(`  Generated: ${generatedAt}${totalMin != null ? `   Est. ${totalMin} min` : ''}`);
    if (summary) console.log(`  Summary:   ${summary}`);
    console.log('');

    for (const drill of sequence) {
      const label = DRILL_LABELS[drill.drillType] ?? drill.drillType;
      console.log(`  ${label.toUpperCase()}`);
      console.log(`  ${drill.instructions}`);
      const contentLines = summariseContent(drill.drillType, drill.generatedContent);
      for (const line of contentLines) console.log(line);
      console.log('');
    }
  }

  console.log(HR);
  console.log();

  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
