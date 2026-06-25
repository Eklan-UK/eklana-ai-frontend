// run with:
// npx ts-node -r tsconfig-paths/register src/domain/challenges/test-aggregator.ts

import '@/scripts/load-env';
import { Types } from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import DrillAttempt from '@/models/drill-attempt';
import PronunciationAttemptModel from '@/models/pronunciation-attempt';
import { aggregateWeaknesses } from './weakness-aggregator';

async function main() {
	await connectToDatabase();

	const learnerId = new Types.ObjectId('6a0716af6a7703bea04ca6c2');
	const weekStartDate = new Date();
	weekStartDate.setDate(weekStartDate.getDate() - 7);
	weekStartDate.setHours(0, 0, 0, 0);
	const weekEndDate = new Date(weekStartDate);
	weekEndDate.setDate(weekEndDate.getDate() + 7);

	console.log('learnerId         :', learnerId.toString());
	console.log('weekStartDate     :', weekStartDate.toISOString());
	console.log('weekEndDate       :', weekEndDate.toISOString());
	console.log('---');

	// Debug 1: all attempts for this learner — count + date range
	const [allCount, dateRange] = await Promise.all([
		DrillAttempt.countDocuments({ learnerId, completedAt: { $exists: true } }),
		DrillAttempt.aggregate([
			{ $match: { learnerId, completedAt: { $exists: true } } },
			{
				$group: {
					_id: null,
					minDate: { $min: '$completedAt' },
					maxDate: { $max: '$completedAt' },
				},
			},
		]),
	]);

	console.log(`[debug] total completed attempts for learner : ${allCount}`);
	if (dateRange.length > 0) {
		console.log(`[debug] earliest completedAt : ${(dateRange[0].minDate as Date).toISOString()}`);
		console.log(`[debug] latest completedAt   : ${(dateRange[0].maxDate as Date).toISOString()}`);
	}

	// Debug 2: attempts within the 7-day window
	const windowCount = await DrillAttempt.countDocuments({
		learnerId,
		completedAt: { $gte: weekStartDate, $lt: weekEndDate },
	});
	console.log(`[debug] attempts within 7-day window        : ${windowCount}`);

	const windowAttempts = await DrillAttempt.find({
		learnerId,
		completedAt: { $gte: weekStartDate, $lt: weekEndDate },
	}).lean();

	console.log('[debug] raw attempts:', JSON.stringify(windowAttempts, null, 2));
	console.log('---');

	const linkedPronAttempts = await PronunciationAttemptModel.find({
		learnerId,
		createdAt: { $gte: weekStartDate, $lt: weekEndDate },
		drillAttemptId: { $exists: true },
	}).lean();
	console.log('[debug] linked PronunciationAttempts (with drillAttemptId):', linkedPronAttempts.length);

	const profile = await aggregateWeaknesses(learnerId, weekStartDate);
	console.log(JSON.stringify(profile, null, 2));

	await disconnectFromDatabase();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
