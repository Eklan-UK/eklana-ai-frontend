// run with:
// npx tsx src/domain/challenges/test-generator.ts

import 'dotenv/config';
import { Types } from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import { aggregateWeaknesses } from './weakness-aggregator';
import { generateWeeklyChallenge } from './challenge-generator';

async function main() {
	await connectToDatabase();

	const learnerId = new Types.ObjectId('6a0716af6a7703bea04ca6c2');
	const weekStartDate = new Date();
	weekStartDate.setDate(weekStartDate.getDate() - 7);
	weekStartDate.setHours(0, 0, 0, 0);

	const profile = await aggregateWeaknesses(learnerId, weekStartDate);
	console.log('WeaknessProfile:');
	console.log(JSON.stringify(profile, null, 2));
	console.log('---');

	const content = await generateWeeklyChallenge(profile);
	console.log('WeeklyChallenge content:');
	console.log(JSON.stringify(content, null, 2));

	await disconnectFromDatabase();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
