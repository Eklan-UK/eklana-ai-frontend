// Throwaway diagnostic — read-only. Inspects keyPhrasesResults for a single learner.
// npx tsx --env-file=.env.local src/scripts/diagnose-key-phrases.ts

import 'dotenv/config';
import '@/models/drill';
import { Types } from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import DrillAttempt from '@/models/drill-attempt';

const LEARNER_ID = '6a5d70b25a71612d2501e4b7';

async function main() {
	await connectToDatabase();

	const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

	const attempts = await DrillAttempt.find({
		learnerId: new Types.ObjectId(LEARNER_ID),
		drillType: 'key_phrases',
		completedAt: { $gte: tenDaysAgo },
	}).lean();

	console.log(`Found ${attempts.length} key_phrases attempts for ${LEARNER_ID} since ${tenDaysAgo.toISOString()}\n`);

	for (const attempt of attempts) {
		const kpr = attempt.keyPhrasesResults;
		console.log(`Attempt ${attempt._id}  completedAt=${attempt.completedAt?.toISOString?.() ?? attempt.completedAt}`);
		console.log(`  keyPhrasesResults exists: ${!!kpr}`);
		if (!kpr) {
			console.log('');
			continue;
		}
		console.log(`  items.length: ${kpr.items?.length ?? 0}`);
		for (const [i, item] of (kpr.items ?? []).entries()) {
			const correctPresent = typeof item.correctAnswer === 'string' && item.correctAnswer.trim().length > 0;
			const selectedPresent = typeof item.selectedAnswer === 'string' && item.selectedAnswer.trim().length > 0;
			console.log(
				`    [${i}] isCorrect=${item.isCorrect}  correctAnswer=${correctPresent ? `"${item.correctAnswer}"` : '(missing/empty)'}  selectedAnswer=${selectedPresent ? `"${item.selectedAnswer}"` : '(missing/empty)'}`
			);
		}
		console.log('');
	}

	await disconnectFromDatabase();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
