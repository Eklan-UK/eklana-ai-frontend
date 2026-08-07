// npx tsx --env-file=.env.local src/scripts/cleanup-duplicate-challenges.ts

import 'dotenv/config';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import WeeklyChallengeModel from '@/models/weekly-challenge';
import UserModel from '@/models/user';

const DRY_RUN = true;

const RANGE_START = new Date('2026-08-02T00:00:00.000Z');
const RANGE_END = new Date('2026-08-03T23:59:59.999Z');

async function main() {
	await connectToDatabase();

	const challenges = await WeeklyChallengeModel.find({
		generatedAt: { $gte: RANGE_START, $lte: RANGE_END },
	}).lean();

	const byLearner = new Map<string, typeof challenges>();
	for (const challenge of challenges) {
		const key = challenge.learnerId.toString();
		const group = byLearner.get(key);
		if (group) {
			group.push(challenge);
		} else {
			byLearner.set(key, [challenge]);
		}
	}

	const duplicatedEntries = [...byLearner.entries()].filter(([, docs]) => docs.length > 1);

	let deletedCount = 0;

	for (const [learnerId, docs] of duplicatedEntries) {
		const learner = await UserModel.findById(learnerId).lean();
		const learnerName = learner ? `${learner.firstName} ${learner.lastName}` : 'Unknown';
		const learnerEmail = learner?.email ?? 'unknown';

		console.log(`\nLearner: ${learnerName} <${learnerEmail}> (${learnerId})`);

		const sorted = [...docs].sort(
			(a, b) => (a.generatedAt?.getTime() ?? 0) - (b.generatedAt?.getTime() ?? 0),
		);
		const older = sorted[0];

		for (const doc of sorted) {
			const drillCount = doc.content?.drillSequence?.length ?? 0;
			const completedCount = doc.completedItemIndexes?.length ?? 0;
			const isOlder = doc._id.toString() === older._id.toString();
			console.log(
				`  - weekStartDate=${doc.weekStartDate?.toISOString()} generatedAt=${doc.generatedAt?.toISOString()} drills=${drillCount} completedItemIndexes=${completedCount}${isOlder ? '  <-- would delete (older)' : ''}`,
			);
		}

		const olderCompletedCount = older.completedItemIndexes?.length ?? 0;

		if (!DRY_RUN) {
			if (olderCompletedCount > 0) {
				console.log(
					`  Preserved older document ${older._id} because the student had started it (completedItemIndexes.length=${olderCompletedCount}).`,
				);
			} else {
				await WeeklyChallengeModel.deleteOne({ _id: older._id });
				deletedCount++;
				console.log(`  Deleted older document ${older._id}.`);
			}
		} else {
			deletedCount++;
		}
	}

	console.log(`\nSummary: ${duplicatedEntries.length} learner(s) affected, ${deletedCount} document(s) would be deleted.`);

	if (DRY_RUN) {
		console.log('DRY_RUN is true — no changes were made.');
	}

	await disconnectFromDatabase();
}

main().catch(async (error) => {
	console.error(error);
	await disconnectFromDatabase();
	process.exit(1);
});
