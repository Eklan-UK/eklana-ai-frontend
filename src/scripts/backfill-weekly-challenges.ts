// Deletes empty weekly challenge documents and re-triggers generation for learners
// who have drill history in the past 7 days.
// Safe to re-run — only targets documents with an empty drillSequence.
// npx ts-node -r tsconfig-paths/register src/scripts/backfill-weekly-challenges.ts

import 'dotenv/config';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import UserModel from '@/models/user';
import WeeklyChallengeModel from '@/models/weekly-challenge';
import DrillAttempt from '@/models/drill-attempt';
import { getOrCreateWeeklyChallenge } from '@/domain/challenges/weekly-challenge.service';

async function main() {
	await connectToDatabase();

	const now = new Date();
	const sevenDaysAgo = new Date(now);
	sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
	sevenDaysAgo.setUTCHours(0, 0, 0, 0);

	const learners = await UserModel.find({ role: 'user' }).select('_id').lean();
	console.log(`Found ${learners.length} learners.`);

	let deleted = 0;
	let regenerated = 0;
	let skipped = 0;

	for (const learner of learners) {
		const learnerId = learner._id;

		// Step a: find a weekly_challenge in the past 7 days with empty drillSequence
		const emptyChallenge = await WeeklyChallengeModel.findOne({
			learnerId,
			weekStartDate: { $gte: sevenDaysAgo },
			$or: [
				{ 'content.drillSequence': { $size: 0 } },
				{ 'content.drillSequence': { $exists: false } },
			],
		});

		// Step b: delete it so generation can retry
		if (emptyChallenge) {
			await WeeklyChallengeModel.deleteOne({ _id: emptyChallenge._id });
			deleted++;
		}

		// Step c: check for any DrillAttempt in the past 7 days
		const hasDrillHistory = await DrillAttempt.exists({
			learnerId,
			completedAt: { $gte: sevenDaysAgo, $lt: now },
		});

		// Step d: trigger fresh generation
		if (hasDrillHistory) {
			try {
				await getOrCreateWeeklyChallenge(learnerId, now);
				regenerated++;
				console.log(`[regenerated] learnerId=${learnerId}`);
			} catch (err) {
				console.error(`[error] learnerId=${learnerId}`, err);
			}
		} else {
			skipped++;
		}
	}

	console.log('--- Backfill complete ---');
	console.log(`  Deleted (empty challenges):  ${deleted}`);
	console.log(`  Regenerated:                 ${regenerated}`);
	console.log(`  Skipped (no drill history):  ${skipped}`);

	await disconnectFromDatabase();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
