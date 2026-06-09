// Sets subscriptionActivatedAt to 6 days ago so today (day 7) triggers the weekly challenge.
// npx ts-node -r tsconfig-paths/register src/scripts/set-subscription-day7.ts

import 'dotenv/config';
import { Types } from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import User from '@/models/user';

const LEARNER_ID = new Types.ObjectId('6a145e8ea1983cbd047bfd49');

async function main() {
	await connectToDatabase();

	const now = new Date();
	const sixDaysAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));

	const updated = await User.findByIdAndUpdate(
		LEARNER_ID,
		{ $set: { subscriptionActivatedAt: sixDaysAgo } },
		{ new: true, select: 'subscriptionActivatedAt' },
	);

	if (!updated) {
		console.error('User not found:', LEARNER_ID.toString());
		process.exit(1);
	}

	console.log('subscriptionActivatedAt set to:', updated.subscriptionActivatedAt?.toISOString());

	await disconnectFromDatabase();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
