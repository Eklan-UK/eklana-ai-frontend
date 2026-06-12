import 'dotenv/config';
import { Types } from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import UserModel from '@/models/user';
import DrillAttemptModel from '@/models/drill-attempt';
import PronunciationAttemptModel from '@/models/pronunciation-attempt';
import WeeklyChallengeModel from '@/models/weekly-challenge';

const LEARNER_ID = new Types.ObjectId('6a145e8ea1983cbd047bfd49');
const CUTOFF_DATE = new Date('2026-06-08T00:00:00.000Z');
const ORIGINAL_SUBSCRIPTION_DATE = new Date('2026-05-28T10:47:50.717Z');

async function main() {
	await connectToDatabase();

	const userResult = await UserModel.updateOne(
		{ _id: LEARNER_ID },
		{ $set: { subscriptionActivatedAt: ORIGINAL_SUBSCRIPTION_DATE } }
	);
	console.log(`User subscriptionActivatedAt reset (matched: ${userResult.matchedCount}, modified: ${userResult.modifiedCount})`);

	const drillResult = await DrillAttemptModel.deleteMany({
		learnerId: LEARNER_ID,
		completedAt: { $gte: CUTOFF_DATE },
	});
	console.log(`Deleted ${drillResult.deletedCount} DrillAttempt document(s)`);

	const pronunciationResult = await PronunciationAttemptModel.deleteMany({
		learnerId: LEARNER_ID,
		createdAt: { $gte: CUTOFF_DATE },
	});
	console.log(`Deleted ${pronunciationResult.deletedCount} PronunciationAttempt document(s)`);

	const challengeResult = await WeeklyChallengeModel.deleteMany({ learnerId: LEARNER_ID });
	console.log(`Deleted ${challengeResult.deletedCount} WeeklyChallenge document(s)`);

	await disconnectFromDatabase();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
