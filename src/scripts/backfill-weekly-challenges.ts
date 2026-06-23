// Deletes empty weekly challenge documents and directly generates fresh challenges
// for learners who have drill history in the past 14 days, bypassing all day/week checks.
// Safe to re-run — only targets documents with an empty or missing drillSequence.
// npx ts-node -r tsconfig-paths/register src/scripts/backfill-weekly-challenges.ts

import 'dotenv/config';
import { Types } from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import UserModel from '@/models/user';
import WeeklyChallengeModel from '@/models/weekly-challenge';
import DrillAttempt from '@/models/drill-attempt';
import { generateWeeklyChallenge } from '@/domain/challenges/challenge-generator';
import { aggregateWeaknesses } from '@/domain/challenges/weakness-aggregator';
import { currentWeekStartUtc } from '@/lib/challenges/utc-week-challenge';

// Always attempt generation for these learners regardless of drill history
const PRIORITY_LEARNER_IDS = [
	'6998629dd7e5e5284b7fc9b6',
	'6a1b6e5defa8f8477d16a1c2',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
	await connectToDatabase();

	const now = new Date();
	const fourteenDaysAgo = new Date(now);
	fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 14);
	fourteenDaysAgo.setUTCHours(0, 0, 0, 0);

	const weekStartDate = currentWeekStartUtc(now);

	const learners = await UserModel.find({ role: 'user' }).select('_id').lean();

	// Merge priority IDs in — deduplicated, as ObjectIds for consistent comparison
	const learnerIdSet = new Set(learners.map((l) => l._id.toString()));
	const priorityEntries = PRIORITY_LEARNER_IDS
		.filter((id) => !learnerIdSet.has(id))
		.map((id) => ({ _id: new Types.ObjectId(id) }));
	const allLearners = [...learners, ...priorityEntries];

	console.log(`Found ${learners.length} learners (+${priorityEntries.length} priority).`);

	let deleted = 0;
	let regenerated = 0;
	let skipped = 0;

	const prioritySet = new Set(PRIORITY_LEARNER_IDS);

	for (const learner of allLearners) {
		const learnerId = learner._id;
		const isPriority = prioritySet.has(learnerId.toString());

		// Step 1: delete ALL weekly_challenge documents with empty or missing drillSequence
		const deleteResult = await WeeklyChallengeModel.deleteMany({
			learnerId,
			$or: [
				{ 'content.drillSequence': { $size: 0 } },
				{ 'content.drillSequence': { $exists: false } },
			],
		});
		deleted += deleteResult.deletedCount ?? 0;

		// Step 2: check for any DrillAttempt in the past 14 days (bypassed for priority learners)
		if (!isPriority) {
			const hasDrillHistory = await DrillAttempt.exists({
				learnerId,
				completedAt: { $gte: fourteenDaysAgo, $lt: now },
			});

			if (!hasDrillHistory) {
				skipped++;
				continue;
			}
		}

		// Step 3: build weakness profile and generate directly — no day/week gate
		try {
			const profile = await aggregateWeaknesses(learnerId, weekStartDate);

			if (learnerId.toString() === '6a1b6e5defa8f8477d16a1c2') {
				console.log(`[debug] weaknessProfile for ${learnerId}:`, JSON.stringify(profile, null, 2));
			}

			// Retry once after 2 seconds if generation fails on first attempt
			let content;
			try {
				content = await generateWeeklyChallenge(profile);
			} catch {
				await sleep(2000);
				content = await generateWeeklyChallenge(profile);
			}

			// Step 4: upsert the WeeklyChallenge for the current week
			const currentWeekStart = currentWeekStartUtc(now);
			await WeeklyChallengeModel.findOneAndUpdate(
				{ learnerId, weekStartDate: currentWeekStart },
				{
					$set: {
						content,
						status: 'ready',
						generatedAt: new Date(),
						weaknessProfile: profile,
						challengeType: 'structured_drill_sequence',
					},
				},
				{ upsert: true, new: true },
			);

			regenerated++;
			console.log(`[regenerated] learnerId=${learnerId}${isPriority ? ' (priority)' : ''}`);
		} catch (err) {
			console.error(`[error] learnerId=${learnerId}`, err);
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
