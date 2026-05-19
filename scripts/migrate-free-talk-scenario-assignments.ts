// Backfill Free Talk scenarios created before per-learner assignment.
// Run: npx tsx scripts/migrate-free-talk-scenario-assignments.ts
// Dry run: npx tsx scripts/migrate-free-talk-scenario-assignments.ts --dry-run

import { connectToDatabase } from '../src/lib/api/db';
import FreeTalkScenario from '../src/models/free-talk-scenario';

const DRY_RUN = process.argv.includes('--dry-run');

async function migrate() {
	console.log('Connecting to database...');
	await connectToDatabase();

	const filter = {
		$or: [{ allLearners: { $exists: false } }, { allLearners: null }],
	};

	const count = await FreeTalkScenario.countDocuments(filter).exec();
	console.log(`Found ${count} scenario(s) to backfill to allLearners: true`);

	if (count === 0) {
		console.log('Nothing to migrate.');
		process.exit(0);
	}

	if (DRY_RUN) {
		const sample = await FreeTalkScenario.find(filter).select('title allLearners').limit(5).lean();
		console.log('\nDry run — would update:', sample);
		console.log('\n⚠️  DRY RUN — no changes saved');
		process.exit(0);
	}

	const result = await FreeTalkScenario.updateMany(filter, {
		$set: { allLearners: true },
	});

	console.log(`Updated ${result.modifiedCount} scenario(s).`);
	process.exit(0);
}

migrate().catch((err) => {
	console.error(err);
	process.exit(1);
});
