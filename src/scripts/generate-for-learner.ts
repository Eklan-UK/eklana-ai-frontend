// npx tsx --env-file=.env.local src/scripts/generate-for-learner.ts

import 'dotenv/config';
import { Types } from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import { currentWeekStartUtc } from '@/lib/challenges/utc-week-challenge';
import { aggregateWeaknesses } from '@/domain/challenges/weakness-aggregator';
import { generateWeeklyChallenge } from '@/domain/challenges/challenge-generator';
import WeeklyChallengeModel from '@/models/weekly-challenge';

const LEARNER_ID = new Types.ObjectId('6995750e9882aa80e597d516');

async function main() {
	await connectToDatabase();

	const weekStartDate = currentWeekStartUtc();
	console.log(`weekStartDate: ${weekStartDate.toISOString()}`);

	await WeeklyChallengeModel.deleteMany({ learnerId: LEARNER_ID, weekStartDate });
	console.log('Deleted existing weekly_challenge for this learner/week.');

	const profile = await aggregateWeaknesses(LEARNER_ID, weekStartDate);
	const content = await generateWeeklyChallenge(profile);

	const saved = await WeeklyChallengeModel.findOneAndUpdate(
		{ learnerId: LEARNER_ID, weekStartDate },
		{
			$set: {
				learnerId: LEARNER_ID,
				weekStartDate,
				weaknessProfile: profile,
				challengeType: 'structured_drill_sequence',
				content,
				status: 'ready',
				generatedAt: new Date(),
			},
		},
		{ upsert: true, new: true }
	);

	console.log(
		'drillSequence types:',
		saved?.content?.drillSequence?.map((item: { drillType: string }) => item.drillType)
	);
	console.log('totalEstimatedMinutes:', saved?.content?.totalEstimatedMinutes);

	await disconnectFromDatabase();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
